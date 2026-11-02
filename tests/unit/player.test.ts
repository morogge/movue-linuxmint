import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Film } from '@shared/film';
import { adresseFuer, folgenNummer, formatZeit, naechsteFolge, qualitaeten } from '@shared/player';
import { matchShortcut } from '@shared/shortcuts';
import { NutzerDb } from '../../src/main/nutzer';
import { ttmlZeit, ttmlZuVtt } from '../../src/main/untertitel';

const film = (id: number, titel: string, datum: number, extra: Partial<Film> = {}): Film => ({
  id,
  sender: 'ZDF',
  gruppe: 'ZDF',
  thema: 'Reihe',
  titel,
  datum,
  dauer: 2700,
  beschreibung: '',
  website: '',
  url: `https://v.de/${id}.mp4`,
  urlKlein: '',
  urlHd: '',
  urlUntertitel: '',
  geo: '',
  genres: [],
  ...extra
});

describe('Untertitel', () => {
  it('liest TTML-Zeitangaben', () => {
    expect(ttmlZeit('00:00:01.680')).toBeCloseTo(1.68);
    expect(ttmlZeit('01:02:03')).toBe(3723);
    expect(ttmlZeit('00:00:02:12')).toBeCloseTo(2.48);
    expect(ttmlZeit('62.5s')).toBe(62.5);
    expect(ttmlZeit('1500ms')).toBe(1.5);
    expect(ttmlZeit('quatsch')).toBeNull();
  });

  it('wandelt EBU-TT der ARD in WebVTT', () => {
    const xml = `<tt:tt xmlns:tt="http://www.w3.org/ns/ttml"><tt:body><tt:div>
      <tt:p xml:id="C1" region="R1" begin="00:00:00.400" end="00:00:01.560">
<tt:span style="S3">Nette Preise.</tt:span>
</tt:p>
<tt:p xml:id="C2" begin="00:00:01.680" end="00:00:04.000">
<tt:span style="S3">Umso spannender also,</tt:span>
<tt:br />
<tt:span style="S3">ob das &quot;Influencer-Zeug&quot; &amp; so</tt:span>
</tt:p></tt:div></tt:body></tt:tt>`;
    expect(ttmlZuVtt(xml)).toBe(
      'WEBVTT\n\n00:00:00.400 --> 00:00:01.560\nNette Preise.\n\n00:00:01.680 --> 00:00:04.000\nUmso spannender also,\nob das "Influencer-Zeug" & so\n'
    );
  });

  it('wandelt TTML ohne Namensraum-Präfix (ZDF)', () => {
    const xml = '<tt><body><div><p begin="00:01:00.000" end="00:01:02.000"><span>Hallo</span></p></div></body></tt>';
    expect(ttmlZuVtt(xml)).toContain('00:01:00.000 --> 00:01:02.000\nHallo');
  });

  it('liefert null ohne brauchbare Zeilen', () => {
    expect(ttmlZuVtt('<tt></tt>')).toBeNull();
  });
});

describe('Qualität und nächste Folge', () => {
  it('kennt die Qualitäten und fällt auf Standard zurück', () => {
    const f = film(1, 'a', 0, { urlHd: 'https://v.de/hd.mp4', urlKlein: 'https://v.de/sd.mp4' });
    expect(qualitaeten(f).map((q) => q.id)).toEqual(['hd', 'standard', 'sd']);
    expect(adresseFuer(film(2, 'b', 0), 'hd')).toEqual({ id: 'standard', url: 'https://v.de/2.mp4' });
  });

  it('nimmt bei Serien die nächste Staffel/Folge', () => {
    const a = film(1, 'Pilot (S01/E01)', 300);
    const folgen = [film(3, 'Drei (S01/E03)', 100), film(2, 'Zwei (S01/E02)', 200), film(4, 'Neu (S02/E01)', 50), a];
    expect(folgenNummer(a.titel)).toEqual([1, 1]);
    expect(naechsteFolge(a, folgen)?.id).toBe(2);
    expect(naechsteFolge(folgen[0], folgen)?.id).toBe(4); // S01/E03 → S02/E01
  });

  it('nimmt sonst die nächst-neuere Sendung', () => {
    const a = film(1, 'Montag', 100);
    const folgen = [film(2, 'Mittwoch', 300), film(3, 'Dienstag', 200), film(4, 'Sonntag', 50), a];
    expect(naechsteFolge(a, folgen)?.id).toBe(3);
    expect(naechsteFolge(folgen[0], folgen)).toBeNull();
  });

  it('formatiert Zeiten', () => {
    expect(formatZeit(65)).toBe('1:05');
    expect(formatZeit(3725)).toBe('1:02:05');
    expect(formatZeit(Number.NaN)).toBe('0:00');
  });
});

describe('Tastenkürzel im Player', () => {
  const k = (key: string) => ({ key, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });

  it('gelten nur im Player', () => {
    expect(matchShortcut(k(' '), 'player')).toBe('abspielen');
    expect(matchShortcut(k('ArrowLeft'), 'player')).toBe('zurueckspulen');
    expect(matchShortcut(k('f'), 'player')).toBe('vollbild');
    expect(matchShortcut(k(' '))).toBeNull();
    expect(matchShortcut(k('F1'), 'player')).toBeNull();
  });
});

describe('Weiterschauen', () => {
  it('merkt sich Positionen und listet angefangene Videos', () => {
    const ordner = mkdtempSync(join(tmpdir(), 'movue-nutzer-'));
    const db = new NutzerDb(join(ordner, 'n.db'));
    db.setzeFortschritt('https://v.de/a.mp4', 600, 2700, 1000);
    db.setzeFortschritt('https://v.de/b.mp4', 10, 2700, 2000); // kaum angefangen
    db.setzeFortschritt('https://v.de/c.mp4', 2690, 2700, 3000); // zu Ende
    db.setzeFortschritt('https://v.de/d.mp4', 1200, 2700, 4000);
    expect(db.fortschritt('https://v.de/a.mp4')?.position).toBe(600);
    expect(db.angefangen().map((f) => f.url)).toEqual(['https://v.de/d.mp4', 'https://v.de/a.mp4']);
    db.vergessen('https://v.de/d.mp4');
    expect(db.angefangen().map((f) => f.url)).toEqual(['https://v.de/a.mp4']);
    db.schliessen();
    rmSync(ordner, { recursive: true, force: true });
  });
});
