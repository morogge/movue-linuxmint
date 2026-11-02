import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it } from 'vitest';
import { listenAdresse, oeffneListe } from '../../src/main/filmliste/quelle';
import { oeffneDb, schliesseAufbau } from '../../src/main/index/datenbank';
import { importiere } from '../../src/main/index/import';
import { ardId } from '../../src/main/bilder';

const UA = 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0';
const MUSTER = [/availableTo/i, /verf(ü|&uuml;|\\u00fc)gbar bis/i, /availab[a-z]*["']?\s*:\s*\{/i, /"end(Date)?"\s*:/, /expir/i, /offlineAvailab/i, /"until"/i, /bis zum \d/i];

async function lies(url: string, max = 3_000_000): Promise<string> {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'de-DE' }, redirect: 'follow', signal: AbortSignal.timeout(20_000) });
  if (!r.ok) return `HTTP ${r.status}`;
  const t = await r.text();
  return t.slice(0, max);
}

function treffer(text: string): string[] {
  const out: string[] = [];
  for (const m of MUSTER) {
    const re = new RegExp(m.source, m.flags.includes('g') ? m.flags : m.flags + 'g');
    let x: RegExpExecArray | null;
    let k = 0;
    while ((x = re.exec(text)) && k < 2) {
      out.push(text.slice(Math.max(0, x.index - 60), x.index + 120).replace(/\s+/g, ' '));
      k++;
    }
  }
  return out;
}

// Einmalige Probe: woher lässt sich „verfügbar bis“ je Sender holen?
it('Ablauf-Probe', async () => {
  const ordner = mkdtempSync(join(tmpdir(), 'movue-probe-'));
  const pfad = join(ordner, 'index.db');
  try {
    const db = oeffneDb(pfad, { schnellaufbau: true });
    await importiere(await oeffneListe(await listenAdresse('voll', 'Movue-CI'), 'Movue-CI'), db, () => {});
    schliesseAufbau(db);
    const ergebnis: Record<string, unknown[]> = {};
    for (const gruppe of ['ARD', 'ZDF', '3sat', 'Arte']) {
      const zeilen = db
        .prepare(`SELECT website, titel, datum FROM film WHERE gruppe LIKE ? AND variante = 0 AND dauer > 1200 ORDER BY random() LIMIT 6`)
        .all(gruppe) as { website: string; titel: string; datum: number }[];
      ergebnis[gruppe] = [];
      for (const z of zeilen) {
        try {
          const id = ardId(z.website);
          const quelle = id ? `https://api.ardmediathek.de/page-gateway/pages/ard/item/${id}?devicetype=pc&embedded=true` : z.website;
          const text = await lies(quelle);
          ergebnis[gruppe].push({ quelle, titel: z.titel, laenge: text.length, treffer: treffer(text).slice(0, 8) });
        } catch (e) {
          ergebnis[gruppe].push({ website: z.website, fehler: String(e) });
        }
      }
    }
    const gruppen = db.prepare(`SELECT gruppe, COUNT(*) n FROM film GROUP BY gruppe`).all();
    console.log('ABLAUF-PROBE ' + JSON.stringify({ gruppen, ergebnis }));
    db.close();
  } finally {
    rmSync(ordner, { recursive: true, force: true });
  }
});
