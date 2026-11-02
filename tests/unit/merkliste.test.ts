import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Film } from '@shared/film';
import { aboMeldung, formatAblauf, laeuftBaldAb } from '@shared/nutzer';
import { NutzerDb } from '../../src/main/nutzer';
import { AblaufDienst, ablaufAusArd, ablaufAusSeite, mussPruefen } from '../../src/main/ablauf';

const TAG = 86_400_000;

const film = (url: string, titel = 'Titel'): Film => ({
  id: 1,
  sender: 'ZDF',
  gruppe: 'ZDF',
  thema: 'Terra X',
  titel,
  datum: 1_700_000_000,
  dauer: 2700,
  beschreibung: '',
  website: 'https://www.zdf.de/x',
  url,
  urlKlein: '',
  urlHd: '',
  urlUntertitel: '',
  geo: '',
  genres: [],
  staffel: null,
  folge: null,
  extra: false,
  serieId: null
});

let ordner: string;
let db: NutzerDb;

beforeEach(() => {
  ordner = mkdtempSync(join(tmpdir(), 'movue-nutzer-'));
  db = new NutzerDb(join(ordner, 'nutzer.db'));
});

afterEach(() => {
  db.schliessen();
  rmSync(ordner, { recursive: true, force: true });
});

describe('Merkliste', () => {
  it('merkt, listet (neueste zuerst) und entfernt Sendungen', () => {
    db.merken(film('a.mp4', 'Erste'), 1000);
    db.merken(film('b.mp4', 'Zweite'), 2000);
    expect(db.istGemerkt('a.mp4')).toBe(true);
    expect(db.merkliste().map((e) => e.film.titel)).toEqual(['Zweite', 'Erste']);
    db.entmerken('a.mp4');
    expect(db.istGemerkt('a.mp4')).toBe(false);
    expect(db.merkliste()).toHaveLength(1);
  });

  it('merkt dieselbe Sendung nur einmal', () => {
    db.merken(film('a.mp4'), 1000);
    db.merken(film('a.mp4', 'Neuer Titel'), 3000);
    const liste = db.merkliste();
    expect(liste).toHaveLength(1);
    expect(liste[0].film.titel).toBe('Neuer Titel');
    expect(liste[0].zeit).toBe(1000);
  });
});

describe('Abos', () => {
  it('meldet nur Folgen nach dem letzten Besuch bzw. der letzten Meldung', () => {
    db.abonnieren('ZDF', 'Terra X', 100, 5);
    expect(db.abo('ZDF', 'Terra X')).toMatchObject({ gesehen: 100, gemeldet: 100, seit: 5 });
    db.aboGemeldet('ZDF', 'Terra X', 200);
    expect(db.abo('ZDF', 'Terra X')).toMatchObject({ gesehen: 100, gemeldet: 200 });
    db.aboGesehen('ZDF', 'Terra X', 300);
    expect(db.abo('ZDF', 'Terra X')).toMatchObject({ gesehen: 300, gemeldet: 300 });
    // Ältere Angaben setzen nichts zurück
    db.aboGesehen('ZDF', 'Terra X', 50);
    expect(db.abo('ZDF', 'Terra X')?.gesehen).toBe(300);
  });

  it('abonniert eine Reihe nur einmal und bestellt sie wieder ab', () => {
    db.abonnieren('ZDF', 'Terra X', 100);
    db.abonnieren('ZDF', 'Terra X', 999);
    db.abonnieren('ARD', 'Tatort', 100);
    expect(db.abos().map((a) => a.thema)).toEqual(['Tatort', 'Terra X']);
    expect(db.abo('ZDF', 'Terra X')?.gesehen).toBe(100);
    db.abbestellen('ZDF', 'Terra X');
    expect(db.abo('ZDF', 'Terra X')).toBeNull();
  });

  it('fasst neue Folgen für die Benachrichtigung zusammen', () => {
    expect(aboMeldung([{ thema: 'Tatort', neu: 0 }])).toBeNull();
    expect(aboMeldung([{ thema: 'Tatort', neu: 1 }])?.titel).toBe('1 neue Folge: Tatort');
    const viele = aboMeldung([
      { thema: 'A', neu: 2 },
      { thema: 'B', neu: 1 },
      { thema: 'C', neu: 1 },
      { thema: 'D', neu: 1 }
    ]);
    expect(viele).toEqual({ titel: '5 neue Folgen in deinen Abos', text: 'A, B, C und 1 weitere' });
  });
});

