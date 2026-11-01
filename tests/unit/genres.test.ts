import { describe, expect, it } from 'vitest';
import { bestimmeGenres } from '../../src/main/genre/regeln';
import { GENRES } from '@shared/genres';

const g = (sender: string, thema: string, titel: string, website = '') =>
  bestimmeGenres({ sender, thema, titel, website, dauer: 0 });

describe('Genre-Regeln', () => {
  it('erkennt bekannte Reihen', () => {
    expect(g('ARD', 'Tatort', 'Gier')).toContain('krimi');
    expect(g('ZDF', 'Terra X', 'Die Ostsee')).toContain('wissen');
    expect(g('ARD', 'extra 3', 'Folge vom 18.08.')).toContain('comedy');
    expect(g('ARD', 'tagesschau', 'tagesschau 20:00 Uhr')).toContain('nachrichten');
    expect(g('ARD', 'Unser Sandmännchen', 'Moppi')).toContain('kinder');
    expect(g('ONE', 'Sturm der Liebe', 'Folge 4200')).toEqual(['serie']);
  });

  it('nutzt Website-Pfade von ZDF und 3sat', () => {
    expect(g('ZDF', 'Irgendwas', 'Titel', 'https://www.zdf.de/dokumentation/xy-100.html')).toContain('doku');
    expect(g('3Sat', 'Irgendwas', 'Titel', 'https://www.3sat.de/kultur/xy-100.html')).toContain('kultur');
    expect(g('ZDF', 'Irgendwas', 'Titel', 'https://www.zdf.de/kinder/xy-100.html')).toContain('kinder');
  });

  it('nutzt den Sender', () => {
    expect(g('ZDF-tivi', 'Vegesaurier', 'Schlaflos (S01/E07)')).toContain('kinder');
    expect(g('tagesschau24', 'tagesschau24', 'Irgendein Beitrag')).toContain('nachrichten');
  });

  it('erkennt Spielfilme und Serienfolgen am Titel', () => {
    expect(g('3Sat', 'Spielfilm', 'Ein unmoralisches Angebot - Spielfilm, USA 1993')).toContain('film');
    expect(g('ZDF', 'Die WG', 'Folge (S02/E18)')).toContain('serie');
    expect(g('ZDF', 'Filme', 'Tides')).toContain('film');
  });

  it('vermeidet bekannte Fehlgriffe', () => {
    expect(g('SWR', 'SWR Aktuell Rheinland-Pfalz', 'Sendung 18:00 Uhr')).not.toContain('reise');
    expect(g('ONE', 'Sturm der Liebe', 'Countdown #3: Johann Schuler')).not.toContain('kinder');
    expect(g('ZDF', 'heute journal update', 'Historisches Abkommen')).not.toContain('geschichte');
    expect(g('ZDF', 'aspekte', 'Wer sind sie (S2026/E12)')).not.toContain('serie');
    expect(g('ARTE.DE', 'Fernsehfilme und Serien - Serien', 'Loulou - Staffel 1')).toEqual(['serie']);
  });

  it('gibt immer mindestens ein Genre zurück', () => {
    expect(g('ARD', 'Beiträge', 'Ohne Hinweis')).toEqual(['sonstiges']);
  });

  it('liefert nur bekannte Genre-Kennungen', () => {
    const ids = new Set(GENRES.map((x) => x.id));
    for (const x of g('ZDF', 'Terra X History', 'Krimi im Mittelalter (S01/E02)', 'https://www.zdf.de/dokumentation/x')) {
      expect(ids.has(x)).toBe(true);
    }
  });
});
