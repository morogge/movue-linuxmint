import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ardId, BildDienst, extrahiereOgImage, verkleinere } from '../../src/main/bilder';

describe('Vorschaubilder', () => {
  it('liest og:image aus HTML', () => {
    expect(extrahiereOgImage('<meta property="og:image" content="https://a.de/b.jpg">')).toBe('https://a.de/b.jpg');
    expect(extrahiereOgImage("<meta content='https://a.de/b.jpg?x=1&amp;y=2' property='og:image' />")).toBe('https://a.de/b.jpg?x=1&y=2');
    // relative Platzhalter (z. B. 3sat bei gelöschten Seiten) sind kein Bild
    expect(extrahiereOgImage('<meta property="og:image" content="/static/img/fallback.png">')).toBeNull();
    expect(extrahiereOgImage('<html></html>')).toBeNull();
  });

  it('erkennt ARD-Kennungen', () => {
    expect(ardId('https://www.ardmediathek.de/video/Y3JpZDovL2JyLmRlL2Jyb2FkY2FzdC9GMjAyNVdPMDExMTc2QTA')).toBe(
      'Y3JpZDovL2JyLmRlL2Jyb2FkY2FzdC9GMjAyNVdPMDExMTc2QTA'
    );
    expect(ardId('https://www.ardmediathek.de/video/tatort/gier/das-erste/Y3JpZDovL2Rhc2Vyc3RlLmRlL3RhdG9ydC8xMjM')).toBe(
      'Y3JpZDovL2Rhc2Vyc3RlLmRlL3RhdG9ydC8xMjM'
    );
    expect(ardId('https://www.zdf.de/video/x')).toBeNull();
  });

  it('fordert kleinere Bilder an', () => {
    expect(verkleinere('https://api.ardmediathek.de/image-service/images/urn:ard:image:abc?w={width}&ch=1')).toBe(
      'https://api.ardmediathek.de/image-service/images/urn:ard:image:abc?w=640&ch=1'
    );
    expect(verkleinere('https://www.zdf.de/assets/x-100~1920x1080?cb=1')).toBe('https://www.zdf.de/assets/x-100~768x432?cb=1');
    expect(verkleinere('https://www.3sat.de/assets/x-100~1280x720?cb=1')).toBe('https://www.3sat.de/assets/x-100~768x432?cb=1');
  });
});

describe('BildDienst', () => {
  let ordner: string;
  afterEach(() => rmSync(ordner, { recursive: true, force: true }));

  it('fragt jede Seite nur einmal ab und merkt sich das Ergebnis', async () => {
    ordner = mkdtempSync(join(tmpdir(), 'movue-bilder-'));
    let abrufe = 0;
    const dienst = new BildDienst(join(ordner, 'b.db'), async (w) => {
      abrufe++;
      return w.includes('mit') ? 'https://bild.de/x.jpg' : null;
    });
    const [a, b] = await Promise.all([dienst.url('https://s.de/mit'), dienst.url('https://s.de/mit')]);
    expect(a).toBe('https://bild.de/x.jpg');
    expect(b).toBe('https://bild.de/x.jpg');
    expect(await dienst.url('https://s.de/mit')).toBe('https://bild.de/x.jpg');
    expect(await dienst.url('https://s.de/ohne')).toBeNull();
    expect(await dienst.url('https://s.de/ohne')).toBeNull();
    expect(abrufe).toBe(2);
    expect(await dienst.url('kaputt')).toBeNull();
    dienst.schliessen();
  });
});
