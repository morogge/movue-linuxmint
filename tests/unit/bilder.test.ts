import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ardId, BildDienst, bildMitErsatz, extrahiereOgImage, verkleinere } from '../../src/main/bilder';

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

  it('fragt den Trailer einer Reihe bei ARD und ZDF einmal und merkt sich auch „keiner“', async () => {
    ordner = mkdtempSync(join(tmpdir(), 'movue-bilder-'));
    const gefragt: string[] = [];
    const dienst = new BildDienst(
      join(ordner, 'b.db'),
      async () => null,
      async () => null,
      async (website) => {
        gefragt.push(website);
        return website.includes('Y3JpZDovL21pdC10cmFpbGVy') || website.includes('mit-trailer') ? { titel: 'Trailer', url: 'https://ard.de/t.mp4', dauer: 38 } : null;
      }
    );
    const mit = 'https://www.ardmediathek.de/video/Y3JpZDovL21pdC10cmFpbGVy';
    const ohne = 'https://www.ardmediathek.de/video/Y3JpZDovL29obmUtdHJhaWxlcg';
    expect(await dienst.reihenTrailer(mit)).toEqual({ titel: 'Trailer', url: 'https://ard.de/t.mp4', dauer: 38 });
    expect(await dienst.reihenTrailer(mit)).toEqual({ titel: 'Trailer', url: 'https://ard.de/t.mp4', dauer: 38 });
    expect(await dienst.reihenTrailer(ohne)).toBeNull();
    expect(await dienst.reihenTrailer(ohne)).toBeNull();
    // ZDF: über die Seite der Reihe, je Reihe einmal (zwei Folgen derselben Reihe teilen sich den Eintrag)
    expect(await dienst.reihenTrailer('https://www.zdf.de/video/serien/mit-trailer-100/folge-1-100')).not.toBeNull();
    expect(await dienst.reihenTrailer('https://www.zdf.de/video/serien/mit-trailer-100/folge-2-100')).not.toBeNull();
    // Arte und Co.: gar nicht fragen
    expect(await dienst.reihenTrailer('https://www.arte.tv/de/videos/123456-001-A/x/')).toBeNull();
    expect(gefragt).toEqual([mit, ohne, 'https://www.zdf.de/video/serien/mit-trailer-100/folge-1-100']);
    dienst.schliessen();
  });
});

describe('Bild mit Ersatzwegen', () => {
  const film = { id: 1, website: 'https://s.de/weg', buendel: 'Kulturzeit', gruppe: '3sat' as const };
  const folgen = () => [
    { id: 1, website: 'https://s.de/weg' },
    { id: 2, website: 'https://s.de/auch-weg' },
    { id: 3, website: 'https://s.de/da' }
  ];

  it('nimmt das eigene Bild, wenn es eins gibt', async () => {
    expect(await bildMitErsatz({ ...film, website: 'https://s.de/da' }, folgen, async (w) => (w.endsWith('/da') ? 'eigen.jpg' : null))).toBe('eigen.jpg');
  });

  it('nimmt sonst das Bild einer anderen Folge derselben Serie', async () => {
    const gefragt: string[] = [];
    const url = async (w: string, art?: string) => {
      gefragt.push(`${art ?? 'folge'}:${w}`);
      return w.endsWith('/da') && !art ? 'andere.jpg' : null;
    };
    expect(await bildMitErsatz(film, folgen, url)).toBe('andere.jpg');
    expect(gefragt).toEqual(['folge:https://s.de/weg', 'folge:https://s.de/auch-weg', 'folge:https://s.de/da']);
  });

  it('nimmt zuletzt das Titelbild der Serie, bei Einzelsendungen nichts', async () => {
    expect(await bildMitErsatz(film, folgen, async (_w, art) => (art === 'serie' ? 'serie.jpg' : null))).toBe('serie.jpg');
    expect(await bildMitErsatz({ ...film, buendel: null }, folgen, async (_w, art) => (art === 'serie' ? 'serie.jpg' : null))).toBeNull();
  });
});
