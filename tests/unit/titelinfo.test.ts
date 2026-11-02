import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { titelKern } from '@shared/titelinfo';
import { auchBei, filmNachId, oeffneDb, schliesseAufbau, schreiber, suche, type Db } from '../../src/main/index/datenbank';
import type { FilmEintrag } from '../../src/main/filmliste/eintrag';
import { ardSerienBild } from '../../src/main/bilder';
import { leseTitelInfo, hatBesetzung, TitelInfoDienst } from '../../src/main/titelinfo';

describe('Besetzung von der Sendungsseite', () => {
  it('liest die Darsteller-Liste des ZDF („Rolle - Name“)', () => {
    const html =
      '<div>…</div><h2 class="h1fxlzxk tyrgmig">Darsteller</h2><div class="p4fzw5k"><ul>' +
      '<li><span>Martin Beck - Peter Haber</span></li><li><span>Josef Eriksson - Martin Wallström</span></li>' +
      '<li><span>Tom/Berit - Anders Baasmo</span></li></ul></div><h2 class="x">Stab</h2><div><ul>' +
      '<li><span>Regie - Kjell Sundvall</span></li><li><span>Drehbuch: Rolf B&ouml;rjlind</span></li></ul></div><h2>Mehr</h2><ul><li>Nicht dazu</li></ul>';
    const info = leseTitelInfo(html);
    expect(info.darsteller).toEqual([
      { rolle: 'Martin Beck', name: 'Peter Haber' },
      { rolle: 'Josef Eriksson', name: 'Martin Wallström' },
      { rolle: 'Tom/Berit', name: 'Anders Baasmo' }
    ]);
    expect(info.stab).toEqual([
      { rolle: 'Regie', name: 'Kjell Sundvall' },
      { rolle: 'Drehbuch', name: 'Rolf Börjlind' }
    ]);
  });

  it('versteht auch Definitionslisten und Zeilen (3sat)', () => {
    const dl = '<h2 class="a--headline level-2 ">Darsteller</h2> </div> <dl><dt>Lena</dt> <dd>Anna Schudt</dd><dt>Max</dt><dd>Tom Wlaschiha</dd></dl>';
    expect(leseTitelInfo(dl).darsteller).toEqual([
      { rolle: 'Lena', name: 'Anna Schudt' },
      { rolle: 'Max', name: 'Tom Wlaschiha' }
    ]);
    const zeilen = '<h2>Darsteller</h2><p>Lena - Anna Schudt<br>Max - Tom Wlaschiha</p>';
    expect(leseTitelInfo(zeilen).darsteller).toHaveLength(2);
    expect(leseTitelInfo('<h2>Inhalt</h2><p>Nichts</p>')).toEqual({ darsteller: [], stab: [] });
  });

  it('fragt nur bei Sendern mit Besetzungsliste und merkt sich das Ergebnis', async () => {
    expect(hatBesetzung('https://www.zdf.de/video/serien/x')).toBe(true);
    expect(hatBesetzung('https://www.3sat.de/film/x.html')).toBe(true);
    expect(hatBesetzung('https://www.ardmediathek.de/video/x')).toBe(false);
    const ordner = mkdtempSync(join(tmpdir(), 'movue-info-'));
    let anfragen = 0;
    const dienst = new TitelInfoDienst(join(ordner, 'infos.db'), async () => {
      anfragen++;
      return { darsteller: [{ rolle: 'A', name: 'B' }], stab: [] };
    });
    try {
      const [a, b] = await Promise.all([dienst.hole('https://www.zdf.de/a'), dienst.hole('https://www.zdf.de/a')]);
      expect(a?.darsteller[0].name).toBe('B');
      expect(b).toEqual(a);
      await dienst.hole('https://www.zdf.de/a');
      expect(anfragen).toBe(1);
    } finally {
      dienst.schliessen();
      rmSync(ordner, { recursive: true, force: true });
    }
  });
});

