import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { folgenInfo, gruppeVon, serieAusTitel, serienArt } from '@shared/serie';
import { genresAusWikidata, serienSchluessel } from '@shared/metadaten';
import { baueFassungen, istLive, oeffneDb, reihe, schliesseAufbau, schreiber, suche, type Db } from '../../src/main/index/datenbank';
import { artAnzahlen, baueSerien, istReihenAnfang, istRubrik, serieDetail, serieNachThema, stoebern, titelAnfang } from '../../src/main/index/serien';
import type { FilmEintrag } from '../../src/main/filmliste/eintrag';
import { buendelFormat, type GenreId } from '../../src/shared/genres';

describe('Serien aus Titeln', () => {
  it('liest Arte- und 3sat-Muster', () => {
    expect(serieAusTitel('Twin Peaks - Staffel 1 (3/8) - Zen oder die Kunst, einen Mörder zu fassen')).toEqual({ name: 'Twin Peaks', staffel: 1, folge: 3 });
    expect(serieAusTitel('The Hack (4/7)')).toEqual({ name: 'The Hack', staffel: null, folge: 4 });
    expect(serieAusTitel('Wilder: Sau, Staffel 4, Folge 1')).toEqual({ name: 'Wilder', staffel: 4, folge: 1 });
    expect(serieAusTitel('Malawi - das grüne Herz Afrikas (2/2) (Audiodeskription)')?.name).toBe('Malawi - das grüne Herz Afrikas');
    expect(serieAusTitel('Sommer auf Asphalt')).toBeNull();
  });

  it('nimmt einzelne Wörter erst bei sehr vielen Sendungen als Reihe', () => {
    expect(istReihenAnfang('360° Reportage', 3)).toBe(true);
    expect(istReihenAnfang('Brasilien', 13)).toBe(false);
    expect(istReihenAnfang('Re', 461)).toBe(true);
    expect(istReihenAnfang('Küchen der Welt', 2)).toBe(false);
  });

  it('findet gemeinsame Titelanfänge', () => {
    expect(titelAnfang('360° Reportage - Mongolei: Der Pferderetter')).toBe('360° Reportage');
    expect(titelAnfang('Re: Quallen-Flut im Mittelmeer')).toBe('Re');
    expect(titelAnfang('Berlin erleben – Der Ku’damm')).toBe('Berlin erleben');
    expect(titelAnfang('Sommer auf Asphalt')).toBeNull();
    expect(titelAnfang('Konfliktzone - Globale Krisen kurz erklärt - Sudan', 2)).toBe('Konfliktzone - Globale Krisen kurz erklärt');
    expect(titelAnfang('Israel - Welches Land wollen wir?', 2)).toBeNull();
    expect(titelAnfang('12: Die Zahl')).toBeNull();
  });
});

