import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it } from 'vitest';
import { listenAdresse, oeffneListe } from '../../src/main/filmliste/quelle';
import { oeffneDb, schliesseAufbau } from '../../src/main/index/datenbank';
import { importiere } from '../../src/main/index/import';
import { extrahiereOgImage } from '../../src/main/bilder';
import { titelKern } from '../../src/shared/titelinfo';

const UA = 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0';
const WD_UA = 'Movue-CI/0.9 (https://github.com/morogge/movue-linuxmint)';

async function lies(url: string, ua = UA): Promise<{ status: number; text: string; url: string }> {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': ua, 'Accept-Language': 'de-DE' }, redirect: 'follow', signal: AbortSignal.timeout(30_000) });
    return { status: r.status, text: (await r.text()).slice(0, 3_000_000), url: r.url };
  } catch (e) {
    return { status: 0, text: String(e), url };
  }
}
const um = (t: string, re: RegExp, n = 3, b = 300) => {
  const out: string[] = [];
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  let m: RegExpExecArray | null;
  while ((m = g.exec(t)) && out.length < n) out.push(t.slice(Math.max(0, m.index - 100), m.index + b).replace(/\s+/g, ' '));
  return out;
};

it('Meta2-Probe', async () => {
  const ordner = mkdtempSync(join(tmpdir(), 'movue-probe-'));
  const pfad = join(ordner, 'index.db');
  try {
    const db = oeffneDb(pfad, { schnellaufbau: true });
    await importiere(await oeffneListe(await listenAdresse('voll', 'Movue-CI'), 'Movue-CI'), db, () => {});
    schliesseAufbau(db);
    const aus: Record<string, unknown> = {};

    // 1. Serienbild bei ZDF/3sat: og:image der übergeordneten Seite (Serie) gegenüber der Folge
    const serien = db
      .prepare(
        `SELECT s.gruppe, s.thema, f.website FROM serie s JOIN film f ON f.id = s.film_id
         WHERE s.gruppe IN ('ZDF','3sat') AND s.art = 'serie' ORDER BY s.folgen DESC LIMIT 14`
      )
      .all() as { gruppe: string; thema: string; website: string }[];
    const salt = db.prepare(`SELECT gruppe, thema, website FROM film WHERE lower(thema) LIKE '%salt marsh%' LIMIT 1`).all() as typeof serien;
    aus.serienbild = [];
    for (const s of [] as typeof serien) {
      const folge = await lies(s.website);
      const eltern = s.website.replace(/\/[^/]+\/?$/, '');
      const serie = await lies(eltern);
      (aus.serienbild as unknown[]).push({
        thema: s.thema, website: s.website, eltern, status: serie.status, endUrl: serie.url,
        folgeBild: extrahiereOgImage(folge.text), serieBild: extrahiereOgImage(serie.text),
        bildFormate: um(folge.text, /~\d{3,4}x\d{3,4}/, 6, 60)
      });
    }

    // 2. ZDF-Stab: was folgt auf die Überschrift?
    const zdf = db.prepare(`SELECT website FROM film WHERE gruppe = 'ZDF' AND website LIKE '%/video/serien/%' ORDER BY random() LIMIT 2`).all() as { website: string }[];
    aus.stab = [];
    for (const z of zdf.slice(0, 1)) {
      const t = (await lies(z.website)).text;
      const i = t.search(/>\s*Stab\s*<\/h[2-4]>/i);
      (aus.stab as unknown[]).push({ website: z.website, danach: i >= 0 ? t.slice(i, i + 2500) : null });
    }

    // 3. Arte: Besetzung, Bilder, Serien-Kennung
    const arte = db.prepare(`SELECT website, titel FROM film WHERE gruppe = 'Arte' AND dauer > 2400 ORDER BY random() LIMIT 3`).all() as { website: string; titel: string }[];
    aus.arte = [];
    for (const a of arte.slice(0, 0)) {
      const t = (await lies(a.website)).text;
      (aus.arte as unknown[]).push({
        website: a.website, titel: a.titel,
        credits: um(t, /credits/i, 2, 700), darsteller: um(t, /Darsteller/i, 2, 400),
        portrait: um(t, /portrait|landscape|"square"|banner/i, 4, 200), rc: [...new Set(t.match(/RC-\d{6}/g) ?? [])].slice(0, 5)
      });
    }

    // 4. Wikidata: Trefferquote für Serien und Filme über das Label
    const serienNamen = (db.prepare(`SELECT thema FROM serie WHERE art = 'serie' ORDER BY (id * 2654435761) % 1000003 LIMIT 150`).all() as { thema: string }[]).map((z) => z.thema);
    const filmTitel = (
      db
        .prepare(
          `SELECT DISTINCT f.titel FROM film f JOIN film_genre g ON g.film_id = f.id AND g.genre = 'film'
           WHERE f.variante = 0 AND f.dauer > 4800 ORDER BY (f.id * 2654435761) % 1000003 LIMIT 150`
        )
        .all() as { titel: string }[]
    ).map((z) => z.titel);
    const sauber = (t: string) => t.replace(/\s[-–]\s(Spielfilm|Fernsehfilm|Film|Dokumentarfilm)\b.*$/i, '').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s*\|.*$/, '').trim();
    async function wd(namen: string[], typen: string) {
      const values = namen.map((n) => JSON.stringify(sauber(n)) + '@de').join(' ');
      const q = `SELECT ?label ?item ?typ (COUNT(DISTINCT ?d) AS ?darsteller) (COUNT(DISTINCT ?rolle) AS ?rollen) (SAMPLE(?jahr) AS ?j) (SAMPLE(?tmdb) AS ?tm) WHERE {
        VALUES ?label { ${values} } ?item rdfs:label ?label . ?item wdt:P31 ?typ . VALUES ?typ { ${typen} }
        OPTIONAL { ?item p:P161 ?st . ?st ps:P161 ?d . OPTIONAL { ?st pq:P453 ?rolle } OPTIONAL { ?st pq:P4633 ?rolle } }
        OPTIONAL { ?item wdt:P577 ?jahr } OPTIONAL { ?item wdt:P4947|wdt:P4983 ?tmdb }
      } GROUP BY ?label ?item ?typ`;
      let r: { status: number; text: string };
      try {
        const a = await fetch('https://query.wikidata.org/sparql', {
          method: 'POST',
          headers: { 'User-Agent': WD_UA, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/sparql-results+json' },
          body: 'query=' + encodeURIComponent(q),
          signal: AbortSignal.timeout(60_000)
        });
        r = { status: a.status, text: await a.text() };
      } catch (e) {
        r = { status: 0, text: String(e) };
      }
      try {
        const j = JSON.parse(r.text) as { results: { bindings: Record<string, { value: string }>[] } };
        return j.results.bindings.map((b) => ({ label: b.label?.value, item: b.item?.value.split('/').pop(), typ: b.typ?.value.split('/').pop(), darsteller: Number(b.darsteller?.value), rollen: Number(b.rollen?.value), jahr: b.j?.value?.slice(0, 4), tmdb: b.tm?.value }));
      } catch {
        return { status: r.status, text: r.text.slice(0, 500) };
      }
    }
    const t0 = Date.now();
    const ws = await wd(serienNamen, 'wd:Q5398426 wd:Q1259759 wd:Q526877 wd:Q15416');
    const wf = await wd(filmTitel, 'wd:Q11424 wd:Q506240 wd:Q24862 wd:Q202866 wd:Q93204');
    aus.wikidataMs = Date.now() - t0;
    const quote = (liste: unknown, namen: string[]) => {
      if (!Array.isArray(liste)) return liste;
      const gefunden = new Set(liste.map((x: { label?: string }) => x.label));
      const mitCast = new Set(liste.filter((x: { darsteller: number }) => x.darsteller > 0).map((x: { label?: string }) => x.label));
      const mitRolle = new Set(liste.filter((x: { rollen: number }) => x.rollen > 0).map((x: { label?: string }) => x.label));
      const mehrdeutig = Object.values(liste.reduce((m: Record<string, number>, x: { label?: string }) => ((m[x.label ?? ''] = (m[x.label ?? ''] ?? 0) + 1), m), {})).filter((n) => (n as number) > 1).length;
      return { gefragt: namen.length, gefunden: gefunden.size, mitDarstellern: mitCast.size, mitRollen: mitRolle.size, mehrdeutig, beispiele: liste.slice(0, 25), nicht: namen.map(sauber).filter((n) => !gefunden.has(n)).slice(0, 25) };
    };
    aus.wikidataSerien = quote(ws, serienNamen);
    aus.wikidataFilme = quote(wf, filmTitel);
    console.log('META2-PROBE ' + JSON.stringify(aus));
    db.close();
  } finally {
    rmSync(ordner, { recursive: true, force: true });
  }
});
