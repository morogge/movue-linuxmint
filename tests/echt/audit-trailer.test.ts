import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'vitest';

// Erkundung 2: Videoadresse eines ZDF-Trailers von der Seite der Reihe; Trailer-Feld bei Arte
const ZIEL = join(__dirname, '../../test-results/audit');
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const ARTE = '112907-186-A 112907-187-A 135967-000-A 135997-000-A 129043-222-A 129043-220-A 129043-221-A 126925-147-A'.split(' ');

async function text(url: string): Promise<{ status: number; url: string; text: string }> {
  const a = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  return { status: a.status, url: a.url, text: await a.text() };
}

function zeige(name: string, t: string, muster: RegExp, n = 8) {
  for (const m of [...t.matchAll(muster)].slice(0, n)) console.log(`  ${name} …${t.slice(Math.max(0, m.index! - 150), m.index! + 250).replace(/\s+/g, ' ')}…`);
}

describe('Trailer-Erkundung 2', () => {
  it('ZDF: Trailer-Seite und Videoadresse', async () => {
    mkdirSync(ZIEL, { recursive: true });
    const reihe = await text('https://www.zdf.de/serien/under-salt-marsh-tod-in-den-salzwiesen-100');
    const links = [...new Set([...reihe.text.matchAll(/href="([^"]*trailer[^"]*)"/gi)].map((m) => m[1]))];
    console.log('ZDF-LINKS', JSON.stringify(links));
    const ziel = links[0] ? new URL(links[0], 'https://www.zdf.de').toString() : null;
    if (!ziel) return;
    const seite = await text(ziel);
    writeFileSync(join(ZIEL, 'zdf-trailer.txt'), `${seite.status} ${seite.url}\n${seite.text}`);
    console.log('ZDF-TRAILER', seite.status, seite.url, seite.text.length);
    zeige('ZDF', seite.text, /\.mp4|\.m3u8|ptmd|apiToken|api\.zdf\.de|"mediaType"|streams/gi, 12);
  }, 60_000);

  it('Arte: Trailer-Feld im Player', async () => {
    for (const id of ARTE) {
      const c = await text(`https://api.arte.tv/api/player/v2/config/de/${id}`);
      const tr = /"trailer":(null|\{[^}]*\}[^}]*\})/.exec(c.text)?.[1];
      console.log('ARTE', id, c.status, 'trailer=', tr?.slice(0, 400));
      if (tr && tr !== 'null') writeFileSync(join(ZIEL, `arte-${id}.json`), c.text);
    }
  }, 60_000);
});
