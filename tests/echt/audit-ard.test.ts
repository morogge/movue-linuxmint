import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'vitest';

// Erkundung: Wo liefert die ARD-Schnittstelle die Bilder je Staffel?
const ZIEL = join(__dirname, '../../test-results/audit');
const UA = 'Movue/0.14 (+https://github.com/morogge/movue-linuxmint)';
const FOLGEN = {
  iaf: 'Y3JpZDovL21kci5kZS9zZW5kdW5nLzI4MjA0MC81MDAyOTItNDgwNDIz'
};

async function hole(url: string): Promise<unknown> {
  const a = await fetch(url, { headers: { 'User-Agent': UA } });
  return { status: a.status, json: a.ok ? await a.json() : await a.text() };
}

describe('ARD-Staffeln', () => {
  it('lädt Item- und Show-Seiten', async () => {
    mkdirSync(ZIEL, { recursive: true });
    for (const [name, id] of Object.entries(FOLGEN)) {
      const item = (await hole(`https://api.ardmediathek.de/page-gateway/pages/ard/item/${id}?devicetype=pc&embedded=true`)) as { json: unknown };
      writeFileSync(join(ZIEL, `${name}-item.json`), JSON.stringify(item, null, 1));
      const text = JSON.stringify(item.json);
      const show = /"show":\{"id":"([^"]+)"/.exec(text)?.[1] ?? /grouping\/([A-Za-z0-9]+)/.exec(text)?.[1];
      console.log('SHOW', name, show);
      if (!show) continue;
      const g = await hole(`https://api.ardmediathek.de/page-gateway/pages/ard/grouping/${show}?devicetype=pc&embedded=true`);
      writeFileSync(join(ZIEL, `${name}-grouping.json`), JSON.stringify(g, null, 1));
      const s = await hole(`https://api.ardmediathek.de/page-gateway/pages/ard/grouping/${show}?seasoned=true&devicetype=pc&embedded=true`);
      writeFileSync(join(ZIEL, `${name}-grouping-seasoned.json`), JSON.stringify(s, null, 1));
    }
  }, 60_000);
});
