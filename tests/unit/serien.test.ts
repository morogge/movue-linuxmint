import { createReadStream, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Film } from '@shared/film';
import {
  folgenInfo,
  folgenKennung,
  gruppenName,
  gruppeVon,
  serienArt,
  serienUmfang,
  sortiereGruppen,
  startFolge
} from '@shared/serie';
import { filmNachId, liveAngebot, oeffneDb, schliesseAufbau, suche, type Db } from '../../src/main/index/datenbank';
import { importiere } from '../../src/main/index/import';
import { mitSerien, serieDetail, serieNachThema, serienSuche, stoebern } from '../../src/main/index/serien';

describe('Folgen aus dem Titel lesen', () => {
  it('erkennt Staffel/Folge, Jahrgänge, „Folge N“ und Extras', () => {
    expect(folgenInfo('Babylon Berlin (S02/E02)')).toEqual({ staffel: 2, folge: 2, extra: false });
    expect(folgenInfo('ZDF heute Sendung vom 25.08.2025 (S2025/E343)')).toEqual({ staffel: 2025, folge: 343, extra: false });
    expect(folgenInfo('Folge 1237: Abfuhr')).toEqual({ staffel: null, folge: 1237, extra: false });
    expect(folgenInfo('Emmas Smartphonesucht · 18.09.19 | Folge 2395')).toMatchObject({ folge: 2395 });
    expect(folgenInfo('Folge 2 · Staffel 2 | Babylon Berlin')).toEqual({ staffel: 2, folge: 2, extra: false });
    expect(folgenInfo('Vorschau Folge 1744 "Doktor Dressler"')).toMatchObject({ extra: true });
    expect(folgenInfo('Making-of Folge "Täuschung"')).toMatchObject({ extra: true });
    expect(folgenInfo('Ghosts | Outtakes | Folge 4: Rätselhafter Fall')).toMatchObject({ extra: true, folge: 4 });
    expect(folgenInfo('Erinnerungen (958)')).toEqual({ staffel: null, folge: 958, extra: false });
    expect(folgenInfo('Terra X: Die Ostsee')).toEqual({ staffel: null, folge: null, extra: false });
  });

  it('bestimmt die Art des Bündels', () => {
    expect(serienArt({ folgen: 10, nummeriert: 9, dauer: 2700, genres: ['krimi'] })).toBe('serie');
    expect(serienArt({ folgen: 10, nummeriert: 0, dauer: 2700, genres: ['serie'] })).toBe('serie');
    expect(serienArt({ folgen: 10, nummeriert: 0, dauer: 2700, genres: ['doku'] })).toBe('reihe');
    expect(serienArt({ folgen: 300, nummeriert: 0, dauer: 420, genres: ['nachrichten'] })).toBe('nachrichten');
    expect(serienArt({ folgen: 300, nummeriert: 0, dauer: 1800, genres: ['nachrichten'] })).toBe('reihe');
  });

  it('gliedert Serien nach Staffeln und Sendereihen nach Jahrgängen', () => {
    const f = (staffel: number | null, extra = false, datum = Date.UTC(2024, 5, 1) / 1000) => ({ staffel, extra, datum });
    expect(gruppeVon(f(2), 'serie')).toBe('s2');
    expect(gruppeVon(f(null), 'serie')).toBe('folgen');
    expect(gruppeVon(f(2025), 'reihe')).toBe('j2025');
    expect(gruppeVon(f(null), 'reihe')).toBe('j2024');
    expect(gruppeVon(f(1, true), 'serie')).toBe('extras');
    expect(sortiereGruppen(['extras', 's2', 's1', 's2', 'folgen'])).toEqual(['s1', 's2', 'folgen', 'extras']);
    expect(sortiereGruppen(['j2024', 'j2026', 'extras', 'j2025'])).toEqual(['j2026', 'j2025', 'j2024', 'extras']);
    expect(gruppenName('s3')).toBe('Staffel 3');
    expect(gruppenName('j2025')).toBe('2025');
    expect(folgenKennung({ staffel: 2, folge: 4 })).toBe('S2 · F4');
    expect(folgenKennung({ staffel: 2025, folge: 343 })).toBe('F343');
    expect(serienUmfang({ art: 'serie', folgen: 42, staffeln: 3 })).toBe('3 Staffeln · 42 Folgen');
    expect(serienUmfang({ art: 'reihe', folgen: 128, staffeln: 5 })).toBe('128 Folgen');
  });
});