describe('Rubriken und Arten', () => {
  const basis = { gruppe: 'ARD', thema: 'X', n: 100, nummeriert: 0, filme: 0, kurz: 0, wiederkehrend: 0, topGenre: 1 };
  it('erkennt Rubriken, aber keine Filmreihen und Magazine', () => {
    expect(istRubrik({ ...basis, gruppe: 'Arte' })).toBe(true);
    // „Filme im Ersten“: viele Filme, gemischte Genres
    expect(istRubrik({ ...basis, filme: 80, topGenre: 0.3 })).toBe(true);
    // „Tatort“: viele Filme, alle Krimis
    expect(istRubrik({ ...basis, thema: 'Tatort', filme: 90, topGenre: 0.95 })).toBe(false);
    // „Das kleine Fernsehspiel“: Filme gemischt mit Trailern
    expect(istRubrik({ ...basis, filme: 30, kurz: 40, topGenre: 0.4 })).toBe(true);
    // „Volle Kanne vom 3. November“: Magazin
    expect(istRubrik({ ...basis, filme: 90, topGenre: 0.3, wiederkehrend: 80 })).toBe(false);
    // Sendeplatz nach Namen
    expect(istRubrik({ ...basis, thema: 'ZDFinfo Doku', topGenre: 1 })).toBe(true);
    // Nummerierte Folgen sind nie eine Rubrik
    expect(istRubrik({ ...basis, thema: 'Spielfilm-Highlights', nummeriert: 60 })).toBe(false);
  });

  it('macht Sport und Filmreihen nicht zur Serie', () => {
    const g = (genres: GenreId[]) => genres;
    expect(serienArt({ folgen: 300, nummeriert: 300, dauer: 600, genres: g(['sport']) })).toBe('reihe');
    expect(serienArt({ folgen: 50, nummeriert: 0, dauer: 5400, genres: g(['krimi', 'film']), filme: 48 })).toBe('filmreihe');
    expect(serienArt({ folgen: 50, nummeriert: 40, dauer: 2700, genres: g(['krimi']) })).toBe('serie');
    expect(serienArt({ folgen: 50, nummeriert: 0, dauer: 2700, genres: g(['serie']) })).toBe('serie');
    expect(serienArt({ folgen: 50, nummeriert: 0, dauer: 6000, genres: g(['serie']) })).toBe('reihe');
    // Doku-Serie mit Staffeln („Mittendrin – Flughafen Frankfurt“) bleibt Sendereihe
    expect(serienArt({ folgen: 100, nummeriert: 100, dauer: 1800, genres: g(['doku']) })).toBe('reihe');
    // ZDF nummeriert Filmreihen („Die Toten vom Bodensee (S04/E03)“): überwiegend Filme → Filmreihe
    expect(serienArt({ folgen: 30, nummeriert: 30, dauer: 5300, genres: g(['krimi', 'serie']), filme: 30 })).toBe('filmreihe');
  });

  it('übersetzt Wikidata-Genres', () => {
    expect(genresAusWikidata(['Kriminalfilm', 'Thriller'])).toEqual(['krimi']);
    expect(genresAusWikidata(['Tragikomödie', 'Filmdrama'])).toEqual(['comedy', 'drama']);
    expect(genresAusWikidata(['Dokumentarfilm', 'True Crime', 'Kriminalfilm'])).toEqual(['doku']);
    expect(genresAusWikidata(['Science-Fiction-Serie', 'Liebesfilm', 'Historienfilm'])).toEqual(['fantasy', 'liebe', 'historisch']);
    expect(genresAusWikidata(['Fernsehserie'])).toEqual([]);
  });

  it('bestimmt die Art eines Bündels', () => {
    const b = (art: 'serie' | 'reihe' | 'filmreihe' | 'nachrichten', genres: GenreId[], thema = 'X', datiert = 0, dauer = 1800) =>
      buendelFormat({ art, genres, thema, dauer, datiert });
    expect(b('nachrichten', ['nachrichten'])).toBe('nachrichten');
    expect(b('filmreihe', ['krimi'], 'Tatort')).toBe('film');
    expect(b('serie', ['serie'])).toBe('serie');
    expect(b('reihe', ['sport'], 'Sportschau')).toBe('sport');
    expect(b('reihe', ['doku'], 'Mittendrin - Flughafen Frankfurt')).toBe('doku');
    expect(b('reihe', ['kultur'], 'Kulturzeit', 0.9)).toBe('magazin');
    expect(b('reihe', ['ratgeber'], 'Garten-Doc')).toBe('magazin');
    expect(b('reihe', ['comedy'], 'heute-show')).toBe('show');
    expect(b('reihe', ['gesellschaft'], 'maischberger')).toBe('show');
    expect(b('reihe', ['kultur'], 'ARTE Concert')).toBe('konzert');
    expect(b('reihe', ['wissen'], 'Terra X')).toBe('doku');
  });

  it('führt Staffeln auch bei Sendereihen als Reiter', () => {
    expect(gruppeVon({ staffel: 12, extra: false, datum: 1_793_000_000 }, 'reihe')).toBe('s12');
    expect(gruppeVon({ staffel: null, extra: false, datum: 1_793_000_000 }, 'reihe')).toMatch(/^j20/);
  });

  it('hält lange Sendungen mit Beiwerk-Wörtern im Titel nicht für Extras', () => {
    expect(folgenInfo('Macron – Merz: Hinter den Kulissen der Macht (1/2)', 2700).extra).toBe(false);
    expect(folgenInfo('Trailer Tatort Mittelalter', 38).extra).toBe(true);
    expect(folgenInfo('Der Schneeberg – Web-Clip', 90).extra).toBe(true);
    expect(folgenInfo('DRUCK – Clip 34', 120).extra).toBe(true);
  });

  it('erkennt Livestreams', () => {
    const live = { thema: 'SWR Sport', datum: 1_793_000_000, dauer: 11_100 };
    expect(istLive({ ...live, url: 'https://event14cloudhls.akamaized.net/hls/live/2017/swr/master.m3u8' })).toBe(true);
    expect(istLive({ ...live, thema: 'Livestream', url: 'https://x/y.m3u8' })).toBe(true);
    expect(istLive({ thema: 'Das Erste', datum: 0, dauer: 0, url: 'https://x/y.m3u8' })).toBe(true);
    expect(istLive({ ...live, url: 'https://cdn.example.org/a.mp4' })).toBe(false);
  });
});

