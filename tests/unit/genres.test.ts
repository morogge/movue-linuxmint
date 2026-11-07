import { describe, expect, it } from 'vitest';
import { ardQuelle, bestimmeGenres } from '../../src/main/genre/regeln';
import { GENRES } from '@shared/genres';

const g = (sender: string, thema: string, titel: string, website = '', dauer = 0, beschreibung = '') =>
  bestimmeGenres({ sender, thema, titel, website, dauer, beschreibung });
/** ARD-Adresse mit Quelle („crid://sportschau.de/…“) */
const ard = (crid: string) => `https://www.ardmediathek.de/video/${Buffer.from(crid).toString('base64url')}`;

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

  it('„quer“ ist nur als Sendung Satire, nicht als Wort im Titel', () => {
    expect(g('BR', 'quer', 'quer vom 31. Oktober 2026')).toContain('comedy');
    expect(g('3Sat', 'Länder', 'Japans Nordinsel – Einmal quer durch')).not.toContain('comedy');
  });

  it('wertet allgemeine Wörter nur im Namen der Sendung, nicht im Titel einer Folge', () => {
    // Rückmeldungen: Spielbericht, Nachrichtenclip, Krimiserie mit „Garten“ im Folgentitel
    expect(g('ZDF', 'Sport', 'Kiel schockt Hoffenheim: Sieg nach Elfmeter-Krimi', 'https://www.zdfheute.de/sport/fussball/kiel-100.html')).toEqual(['sport']);
    expect(g('ZDF', 'Politik', 'Merz: "Es ist Zeit für ein Ende dieses Krieges"', '', 139)).not.toContain('geschichte');
    expect(g('ARD', 'Ridley', 'Folge 1: Der stille Garten - Teil 1 (S01/E01)')).toEqual(expect.arrayContaining(['krimi']));
    expect(g('ARD', 'Ridley', 'Folge 1: Der stille Garten - Teil 1 (S01/E01)')).not.toContain('ratgeber');
    expect(g('ARD', 'History or Mystery - Die Burgenchallenge mit Alexander Prinz', 'Tatort-Star Davina Fox ermittelt auf der Hardenburg (S01/E02)')).not.toContain('krimi');
    // Im Namen der Sendung zählen sie weiter
    expect(g('ZDF', 'Der Zürich-Krimi', 'Borchert und die Macht der Gewohnheit')).toContain('krimi');
    expect(g('ZDF', 'Garten-Doc', 'Rosen schneiden')).toContain('ratgeber');
    // Bei Spielfilmen sagt der Titel etwas über das Genre
    expect(g('3Sat', 'Fernsehfilm', 'Mordnacht - Fernsehfilm, Deutschland 2024', 'https://www.3sat.de/film/fernsehfilm/mordnacht-100.html', 5331)).toEqual(expect.arrayContaining(['film', 'krimi']));
  });

  it('schließt widersprüchliche Genres aus', () => {
    // True Crime ist eine Doku, kein Krimi
    expect(g('3Sat', 'Dokumentarfilmzeit', 'Last Man Standing – der Mord an Tupac Shakur - Dokumentarfilm', 'https://www.3sat.de/film/dokumentarfilm/x.html', 5400)).toEqual(['doku']);
    // Ortsnamen machen einen Krimi nicht zur Reise
    expect(g('ZDF', 'Die Toten vom Bodensee', 'Die Braut (S01/E04)')).toEqual(['krimi', 'serie']);
    // Archivclips aus Retro-Reihen bleiben Geschichte, kurze Nachrichtenclips über Kriege nicht
    expect(g('ARD', 'hr Retro | hessenschau', 'Die Wende in Hessen', '', 171)).toContain('geschichte');
  });

  it('liest Quellen aus ARD- und zdfheute-Adressen', () => {
    expect(ardQuelle(ard('crid://sportschau.de/video/abc-123'))).toBe('sportschau.de');
    expect(ardQuelle('https://www.ardmediathek.de/video/kein-base64')).toBeNull();
    expect(g('ARD', 'Morgenmagazin', 'Pacers gewinnen in letzter Sekunde', ard('crid://sportschau.de/x/1234'))).toContain('sport');
    expect(g('ZDF', 'Irgendwas', 'Titel', 'https://www.zdfheute.de/politik/deutschland/x-100.html')).toContain('nachrichten');
  });

  it('ordnet frühere „Weitere Sendungen“ zu', () => {
    expect(g('SR', 'Beiträge', 'Lehrerproteste in Saarbrücken', '', 80)).toEqual(['nachrichten']);
    expect(g('ARD', 'Mittendrin - Flughafen Frankfurt', 'Alina fliegt A330neo (S12/E03)')).toEqual(['doku']);
    expect(g('ARD', 'DEIN VfB', 'Folge 12')).toContain('sport');
    expect(g('ARD', 'Wunderschön!', 'Rügen')).toContain('reise');
    expect(g('BR', 'kinokino', 'Die Filme der Woche', '', 1500)).toEqual(['kultur']);
    expect(g('ARD', 'Brisant', 'Promis am Wochenende')).not.toContain('ratgeber');
    expect(g('ZDF', 'ZDF-Mittagsmagazin', 'Neue Wasserwelt im Zoo')).not.toContain('ratgeber');
  });

  it('liest Formatangaben am Anfang der Beschreibung', () => {
    expect(g('ARD', 'Filme im Ersten', 'Das Kindermädchen', '', 5400, 'Fernsehfilm Deutschland 2021\r\n\r\nMitten am Tag')).toContain('film');
    expect(g('ARD', 'Irgendwas', 'Leben am Fluss', '', 2700, 'Doku-Serie über Menschen an der Elbe')).toContain('doku');
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