describe('Bündel im Index', () => {
  let ordner: string;
  let db: Db;

  beforeAll(async () => {
    ordner = mkdtempSync(join(tmpdir(), 'movue-serien-'));
    const pfad = join(ordner, 'index.db');
    const aufbau = oeffneDb(pfad, { schnellaufbau: true });
    await importiere(createReadStream(join(__dirname, '../fixtures/filmliste-serie.json')), aufbau);
    schliesseAufbau(aufbau);
    aufbau.close();
    db = oeffneDb(pfad);
  });

  afterAll(() => {
    db.close();
    rmSync(ordner, { recursive: true, force: true });
  });

  it('bündelt ab drei Folgen und zählt Extras getrennt', () => {
    const s = serieNachThema(db, 'ARD', 'In aller Freundschaft');
    expect(s).toMatchObject({ art: 'serie', folgen: 3, extras: 1, staffeln: 2 });
    expect(s?.genres).toContain('serie');
    expect(s?.bild?.titel).toBe('Folge 1102: Alte Freunde (S28/E02)');
    // Tatort hat nur zwei Folgen: kein Bündel
    expect(serieNachThema(db, 'ARD', 'Tatort')).toBeNull();
  });

  it('liefert die Folgen in Abspielreihenfolge', () => {
    const d = serieDetail(db, 'ARD', 'In aller Freundschaft');
    expect(d?.folgen.filter((f) => !f.extra).map((f) => folgenKennung(f))).toEqual(['S27 · F40', 'S28 · F1', 'S28 · F2']);
    expect(d?.folgen.find((f) => f.extra)?.titel).toBe('Vorschau auf Folge 1103');
  });

  it('startet bei der ersten, angefangenen oder nächsten Folge', () => {
    const d = serieDetail(db, 'ARD', 'In aller Freundschaft')!;
    const [erste, zweite, dritte] = d.folgen.filter((f) => !f.extra);
    expect(startFolge(d, new Map())).toEqual({ film: erste, art: 'start' });
    expect(startFolge(d, new Map([[zweite.url, { position: 600, dauer: 2800, zeit: 2 }]]))).toEqual({ film: zweite, art: 'weiter' });
    expect(startFolge(d, new Map([[zweite.url, { position: 2790, dauer: 2800, zeit: 2 }]]))).toEqual({ film: dritte, art: 'naechste' });
  });

  it('hängt Folgen ihr Bündel an', () => {
    const folge = suche(db, { text: 'Alte Freunde' }).treffer[0];
    expect(folge.serieId).not.toBeNull();
    const [mit] = mitSerien(db, [filmNachId(db, folge.id) as Film]);
    expect(mit.serie?.thema).toBe('In aller Freundschaft');
  });

  it('zeigt im Genre die Serie als einen Eintrag', () => {
    const e = stoebern(db, { genre: 'serie' });
    const serien = e.eintraege.filter((x) => x.typ === 'serie');
    expect(serien).toHaveLength(1);
    expect(e.eintraege.some((x) => x.typ === 'film' && x.film.thema === 'In aller Freundschaft')).toBe(false);
    expect(stoebern(db, { genre: 'krimi' }).gesamt).toBe(2);
  });

  it('findet Serien über ihren Namen', () => {
    expect(serienSuche(db, 'freundschaft').map((s) => s.thema)).toEqual(['In aller Freundschaft']);
    expect(serienSuche(db, 'freundschaft', 'ZDF')).toEqual([]);
  });

  it('sammelt Livestreams, Übertragungen und Vorab-Sendungen für „Live & demnächst“', () => {
    const live = liveAngebot(db, Date.parse('2026-11-08T12:00:00Z'));
    expect(live.sender.map((s) => [s.name, s.gruppe])).toEqual([
      ['ZDF', 'haupt'],
      ['WDR', 'dritte']
    ]);
    expect(live.uebertragungen.map((f) => f.titel)).toEqual(['Basketball live: Gladiators Trier gegen Testgegner']);
    expect(live.vorab.map((f) => f.titel)).toContain('Planet e.: Vorab im Netz');
    // Nichts davon in Suche und Listen
    expect(suche(db, { text: 'Gladiators' }).treffer).toHaveLength(0);
    expect(suche(db, { text: 'Vorab im Netz' }).treffer).toHaveLength(0);
    // Vorbei ist vorbei
    expect(liveAngebot(db, Date.parse('2031-01-01T00:00:00Z')).uebertragungen).toHaveLength(0);
  });
});