describe('Titelbild der Serie (ARD)', () => {
  it('findet das Bild der Sendereihe im gewünschten Format', () => {
    const json = {
      widgets: [
        {
          image: { src: 'https://api.ardmediathek.de/image-service/images/urn:ard:image:folge?w={width}' },
          show: {
            id: 'x',
            images: {
              '16x9': { src: 'https://api.ardmediathek.de/image-service/images/urn:ard:image:a?w={width}&ch=1', aspectRatio: '16x9' },
              '16x7': { src: 'https://api.ardmediathek.de/image-service/images/urn:ard:image:b?w={width}&ch=2', aspectRatio: '16x7' }
            }
          }
        }
      ]
    };
    expect(ardSerienBild(json, '16x9')).toContain('urn:ard:image:a');
    expect(ardSerienBild(json, '16x7')).toContain('urn:ard:image:b');
    expect(ardSerienBild({ widgets: [{ show: { images: { aspect16x9: { src: 'https://x/y' } } } }] }, '16x9')).toBe('https://x/y');
    expect(ardSerienBild({ widgets: [] }, '16x9')).toBeNull();
  });
});

describe('Dieselbe Sendung bei anderen Sendern', () => {
  let ordner: string;
  let db: Db;

  const eintrag = (e: Partial<FilmEintrag>): FilmEintrag => ({
    sender: 'ARD',
    gruppe: 'ARD',
    thema: 'Filme im Ersten',
    titel: 'Sprachlos in Irland',
    datum: 1_793_000_000,
    dauer: 5340,
    beschreibung: '',
    website: '',
    url: `https://cdn.example.org/${Math.random()}.mp4`,
    urlKlein: '',
    urlHd: '',
    urlUntertitel: '',
    geo: '',
    neu: false,
    genres: ['film'],
    ...e
  });

  beforeEach(() => {
    ordner = mkdtempSync(join(tmpdir(), 'movue-auchbei-'));
    const pfad = join(ordner, 'index.db');
    const aufbau = oeffneDb(pfad, { schnellaufbau: true });
    const schreibe = schreiber(aufbau);
    schreibe(eintrag({}));
    schreibe(eintrag({ sender: '3Sat', gruppe: '3sat', thema: 'Fernsehfilm', titel: 'Sprachlos in Irland - Fernsehfilm, Deutschland 2020', dauer: 5300 }));
    schreibe(eintrag({ sender: '3Sat', gruppe: '3sat', thema: 'Fernsehfilm', titel: 'Sprachlos in Irland (Audiodeskription)', dauer: 5300 }));
    schreibe(eintrag({ sender: 'ZDF', gruppe: 'ZDF', thema: 'Doku', titel: 'Sprachlos in Irland', dauer: 1700 }));
    schreibe(eintrag({ sender: 'ARTE.DE', gruppe: 'Arte', thema: 'Film', titel: 'Sprachlos', dauer: 5340 }));
    schreibe(eintrag({ thema: 'Krimi', titel: 'Schiffbruch (S01/E21)', dauer: 2700 }));
    schreibe(eintrag({ sender: 'ZDF', gruppe: 'ZDF', thema: 'Andere Serie', titel: 'Schiffbruch (S03/E02)', dauer: 2700 }));
    schliesseAufbau(aufbau);
    aufbau.close();
    db = oeffneDb(pfad);
  });

  afterEach(() => {
    db.close();
    rmSync(ordner, { recursive: true, force: true });
  });

  it('findet den Film bei 3sat, aber keine andere Länge und keinen anderen Titel', () => {
    const ard = suche(db, { text: 'sprachlos irland', gruppe: 'ARD' }).treffer[0];
    const andere = auchBei(db, filmNachId(db, ard.id)!);
    expect(andere.map((f) => f.gruppe)).toEqual(['3sat']);
    expect(andere[0].titel).toBe('Sprachlos in Irland - Fernsehfilm, Deutschland 2020');
  });

  it('hält gleich betitelte, aber verschiedene Folgen auseinander', () => {
    const ard = suche(db, { text: 'schiffbruch', gruppe: 'ARD' }).treffer[0];
    expect(auchBei(db, filmNachId(db, ard.id)!)).toEqual([]);
  });

  it('vergleicht Titel ohne Zusätze wie „Fernsehfilm, Deutschland 2020“', () => {
    expect(titelKern('Sprachlos in Irland - Fernsehfilm, Deutschland 2020')).toBe('sprachlos in irland');
    expect(titelKern('Der Rosengarten von Madame Vernet - Spielfilm, Frankreich 2020')).toBe('der rosengarten von madame vernet');
    expect(titelKern('Das weiße Haus am Rhein (2/2)')).toBe('das weiße haus am rhein');
  });
});