describe('Ablaufdatum', () => {
  it('liest das Datum aus der ARD-Schnittstelle', () => {
    expect(ablaufAusArd('{"x":1,"availableTo":"2028-08-15T13:45:00Z","y":2}')).toBe(Date.parse('2028-08-15T13:45:00Z'));
    expect(ablaufAusArd('{"availableTo":null}')).toBeNull();
  });

  it('liest das Datum aus den Seiten von ZDF, 3sat und Arte', () => {
    const zdf = '<svg></svg><p>Verfügbar bis <time dateTime="2026-11-09T22:59:00.000Z">09.11.2026</time></p>';
    expect(ablaufAusSeite(zdf)).toBe(Date.parse('2026-11-09T22:59:00.000Z'));
    expect(ablaufAusSeite('{"uploadDate":"x","expires":"2027-11-04T22:59:00.000000+00:00"}')).toBe(Date.parse('2027-11-04T22:59:00.000000+00:00'));
    const dreisat = '<dt class="attribute-list-title visuallyhidden">Verfügbar bis: </dt> <dd class="attribute-list-description">09.11.2026</dd>';
    expect(ablaufAusSeite(dreisat)).toBe(Date.UTC(2026, 10, 9, 21, 59));
    const arte = '<p class="ds-6406tu">Verfügbar bis zum 18/11/2026</p> … \\"formatted_until\\":\\"Verfügbar bis zum {{date}}\\"';
    expect(ablaufAusSeite(arte)).toBe(Date.UTC(2026, 10, 18, 21, 59));
    expect(ablaufAusSeite('<html>nichts</html>')).toBeNull();
    expect(ablaufAusSeite('{"expires":null}')).toBeNull();
  });

  it('fragt kurz vor dem Ende öfter nach', () => {
    const jetzt = Date.UTC(2026, 10, 1);
    expect(mussPruefen(null, jetzt)).toBe(true);
    expect(mussPruefen({ bis: jetzt + 60 * TAG, weg: false, geprueft: jetzt - 2 * TAG }, jetzt)).toBe(false);
    expect(mussPruefen({ bis: jetzt + 60 * TAG, weg: false, geprueft: jetzt - 8 * TAG }, jetzt)).toBe(true);
    expect(mussPruefen({ bis: jetzt + 5 * TAG, weg: false, geprueft: jetzt - 2 * TAG }, jetzt)).toBe(true);
    expect(mussPruefen({ bis: jetzt + 5 * TAG, weg: false, geprueft: jetzt - 3600_000 }, jetzt)).toBe(false);
  });

  it('beschreibt die Restzeit verständlich', () => {
    const jetzt = new Date(2026, 10, 1, 12).getTime();
    expect(formatAblauf({ bis: new Date(2026, 10, 1, 23, 59).getTime(), weg: false }, jetzt)).toBe('nur noch heute');
    expect(formatAblauf({ bis: new Date(2026, 10, 2, 23, 59).getTime(), weg: false }, jetzt)).toBe('nur noch bis morgen');
    expect(formatAblauf({ bis: new Date(2026, 10, 4, 23, 59).getTime(), weg: false }, jetzt)).toBe('noch 3 Tage');
    expect(formatAblauf({ bis: new Date(2027, 0, 31, 23, 59).getTime(), weg: false }, jetzt)).toBe('bis 31.01.2027');
    expect(formatAblauf({ bis: null, weg: true }, jetzt)).toBe('nicht mehr verfügbar');
    expect(formatAblauf({ bis: null, weg: false }, jetzt)).toBeNull();
    expect(laeuftBaldAb({ bis: jetzt + 3 * TAG, weg: false }, jetzt)).toBe(true);
    expect(laeuftBaldAb({ bis: jetzt + 30 * TAG, weg: false }, jetzt)).toBe(false);
    expect(laeuftBaldAb({ bis: jetzt - TAG, weg: false }, jetzt)).toBe(false);
  });

  it('speichert Ergebnisse und fragt nicht doppelt', async () => {
    let anfragen = 0;
    const dienst = new AblaufDienst(db, async () => {
      anfragen++;
      return { bis: Date.now() + 60 * TAG, weg: false };
    });
    const f = film('c.mp4');
    const [a, b] = await Promise.all([dienst.hole(f), dienst.hole(f)]);
    expect(a?.bis).toBeGreaterThan(Date.now());
    expect(b).toEqual(a);
    expect(anfragen).toBe(1);
    await dienst.hole(f);
    expect(anfragen).toBe(1);
    expect(dienst.bekannt(f)?.weg).toBe(false);
  });

  it('bleibt bei Netzfehlern ruhig', async () => {
    const dienst = new AblaufDienst(db, async () => {
      throw new Error('offline');
    });
    expect(await dienst.hole(film('d.mp4'))).toBeNull();
  });
});
