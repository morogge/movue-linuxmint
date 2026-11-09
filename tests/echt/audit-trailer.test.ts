import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'vitest';

// Erkundung: Nennen die Seiten der Reihen bei ZDF, 3sat und Arte einen Trailer?
const ZIEL = join(__dirname, '../../test-results/audit');
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const SEITEN: Record<string, string> = {
  'zdf-reihe': 'https://www.zdf.de/serien/under-salt-marsh-tod-in-den-salzwiesen-100',
  'zdf-reihe2': 'https://www.zdf.de/serien/about-saturday',
  'dreisat-reihe': 'https://www.3sat.de/film/alles-finster',
  'arte-folge': 'https://www.arte.tv/de/videos/065287-003-A/zimmer-108-3-10/',
  'arte-api': 'https://www.arte.tv/api/rproxy/emac/v4/de/web/programs/065287-003-A',
  'arte-player': 'https://api.arte.tv/api/player/v2/config/de/065287-003-A'
};

describe('Trailer-Erkundung', () => {
  it('lädt die Seiten und zeigt Fundstellen', async () => {
    mkdirSync(ZIEL, { recursive: true });
    for (const [name, url] of Object.entries(SEITEN)) {
      try {
        const a = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/json' }, redirect: 'follow' });
        const text = await a.text();
        writeFileSync(join(ZIEL, `${name}.txt`), `${a.status} ${a.url}\n${text}`);
        const funde = [...text.matchAll(/trailer|teaser|vorschau/gi)].slice(0, 8).map((m) => text.slice(Math.max(0, m.index! - 120), m.index! + 160).replace(/\s+/g, ' '));
        console.log(`SEITE ${name} ${a.status} ${text.length} Zeichen, ${[...text.matchAll(/trailer/gi)].length}× trailer`);
        for (const f of funde) console.log(`  …${f}…`);
      } catch (e) {
        console.log(`SEITE ${name} FEHLER ${String(e)}`);
      }
    }
  }, 120_000);
});
