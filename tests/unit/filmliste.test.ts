import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FilmlistenParser } from '../../src/main/filmliste/parser';
import { EintragsLeser, erweitereUrl, parseDauer, parseListenStand } from '../../src/main/filmliste/eintrag';

const fixture = readFileSync(join(__dirname, '../fixtures/filmliste-mini.json'));

function parse(buf: Buffer, stueck: number): [string, string[]][] {
  const arrays: [string, string[]][] = [];
  const p = new FilmlistenParser((key, values) => arrays.push([key, values]));
  for (let i = 0; i < buf.length; i += stueck) p.push(buf.subarray(i, i + stueck));
  p.end();
  return arrays;
}

describe('FilmlistenParser', () => {
  it('liest alle Arrays samt doppelter Schlüssel', () => {
    const arrays = parse(fixture, 64 * 1024);
    expect(arrays.map(([k]) => k)).toEqual(['Filmliste', 'Filmliste', ...Array(8).fill('X')]);
    expect(arrays[0][1][1]).toBe('01.11.2026, 17:19');
    expect(arrays[2][1]).toHaveLength(20);
  });

  it('liefert dasselbe Ergebnis, egal wie die Daten gestückelt ankommen', () => {
    const ganz = parse(fixture, fixture.length);
    for (const stueck of [1, 2, 3, 7, 13, 100]) {
      expect(parse(fixture, stueck)).toEqual(ganz);
    }
  });

  it('dekodiert Escapes und mehrbytige UTF-8-Zeichen korrekt', () => {
    const arrays = parse(fixture, 1);
    const panorama = arrays.find(([, v]) => v[1] === 'Panorama')![1];
    expect(panorama[7]).toBe('Bericht über "Zitate" und Ärger in Kiel – mit Umlauten: äöü ß.');
  });

  it('meldet eine abgeschnittene Liste', () => {
    const p = new FilmlistenParser(() => undefined);
    p.push(Buffer.from('{"X":["abc'));
    expect(() => p.end()).toThrow();
  });
});

describe('EintragsLeser', () => {
  const zeilen = parse(fixture, 4096)
    .filter(([k]) => k === 'X')
    .map(([, v]) => v);

  it('übernimmt leere Sender- und Themenfelder aus der Zeile davor', () => {
    const leser = new EintragsLeser();
    const eintraege = zeilen.map((z) => leser.lies(z));
    expect(eintraege[1]).toMatchObject({ sender: 'ARD', gruppe: 'ARD', thema: 'Tatort', titel: 'Tatort: Zweiter Fall' });
  });

  it('ordnet Landesrundfunkanstalten der ARD zu und lässt fremde Sender weg', () => {
    const leser = new EintragsLeser();
    const eintraege = zeilen.map((z) => leser.lies(z));
    expect(eintraege[2]).toMatchObject({ sender: 'NDR', gruppe: 'ARD' });
    expect(eintraege[4]).toMatchObject({ sender: '3Sat', gruppe: '3sat' });
    expect(eintraege[5]).toMatchObject({ sender: 'ARTE.DE', gruppe: 'Arte' });
    expect(eintraege[6]).toBeNull(); // ORF
    expect(eintraege[7]).toBeNull(); // ARTE.FR
  });

  it('wandelt Datum, Dauer und Adressen um', () => {
    const e = new EintragsLeser().lies(zeilen[0])!;
    expect(e.datum).toBe(1793045700);
    expect(e.dauer).toBe(88 * 60 + 30);
    expect(e.urlKlein).toBe(e.url.slice(0, 26) + 'tatort1_sd.mp4');
    expect(e.urlUntertitel).toBe('https://cdn.example.org/ard/tatort1.vtt');
    expect(e.geo).toBe('DE');
  });
});

describe('Hilfsfunktionen', () => {
  it('erweitereUrl', () => {
    expect(erweitereUrl('https://a.de/x/film_hd.mp4', '15|film_sd.mp4')).toBe('https://a.de/x/film_sd.mp4');
    expect(erweitereUrl('https://a.de/x.mp4', '')).toBe('');
    expect(erweitereUrl('https://a.de/x.mp4', 'https://b.de/y.mp4')).toBe('https://b.de/y.mp4');
  });

  it('parseDauer', () => {
    expect(parseDauer('00:43:20')).toBe(2600);
    expect(parseDauer('43:20')).toBe(2600);
    expect(parseDauer('')).toBe(0);
    expect(parseDauer('xx')).toBe(0);
  });

  it('parseListenStand', () => {
    expect(parseListenStand('01.11.2026, 17:19')).toBe(Date.UTC(2026, 10, 1, 17, 19));
    expect(parseListenStand('kaputt')).toBeNull();
  });
});
