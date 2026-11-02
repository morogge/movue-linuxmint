import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fassungKern, fassungName } from '@shared/fassung';
import { baueFassungen, fassungen, filmNachId, oeffneDb, schliesseAufbau, schreiber, suche, type Db } from '../../src/main/index/datenbank';
import type { FilmEintrag } from '../../src/main/filmliste/eintrag';

describe('Fassungen erkennen', () => {
  it('benennt Audiodeskription, Gebärdensprache und Originalfassungen', () => {
    expect(fassungName('Tatort: Gier (Audiodeskription)')).toBe('Audiodeskription');
    expect(fassungName('Schweigen (mit Gebärdensprache)')).toBe('Gebärdensprache');
    expect(fassungName('Xenius (Originalversion mit Untertitel)')).toBe('Original mit Untertiteln');
    expect(fassungName('Der Film (Originalfassung)')).toBe('Originalfassung');
    expect(fassungName('Inferno - Nach den Romanfiguren von Maj Sjöwall und Per Wahlöö (S09/E03)(swe)')).toBe('Original (Schwedisch)');
    expect(fassungName('Die Brücke - Audiodeskription')).toBe('Audiodeskription');
    expect(fassungName('Folge 1102: Alte Freunde (S28/E02)')).toBeNull();
    expect(fassungName('Rückkehr (ZDF)')).toBeNull();
    expect(fassungName('Preis der Freiheit (3/3)')).toBeNull();
  });

  it('führt alle Fassungen auf denselben Kern zurück', () => {
    const k = fassungKern('Inferno - Nach den Romanfiguren von Maj Sjöwall und Per Wahlöö (S09/E03)');
    expect(fassungKern('Inferno - Nach den Romanfiguren von Maj Sjöwall und Per Wahlöö (S09/E03)(swe)')).toBe(k);
    expect(fassungKern('Inferno - Nach den Romanfiguren von Maj Sjöwall und Per Wahlöö (S09/E03) (Audiodeskription)')).toBe(k);
    expect(fassungKern('Die Brücke - Audiodeskription')).toBe(fassungKern('Die Brücke'));
  });
});

describe('Fassungen im Index', () => {
  let ordner: string;
  let db: Db;
  let n = 0;
  const eintrag = (e: Partial<FilmEintrag>): FilmEintrag => ({
    sender: 'ZDF',
    gruppe: 'ZDF',
    thema: 'Kommissar Beck',
    titel: 'Inferno (S09/E03)',
    datum: 1_793_000_000,
    dauer: 5400,
    beschreibung: 'Ein Fall für Beck.',
    website: '',
    url: `https://cdn.example.org/${n++}.mp4`,
    urlKlein: '',
    urlHd: '',
    urlUntertitel: '',
    geo: '',
    neu: false,
    genres: ['krimi'],
    ...e
  });

  beforeEach(() => {
    ordner = mkdtempSync(join(tmpdir(), 'movue-fassung-'));
    const pfad = join(ordner, 'index.db');
    const aufbau = oeffneDb(pfad, { schnellaufbau: true });
    const schreibe = schreiber(aufbau);
    schreibe(eintrag({}));
    schreibe(eintrag({ titel: 'Inferno (S09/E03)(swe)' }));
    schreibe(eintrag({ titel: 'Inferno (S09/E03) (Audiodeskription)' }));
    // Nur als Fassung vorhanden: bleibt sichtbar
    schreibe(eintrag({ titel: 'Die Brücke (S09/E04) (Audiodeskription)' }));
    baueFassungen(aufbau);
    schliesseAufbau(aufbau);
    aufbau.close();
    db = oeffneDb(pfad);
  });

  afterEach(() => {
    db.close();
    rmSync(ordner, { recursive: true, force: true });
  });

  it('zeigt im Listing nur die Standardfassung', () => {
    const titel = suche(db, { text: '' }).treffer.map((f) => f.titel).sort();
    expect(titel).toEqual(['Die Brücke (S09/E04) (Audiodeskription)', 'Inferno (S09/E03)']);
    expect(suche(db, { text: 'inferno' }).gesamt).toBe(1);
  });

  it('bietet die anderen Fassungen auf der Seite der Sendung an', () => {
    const standard = suche(db, { text: 'inferno' }).treffer[0];
    const liste = fassungen(db, filmNachId(db, standard.id)!);
    expect(liste[0]).toMatchObject({ name: null, film: { id: standard.id } });
    expect(liste.slice(1).map((x) => x.name).sort()).toEqual(['Audiodeskription', 'Original (Schwedisch)']);
  });
});
