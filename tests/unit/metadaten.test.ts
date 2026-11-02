import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ergaenze, filmSchluessel, serienSchluessel, wikidataTitel, zuTitelInfo } from '@shared/metadaten';
import { MetadatenDienst } from '../../src/main/metadaten';
import { waehle } from '../../scripts/metadaten/wikidata';

describe('Metadaten-Paket', () => {
  it('führt Fassungen und Zusätze auf denselben Schlüssel zurück', () => {
    expect(filmSchluessel('Sprachlos in Irland - Fernsehfilm, Deutschland 2020')).toBe(filmSchluessel('Sprachlos in Irland'));
    expect(filmSchluessel('Sprachlos in Irland (Audiodeskription)')).toBe(filmSchluessel('Sprachlos in Irland'));
    expect(serienSchluessel('In aller Freundschaft')).toBe('s:in aller freundschaft');
  });

  it('fragt Wikidata unter den üblichen Schreibweisen', () => {
    expect(wikidataTitel('A Bigger Splash - Spielfilm, Italien 2015')).toEqual(['A Bigger Splash']);
    expect(wikidataTitel('Danowski - Blutapfel')).toContain('Danowski: Blutapfel');
    expect(wikidataTitel('Babylon Berlin (S02/E02)')).toEqual(['Babylon Berlin']);
  });

  it('wählt bei mehreren Treffern den mit passendem Jahr – sonst keinen', () => {
    const a = { label: 'Fünf Freunde', q: 'Q1', jahr: '1978' };
    const b = { label: 'Fünf Freunde', q: 'Q2', jahr: '2012' };
    expect(waehle([a], undefined)).toBe(a);
    expect(waehle([a, b], undefined)).toBeNull();
    expect(waehle([a, b], '2013')).toBe(b);
    expect(waehle([a], '2012')).toBeNull();
  });

  it('ergänzt nur, was der Sender nicht nennt, und nennt die Quelle', () => {
    const wd = zuTitelInfo({ q: 'Q5', j: '2021', l: 'Deutschland', r: ['R'], d: [['A', 'B']], t: 0 })!;
    expect(ergaenze(null, wd)).toMatchObject({ darsteller: [{ name: 'A', rolle: 'B' }], quelle: 'wikidata', jahr: '2021' });
    const sender = { darsteller: [{ name: 'X', rolle: 'Y' }], stab: [] };
    expect(ergaenze(sender, wd)).toMatchObject({ darsteller: [{ name: 'X' }], stab: [{ rolle: 'Regie', name: 'R' }], quelle: 'wikidata' });
    expect(ergaenze({ darsteller: [{ name: 'X', rolle: '' }], stab: [{ rolle: 'Regie', name: 'Z' }] }, wd)?.quelle).toBe('sender');
    expect(zuTitelInfo({ t: 0 })).toBeNull();
  });
});

describe('Herunterladen des Pakets', () => {
  let ordner: string;
  beforeEach(() => {
    ordner = mkdtempSync(join(tmpdir(), 'movue-meta-'));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    rmSync(ordner, { recursive: true, force: true });
  });

  it('lädt die gepackte Datei, merkt sich das ETag und fragt höchstens einmal am Tag', async () => {
    const datei = { version: 1, stand: 'x', eintraege: { 'f:sugar': { q: 'Q9', d: [['A', 'B']], t: 1 } } };
    const fetch = vi.fn(async () => new Response(gzipSync(JSON.stringify(datei)), { status: 200, headers: { etag: '"abc"' } }));
    vi.stubGlobal('fetch', fetch);
    const dienst = new MetadatenDienst(join(ordner, 'metadaten.json'), 'https://example.org/m.json.gz');
    await dienst.aktualisiere(1_000);
    expect(dienst.film({ titel: 'Sugar' })?.darsteller).toEqual([{ name: 'A', rolle: 'B' }]);
    await dienst.aktualisiere(2_000);
    expect(fetch).toHaveBeenCalledTimes(1);
    // Neuer Tag: mit ETag nachfragen, 304 behält die Daten
    fetch.mockImplementationOnce(async () => new Response(null, { status: 304 }));
    await dienst.aktualisiere(1_000 + 2 * 86_400_000);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect((fetch.mock.calls[1] as unknown as [string, RequestInit])[1].headers).toMatchObject({ 'If-None-Match': '"abc"' });
    expect(dienst.film({ titel: 'Sugar' })).not.toBeNull();
  });

  it('bleibt bei kaputter Datei oder ohne Netz bei den alten Daten', async () => {
    const pfad = join(ordner, 'metadaten.json');
    writeFileSync(pfad, JSON.stringify({ version: 1, stand: 'alt', eintraege: { 's:x': { q: 'Q1', t: 1 } } }));
    vi.stubGlobal('fetch', vi.fn(async () => new Response('kaputt', { status: 200 })));
    const dienst = new MetadatenDienst(pfad, 'https://example.org/m.json.gz');
    dienst.start();
    dienst.stop();
    await dienst.aktualisiere(5);
    expect(dienst.stand()).toBe('alt');
    expect(dienst.serie('X')?.wikidata).toBe('Q1');
  });
});
