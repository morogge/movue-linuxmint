import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it } from 'vitest';
import { listenAdresse, oeffneListe } from '../../src/main/filmliste/quelle';
import { oeffneDb, schliesseAufbau } from '../../src/main/index/datenbank';
import { importiere } from '../../src/main/index/import';
import { ardId } from '../../src/main/bilder';

const UA = 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0';

async function lies(url: string): Promise<{ status: number; text: string }> {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'de-DE', Accept: '*/*' }, redirect: 'follow', signal: AbortSignal.timeout(20_000) });
    return { status: r.status, text: (await r.text()).slice(0, 3_000_000) };
  } catch (e) {
    return { status: 0, text: String(e) };
  }
}

function umgebung(text: string, re: RegExp, n = 4, breite = 220): string[] {
  const out: string[] = [];
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  let m: RegExpExecArray | null;
  while ((m = g.exec(text)) && out.length < n) out.push(text.slice(Math.max(0, m.index - 80), m.index + breite).replace(/\s+/g, ' '));
  return out;
}

// Einmalige Probe: Titelbilder (Poster, Serienbild) und Besetzung bei den Sendern; Dubletten über Sender; Wikidata
it('Meta-Probe', async () => {
  const ordner = mkdtempSync(join(tmpdir(), 'movue-probe-'));
  const pfad = join(ordner, 'index.db');
  try {
    const db = oeffneDb(pfad, { schnellaufbau: true });
    await importiere(await oeffneListe(await listenAdresse('voll', 'Movue-CI'), 'Movue-CI'), db, () => {});
    schliesseAufbau(db);
    const aus: Record<string, unknown> = {};

    // Gleiche Sendung bei mehreren Sendern (Titel normalisiert, Dauer ±3 Min.)
    db.function('norm', { deterministic: true }, (t: unknown) => String(t).toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim());
    aus.dubletten = db
      .prepare(
        `WITH f AS (SELECT norm(titel) k, gruppe, dauer, id FROM film WHERE variante = 0 AND dauer >= 1500)
         SELECT COUNT(*) AS paare, COUNT(DISTINCT a.k) AS titel FROM f a JOIN f b ON a.k = b.k AND a.gruppe < b.gruppe AND abs(a.dauer - b.dauer) <= 180`
      )
      .get();
    aus.dublettenBeispiele = db
      .prepare(
        `WITH f AS (SELECT norm(titel) k, gruppe, dauer, titel, thema FROM film WHERE variante = 0 AND dauer >= 3600)
         SELECT a.titel, a.gruppe || ' / ' || b.gruppe AS gruppen, a.thema || ' / ' || b.thema AS themen FROM f a JOIN f b ON a.k = b.k AND a.gruppe < b.gruppe AND abs(a.dauer - b.dauer) <= 180
         GROUP BY a.k ORDER BY random() LIMIT 30`
      )
      .all();
    aus.dublettenJePaar = db
      .prepare(
        `WITH f AS (SELECT norm(titel) k, gruppe, dauer FROM film WHERE variante = 0 AND dauer >= 1500)
         SELECT a.gruppe || '/' || b.gruppe AS paar, COUNT(DISTINCT a.k) n FROM f a JOIN f b ON a.k = b.k AND a.gruppe < b.gruppe AND abs(a.dauer - b.dauer) <= 180 GROUP BY paar`
      )
      .all();

    // Seiten der Sender: Bildformate, Besetzung
    const muster: [string, RegExp][] = [
      ['bildschluessel', /"(aspect[^"]*|image[A-Za-z0-9_]*|poster[A-Za-z]*|portrait|landscape|square|banner|cover|teaserImage[A-Za-z]*|layouts)"\s*:/i],
      ['format', /\b(2x3|3x4|2:3|3:4|1x1|16x7|9x16|poster|hochkant|portrait)\b/i],
      ['besetzung', /(Darsteller|Besetzung|Mitwirkende|"credits"|"cast"|"actor"|Rolle|"role")/i],
      ['show', /"(show|series|grouping|serie|brand|collection|programId|sendung)"\s*:\s*\{/i]
    ];
    const proben: Record<string, unknown[]> = {};
    for (const gruppe of ['ARD', 'ZDF', '3sat', 'Arte']) {
      const zeilen = db
        .prepare(
          `SELECT f.website, f.titel, f.thema FROM film f JOIN film_genre g ON g.film_id = f.id
           WHERE f.gruppe = ? AND f.variante = 0 AND g.genre IN ('film','serie','krimi') AND f.dauer > 2400 ORDER BY random() LIMIT 4`
        )
        .all(gruppe) as { website: string; titel: string; thema: string }[];
      proben[gruppe] = [];
      for (const z of zeilen) {
        const id = ardId(z.website);
        const quelle = id ? `https://api.ardmediathek.de/page-gateway/pages/ard/item/${id}?devicetype=pc&embedded=true` : z.website.replace(/^http:/, 'https:');
        const { status, text } = await lies(quelle);
        const e: Record<string, unknown> = { quelle, titel: z.titel, thema: z.thema, status, laenge: text.length };
        for (const [name, re] of muster) e[name] = umgebung(text, re, name === 'bildschluessel' ? 8 : 4);
        proben[gruppe].push(e);
      }
    }
    aus.proben = proben;

    // ARD: Sendungsseite (show) mit Bildern
    const ardShow = await lies('https://api.ardmediathek.de/page-gateway/pages/ard/grouping/Y3JpZDovL2Rhc2Vyc3RlLmRlL3RhdG9ydA?devicetype=pc&embedded=true');
    aus.ardShow = { status: ardShow.status, laenge: ardShow.text.length, bilder: umgebung(ardShow.text, /"images"\s*:/, 3, 900) };

    // Arte: offizielle Schnittstelle der Website
    const arte = await lies('https://www.arte.tv/api/rproxy/emac/v4/de/web/programs/RC-014095');
    aus.arteApi = { status: arte.status, laenge: arte.text.length, bilder: umgebung(arte.text, /"images"\s*:/, 2, 1200), credits: umgebung(arte.text, /credits/i, 2, 600) };

    // Wikidata: Serie mit TMDB-Kennung und Besetzung
    const sparql = `SELECT ?item ?tmdb ?tmdbtv ?darsteller WHERE { ?item rdfs:label "Babylon Berlin"@de . OPTIONAL { ?item wdt:P4983 ?tmdbtv } OPTIONAL { ?item wdt:P4947 ?tmdb } OPTIONAL { ?item wdt:P161 ?d . ?d rdfs:label ?darsteller FILTER(lang(?darsteller) = "de") } } LIMIT 12`;
    const wd = await lies(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`);
    aus.wikidata = { status: wd.status, text: wd.text.slice(0, 2500) };

    // TMDB ohne Schlüssel: erreichbar?
    const tmdb = await lies('https://api.themoviedb.org/3/configuration');
    aus.tmdb = { status: tmdb.status, text: tmdb.text.slice(0, 300) };

    console.log('META-PROBE ' + JSON.stringify(aus));
    db.close();
  } finally {
    rmSync(ordner, { recursive: true, force: true });
  }
});