describe('Bündel im Index', () => {
  let ordner: string;
  let db: Db;
  let n = 0;
  const e = (x: Partial<FilmEintrag>): FilmEintrag => ({
    sender: 'ARTE.DE',
    gruppe: 'Arte',
    thema: 'Fernsehfilme und Serien - Serien',
    titel: 'Titel',
    datum: 1_793_000_000 + n,
    dauer: 2700,
    beschreibung: '',
    website: '',
    url: `https://cdn.example.org/${n++}.mp4`,
    urlKlein: '',
    urlHd: '',
    urlUntertitel: '',
    geo: '',
    neu: false,
    genres: ['serie'],
    ...x
  });

  beforeAll(() => {
    ordner = mkdtempSync(join(tmpdir(), 'movue-struktur-'));
    const pfad = join(ordner, 'index.db');
    const aufbau = oeffneDb(pfad, { schnellaufbau: true });
    const w = schreiber(aufbau);
    // Arte: zwei Serien und ein Film unter derselben Rubrik
    for (let i = 1; i <= 3; i++) w(e({ titel: `Twin Peaks - Staffel 1 (${i}/8) - Teil ${i}` }));
    for (let i = 1; i <= 2; i++) w(e({ titel: `The Hack (${i}/7)` }));
    w(e({ thema: 'Fernsehfilme und Serien', titel: 'Sommer auf Asphalt', dauer: 5400, genres: ['film'] }));
    // Arte-Reihe über den Titelanfang
    for (const t of ['Mongolei', 'Uganda', 'Nepal']) w(e({ thema: 'Entdeckung der Welt - Länder', titel: `360° Reportage - ${t}`, genres: ['reise'] }));
    // 3sat-Magazin: eine Ausgabe über einen Krimi
    for (let i = 0; i < 6; i++) w(e({ sender: '3Sat', gruppe: '3sat', thema: 'Kulturzeit', titel: `Kulturzeit vom ${i + 1}. Mai`, dauer: 2400, genres: ['kultur'] }));
    w(e({ sender: '3Sat', gruppe: '3sat', thema: 'Kulturzeit', titel: 'Kulturzeit vom 7. Mai: Krimi-Spezial', dauer: 2400, genres: ['kultur', 'krimi'] }));
    // ZDF-Rubrik: Filme verschiedener Genres und Trailer
    const fernsehspiel = { sender: 'ZDF', gruppe: 'ZDF' as const, thema: 'Das kleine Fernsehspiel' };
    w(e({ ...fernsehspiel, titel: 'Film A', dauer: 5400, genres: ['film', 'krimi'] }));
    w(e({ ...fernsehspiel, titel: 'Film B', dauer: 5400, genres: ['film', 'gesellschaft'] }));
    w(e({ ...fernsehspiel, titel: 'Film C', dauer: 5400, genres: ['film', 'comedy'] }));
    w(e({ ...fernsehspiel, titel: 'Kinotrailer: Film D', dauer: 120, genres: ['film'] }));
    w(e({ ...fernsehspiel, titel: 'Film E', dauer: 5400, genres: ['film', 'doku'] }));
    // Trailer, Livestream und Sendung mit Datum in der Zukunft
    const sport = { sender: 'SWR', gruppe: 'ARD' as const, thema: 'SWR Sport', dauer: 1800, genres: ['sport'] as GenreId[] };
    for (let i = 1; i <= 3; i++) w(e({ ...sport, titel: `Sport am Sonntag ${i}` }));
    w(e({ ...sport, titel: 'Trailer: Sport am Sonntag', dauer: 40 }));
    w(e({ ...sport, titel: 'Basketball live: Gladiators Trier – Trepca', dauer: 11_100, url: 'https://event.example.org/hls/live/1/master.m3u8' }));
    w(e({ ...sport, titel: 'Vorab: Sport am Montag', datum: 1_893_000_000 }));
    w(e({ sender: 'ZDF', gruppe: 'ZDF', thema: 'Panorama', titel: 'Kurzmeldung aus Kiel', dauer: 90, genres: ['gesellschaft'] }));
    // Eine Krimi-Folge von dreien macht keine Krimireihe
    const raetsel = { sender: 'ARD', gruppe: 'ARD' as const, thema: 'History or Mystery', genres: ['geschichte'] as GenreId[] };
    w(e({ ...raetsel, titel: 'Burg A (S01/E01)' }));
    w(e({ ...raetsel, titel: 'Burg B (S01/E02)', genres: ['geschichte', 'krimi'] }));
    w(e({ ...raetsel, titel: 'Burg C (S01/E03)' }));
    baueFassungen(aufbau);
    baueSerien(aufbau, { [serienSchluessel('Twin Peaks')]: { q: 'Q2085', g: ['Mysteryserie', 'Dramaserie', 'Fernsehserie'], t: 0 } });
    schliesseAufbau(aufbau);
    aufbau.close();
    db = oeffneDb(pfad);
  });

  afterAll(() => {
    db.close();
    rmSync(ordner, { recursive: true, force: true });
  });

  it('übernimmt Genres aus dem Wikidata-Paket für alle Folgen', () => {
    expect(serieNachThema(db, 'Arte', 'Twin Peaks')?.genres).toEqual(expect.arrayContaining(['fantasy', 'drama', 'serie']));
    expect(suche(db, { text: 'Twin Peaks', genre: 'drama' }).gesamt).toBe(3);
  });

  it('bündelt Arte nach Serienname statt Rubrik', () => {
    expect(serieNachThema(db, 'Arte', 'Fernsehfilme und Serien - Serien')).toBeNull();
    expect(serieNachThema(db, 'Arte', 'Twin Peaks')).toMatchObject({ art: 'serie', folgen: 3 });
    expect(serieNachThema(db, 'Arte', 'The Hack')).toMatchObject({ folgen: 2 });
    expect(serieNachThema(db, 'Arte', '360° Reportage')).toMatchObject({ folgen: 3 });
    const film = suche(db, { text: 'Sommer auf Asphalt' }).treffer[0];
    expect(film.serieId).toBeNull();
  });

  it('gibt Folgen eines Magazins die Genres des Magazins', () => {
    const s = serieNachThema(db, '3sat', 'Kulturzeit');
    expect(s?.genres).toEqual(['kultur']);
    expect(suche(db, { text: '', genre: 'krimi', gruppe: '3sat' }).gesamt).toBe(0);
    expect(reihe(db, { genre: 'krimi', gruppe: '3sat', minDauer: 0, jetzt: 1_793_100_000_000 })).toEqual([]);
  });

  it('zeigt Trailer, Livestreams und Angekündigtes nicht in Listen', () => {
    const titel = suche(db, { text: 'sport' }).treffer.map((f) => f.titel);
    expect(titel).toContain('Sport am Sonntag 1');
    expect(titel).not.toContain('Trailer: Sport am Sonntag');
    expect(titel.some((t) => t.startsWith('Basketball live'))).toBe(false);
    expect(titel).not.toContain('Vorab: Sport am Montag');
    const einzeln = stoebern(db, { genre: 'sport' }).eintraege.map((x) => (x.typ === 'film' ? x.film.titel : x.serie.thema));
    expect(einzeln.some((t) => t.startsWith('Basketball live') || t.startsWith('Trailer'))).toBe(false);
    // Der Trailer steht auf der Seite seiner Reihe unter „Extras“, das Bündel endet mit der neuesten sichtbaren Folge
    const detail = serieDetail(db, 'ARD', 'SWR Sport');
    expect(detail?.folgen.find((f) => f.titel.startsWith('Trailer'))?.extra).toBe(true);
    expect(detail?.folgen.some((f) => f.titel.startsWith('Basketball live'))).toBe(false);
    expect(detail!.serie.neueste).toBeLessThan(1_893_000_000);
  });

  it('gibt jeder Sendung eine Art und blendet Kurzbeiträge beim Stöbern aus', () => {
    expect(serieNachThema(db, 'Arte', 'Twin Peaks')?.format).toBe('serie');
    expect(serieNachThema(db, '3sat', 'Kulturzeit')?.format).toBe('magazin');
    expect(suche(db, { text: 'Sommer auf Asphalt' }).treffer[0].format).toBe('film');
    expect(suche(db, { text: 'Kinotrailer' }).gesamt).toBe(0);
    // Kurzbeitrag ohne Reihe: in der Suche ja, beim Stöbern nur auf der Seite des Senders
    expect(suche(db, { text: 'Kurzmeldung' }).treffer[0].format).toBe('kurz');
    const titel = (r: ReturnType<typeof stoebern>) => r.eintraege.map((x) => (x.typ === 'film' ? x.film.titel : x.serie.thema));
    expect(titel(stoebern(db, {}))).not.toContain('Kurzmeldung aus Kiel');
    expect(titel(stoebern(db, { gruppe: 'ZDF' }))).toContain('Kurzmeldung aus Kiel');
    expect(titel(stoebern(db, { format: 'magazin' }))).toEqual(['Kulturzeit']);
  });

  it('zählt je Art so, wie die Seiten sie zeigen', () => {
    const anzahl = artAnzahlen(db);
    for (const format of ['serie', 'doku', 'magazin', 'film', 'sport'] as const) {
      expect(anzahl[format] ?? 0, format).toBe(stoebern(db, { format, limit: 200 }).gesamt);
    }
    const sport = artAnzahlen(db, { genre: 'sport' });
    expect(Object.values(sport).reduce((a, b) => a + (b ?? 0), 0)).toBeGreaterThan(0);
  });

  it('nimmt für ein Bündel die Genres der Mehrheit', () => {
    expect(serieNachThema(db, 'ARD', 'History or Mystery')?.genres).toEqual(['geschichte']);
    expect(suche(db, { text: 'Burg B' }).treffer[0].genres).toEqual(['geschichte']);
  });

  it('führt eine gemischte Rubrik nicht als Serie', () => {
    expect(serieNachThema(db, 'ZDF', 'Das kleine Fernsehspiel')).toBeNull();
    expect(suche(db, { text: 'Film A' }).treffer[0].serieId).toBeNull();
  });
});
