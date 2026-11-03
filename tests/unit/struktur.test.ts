import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { serieAusTitel, serienArt } from '@shared/serie';
import { baueFassungen, oeffneDb, reihe, schliesseAufbau, schreiber, suche, type Db } from '../../src/main/index/datenbank';
import { baueSerien, istReihenAnfang, istRubrik, serieNachThema, titelAnfang } from '../../src/main/index/serien';
import type { FilmEintrag } from '../../src/main/filmliste/eintrag';
import type { GenreId } from '../../src/shared/genres';

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
    baueFassungen(aufbau);
    baueSerien(aufbau);
    schliesseAufbau(aufbau);
    aufbau.close();
    db = oeffneDb(pfad);
  });

  afterAll(() => {
    db.close();
    rmSync(ordner, { recursive: true, force: true });
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

  it('führt eine gemischte Rubrik nicht als Serie', () => {
    expect(serieNachThema(db, 'ZDF', 'Das kleine Fernsehspiel')).toBeNull();
    expect(suche(db, { text: 'Film A' }).treffer[0].serieId).toBeNull();
  });
});
