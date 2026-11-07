/**
 * Baut das Metadaten-Paket (metadaten.json) für alle Filme und Serien im Sendungsverzeichnis.
 * Läuft in der GitHub-Action „Metadaten“ (über Vitest, damit dieselben Module wie in der App gelten):
 *   MOVUE_META_ALT=<alte Datei> MOVUE_META_NEU=<neue Datei> npx vitest run --config vitest.metadaten.config.ts
 * Bekannte Einträge werden übernommen; gefragt wird nur nach neuen oder veralteten Titeln.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it } from 'vitest';
import { listenAdresse, oeffneListe } from '../../src/main/filmliste/quelle';
import { oeffneDb, schliesseAufbau } from '../../src/main/index/datenbank';
import { importiere } from '../../src/main/index/import';
import { herkunft } from '../../src/shared/titelinfo';
import { filmSchluessel, META_STAND, serienSchluessel, wikidataTitel, type MetaDatei, type MetaEintrag } from '../../src/shared/metadaten';
import { details, FILM_TYPEN, SERIEN_TYPEN, suche, waehle, type Kandidat } from './wikidata';

const TAG = 86_400_000;
/** Gefundene Einträge nach 60 Tagen auffrischen, nicht gefundene nach 21 Tagen erneut versuchen */
const GUELTIG = 60 * TAG;
const LEER_GUELTIG = 21 * TAG;
const BLOCK = 40;
/** Zeitbudget je Lauf; der Rest folgt am nächsten Tag */
const BUDGET = Number(process.env.MOVUE_META_MINUTEN ?? 40) * 60_000;

interface Titel {
  schluessel: string;
  namen: string[];
  jahr?: string;
}

it('Metadaten bauen', { timeout: 120 * 60_000 }, async () => {
  const start = Date.now();
  const alt: MetaDatei | null =
    process.env.MOVUE_META_ALT && existsSync(process.env.MOVUE_META_ALT)
      ? (JSON.parse(readFileSync(process.env.MOVUE_META_ALT, 'utf8')) as MetaDatei)
      : null;
  const eintraege: Record<string, MetaEintrag> = { ...(alt?.eintraege ?? {}) };

  const ordner = mkdtempSync(join(tmpdir(), 'movue-meta-'));
  try {
    const db = oeffneDb(join(ordner, 'index.db'), { schnellaufbau: true });
    await importiere(await oeffneListe(await listenAdresse('voll', 'Movue-Metadaten'), 'Movue-Metadaten'), db, () => {});
    schliesseAufbau(db);

    const filme = new Map<string, Titel>();
    for (const z of db
      .prepare(
        `SELECT f.titel, f.beschreibung FROM film f JOIN film_genre g ON g.film_id = f.id AND g.genre = 'film'
         WHERE f.variante = 0 AND f.dauer >= 3600 ORDER BY f.datum DESC`
      )
      .all() as { titel: string; beschreibung: string }[]) {
      const schluessel = filmSchluessel(z.titel);
      if (!filme.has(schluessel)) filme.set(schluessel, { schluessel, namen: wikidataTitel(z.titel), jahr: herkunft(z.titel, z.beschreibung)?.jahr });
    }
    const serien = new Map<string, Titel>();
    for (const z of db.prepare(`SELECT thema FROM serie WHERE art IN ('serie', 'filmreihe') ORDER BY folgen DESC`).all() as { thema: string }[]) {
      const schluessel = serienSchluessel(z.thema);
      if (!serien.has(schluessel)) serien.set(schluessel, { schluessel, namen: wikidataTitel(z.thema) });
    }
    db.close();

    const jetzt = Date.now();
    const offen = (t: Titel) => {
      const e = eintraege[t.schluessel];
      // Gefundene Einträge eines älteren Stands (ohne Genres) neu abfragen
      return !e || jetzt - e.t > (e.q ? GUELTIG : LEER_GUELTIG) || (!!e.q && (e.v ?? 1) < META_STAND);
    };
    const stat = { filme: filme.size, serien: serien.size, gefragt: 0, gefunden: 0, mitBesetzung: 0, abgebrochen: false };

    for (const [liste, typen] of [
      [[...serien.values()].filter(offen), SERIEN_TYPEN],
      [[...filme.values()].filter(offen), FILM_TYPEN]
    ] as [Titel[], string[]][]) {
      for (let i = 0; i < liste.length; i += BLOCK) {
        if (Date.now() - start > BUDGET) {
          stat.abgebrochen = true;
          break;
        }
        const block = liste.slice(i, i + BLOCK);
        const kandidaten = await suche(
          [...new Set(block.flatMap((t) => t.namen))],
          typen
        );
        const nachLabel = new Map<string, Kandidat[]>();
        for (const k of kandidaten) nachLabel.set(k.label, [...(nachLabel.get(k.label) ?? []), k]);
        const gewaehlt = new Map<string, Kandidat>();
        for (const t of block) {
          const k = waehle(t.namen.flatMap((n) => nachLabel.get(n) ?? []), t.jahr);
          if (k) gewaehlt.set(t.schluessel, k);
        }
        const d = await details([...new Set([...gewaehlt.values()].map((k) => k.q))]);
        for (const t of block) {
          stat.gefragt++;
          const k = gewaehlt.get(t.schluessel);
          if (!k) {
            eintraege[t.schluessel] = { t: jetzt };
            continue;
          }
          const x = d.get(k.q);
          const original = x?.original && !t.namen.some((n) => n.toLowerCase() === x.original!.toLowerCase()) ? x.original : undefined;
          eintraege[t.schluessel] = {
            q: k.q,
            j: x?.jahr ?? k.jahr,
            l: x?.land.length ? x.land.join(', ') : undefined,
            o: original,
            r: x?.regie.length ? x.regie : undefined,
            d: x?.darsteller.length ? x.darsteller : undefined,
            g: x?.genres.length ? x.genres : undefined,
            v: META_STAND,
            t: jetzt
          };
          stat.gefunden++;
          if (x?.darsteller.length) stat.mitBesetzung++;
        }
      }
      if (stat.abgebrochen) break;
    }

    // Titel, die seit einem Jahr nicht mehr im Verzeichnis sind, fallen heraus
    for (const [k, e] of Object.entries(eintraege)) if (jetzt - e.t > 365 * TAG && !filme.has(k) && !serien.has(k)) delete eintraege[k];

    const proben = Object.entries(eintraege)
      .filter(([, e]) => e.q)
      .slice(0, 30)
      .map(([k, e]) => `${k} → ${e.q} ${e.j ?? ''} ${e.l ?? ''} R: ${(e.r ?? []).join(', ')} D: ${(e.d ?? []).slice(0, 4).map(([n, r]) => (r ? `${n} (${r})` : n)).join(', ')}`);
    for (const p of proben) console.log('PROBE ' + p);
    const datei: MetaDatei = { version: 1, stand: new Date().toISOString(), eintraege };
    if (process.env.MOVUE_META_NEU) writeFileSync(process.env.MOVUE_META_NEU, JSON.stringify(datei));
    const gesamt = Object.values(eintraege);
    console.log(
      'METADATEN ' +
        JSON.stringify({
          ...stat,
          eintraege: gesamt.length,
          mitWikidata: gesamt.filter((e) => e.q).length,
          mitDarstellern: gesamt.filter((e) => e.d?.length).length,
          minuten: Math.round((Date.now() - start) / 60_000)
        })
    );
  } finally {
    rmSync(ordner, { recursive: true, force: true });
  }
});
