import { createReadStream, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  anzahl,
  baueFtsAbfrage,
  leseMeta,
  oeffneDb,
  schliesseAufbau,
  suche,
  type Db
} from '../../src/main/index/datenbank';
import { importiere } from '../../src/main/index/import';
import { DIFF_INTERVALL, naechsteAktion, VOLL_INTERVALL } from '../../src/main/index/plan';
import { oeffneListe } from '../../src/main/filmliste/quelle';

const fixtures = join(__dirname, '../fixtures');
let ordner: string;
let db: Db;

async function baueIndex(datei = 'filmliste-mini.json'): Promise<Db> {
  const pfad = join(ordner, 'index.db');
  const aufbau = oeffneDb(pfad, { schnellaufbau: true });
  await importiere(createReadStream(join(fixtures, datei)), aufbau);
  schliesseAufbau(aufbau);
  aufbau.close();
  return oeffneDb(pfad);
}

beforeEach(async () => {
  ordner = mkdtempSync(join(tmpdir(), 'movue-test-'));
  db = await baueIndex();
});

afterEach(() => {
  db.close();
  rmSync(ordner, { recursive: true, force: true });
});

describe('Import', () => {
  it('übernimmt nur die vier Sendergruppen', () => {
    expect(anzahl(db)).toBe(6);
  });

  it('speichert den Stand der Liste', () => {
    expect(Number(leseMeta(db, 'stand'))).toBe(Date.UTC(2026, 10, 1, 17, 19));
  });

  it('wendet eine Diff-Liste an: neue Einträge dazu, vorhandene aktualisiert', async () => {
    await importiere(createReadStream(join(fixtures, 'filmliste-diff-mini.json')), db);
    expect(anzahl(db)).toBe(7);
    expect(suche(db, { text: 'neu geschnitten' }).treffer[0]?.titel).toBe('Tatort: Zweiter Fall (neu geschnitten)');
    expect(suche(db, { text: 'heute journal' }).gesamt).toBe(1);
  });

  it('entpackt .xz-Listen mit dem Systemprogramm xz', async () => {
    const strom = await oeffneListe(join(fixtures, 'filmliste-mini.json.xz'), 'test');
    const pfad = join(ordner, 'xz.db');
    const zweite = oeffneDb(pfad, { schnellaufbau: true });
    const ergebnis = await importiere(strom, zweite);
    zweite.close();
    expect(ergebnis.anzahl).toBe(6);
  });
});

describe('Suche', () => {
  it('findet Treffer im Titel vor Treffern in der Beschreibung', () => {
    const e = suche(db, { text: 'tatort' });
    expect(e.gesamt).toBe(3);
    expect(e.treffer.slice(0, 2).every((f) => f.gruppe === 'ARD')).toBe(true);
    expect(e.treffer[2].gruppe).toBe('ZDF');
  });

  it('filtert nach Sendergruppe', () => {
    const e = suche(db, { text: 'tatort', gruppe: 'ZDF' });
    expect(e.gesamt).toBe(1);
    expect(e.treffer[0].titel).toBe('Terra X: Die Ostsee');
  });

  it('sucht mit Wortanfängen, ohne Groß-/Kleinschreibung und Umlaute', () => {
    expect(suche(db, { text: 'MUNSTER' }).gesamt).toBe(1);
    expect(suche(db, { text: 'kultur' }).gesamt).toBe(1);
    expect(suche(db, { text: 'aerger' }).gesamt).toBe(0);
    expect(suche(db, { text: 'ärger' }).gesamt).toBe(1);
  });

  it('verlangt alle Wörter', () => {
    expect(suche(db, { text: 'tatort münster' }).gesamt).toBe(1);
  });

  it('sortiert auf Wunsch nach Datum', () => {
    const e = suche(db, { text: 'tatort', sortierung: 'datum' });
    expect(e.treffer.map((f) => f.datum)).toEqual([...e.treffer.map((f) => f.datum)].sort((a, b) => b - a));
  });

  it('zeigt ohne Suchbegriff die neuesten Sendungen', () => {
    const e = suche(db, { text: '  ', limit: 2 });
    expect(e.gesamt).toBe(6);
    expect(e.treffer.map((f) => f.titel)).toEqual(['Kulturzeit vom 31.10.2026', 'Panorama vom 30. Oktober']);
  });

  it('übersteht Sonderzeichen in der Eingabe', () => {
    for (const text of ['"', 'ARD-alpha', 'tatort*', '(', 'AND OR NOT', "'; DROP TABLE film; --"]) {
      expect(() => suche(db, { text })).not.toThrow();
    }
  });

  it('blättert mit offset', () => {
    const alle = suche(db, { text: '', limit: 6 }).treffer.map((f) => f.id);
    const seite2 = suche(db, { text: '', limit: 2, offset: 2 }).treffer.map((f) => f.id);
    expect(seite2).toEqual(alle.slice(2, 4));
  });
});

describe('baueFtsAbfrage', () => {
  it('macht aus Wörtern Präfix-Suchen', () => {
    expect(baueFtsAbfrage('Tatort Münster')).toBe('"Tatort"* "Münster"*');
    expect(baueFtsAbfrage('  ')).toBeNull();
    expect(baueFtsAbfrage('"')).toBeNull();
  });
});

describe('naechsteAktion', () => {
  const jetzt = Date.UTC(2026, 10, 1, 12);

  it('lädt ohne Index die komplette Liste', () => {
    expect(naechsteAktion({ vorhanden: false, vollGeladen: null, diffGeladen: null }, jetzt)).toBe('voll');
  });

  it('lädt nach einem Tag die komplette Liste neu', () => {
    expect(naechsteAktion({ vorhanden: true, vollGeladen: jetzt - VOLL_INTERVALL, diffGeladen: jetzt }, jetzt)).toBe('voll');
  });

  it('lädt höchstens stündlich die Diff-Liste', () => {
    const vor30 = jetzt - 30 * 60 * 1000;
    expect(naechsteAktion({ vorhanden: true, vollGeladen: vor30, diffGeladen: null }, jetzt)).toBeNull();
    expect(naechsteAktion({ vorhanden: true, vollGeladen: jetzt - 2 * DIFF_INTERVALL, diffGeladen: vor30 }, jetzt)).toBeNull();
    expect(naechsteAktion({ vorhanden: true, vollGeladen: jetzt - 2 * DIFF_INTERVALL, diffGeladen: null }, jetzt)).toBe('diff');
  });
});
