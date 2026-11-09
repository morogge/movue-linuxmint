import { describe, expect, it } from 'vitest';
import { findeReihenTrailer } from '../../src/main/ardtrailer';
import { serienSeite } from '../../src/main/bilder';
import { findeZdfTrailer } from '../../src/main/zdftrailer';

// Gegen die echte ARD-Schnittstelle: Folge 1008 von „In aller Freundschaft“ (abrufbar bis 2027)
describe('ARD: Trailer der Reihe', () => {
  it('findet den Trailer von „In aller Freundschaft“ und eine abspielbare Adresse', async () => {
    const t = await findeReihenTrailer('Y3JpZDovL21kci5kZS9zZW5kdW5nLzI4MjA0MC81MDAyOTItNDgwNDIz');
    console.log('ARD-TRAILER', JSON.stringify(t));
    expect(t).not.toBeNull();
    expect(t!.url).toMatch(/^https:\/\/.+\.(mp4|m3u8)/);
    expect(t!.titel).toMatch(/trailer/i);
  }, 60_000);
});

// Gegen das echte ZDF: Under Salt Marsh (Staffel 1, Trailer auf der Seite der Reihe, nicht in der Filmliste)
describe('ZDF: Trailer der Reihe', () => {
  it('findet den Trailer von „Under Salt Marsh“ über die Adresse, die Movue aus einer Folge ableitet', async () => {
    const reihe = serienSeite('https://www.zdf.de/video/serien/under-salt-marsh-tod-in-den-salzwiesen-100/under-salt-marsh---tod-in-den-salzwiesen-die-flut-100');
    expect(reihe).toBe('https://www.zdf.de/video/serien/under-salt-marsh-tod-in-den-salzwiesen-100');
    const t = await findeZdfTrailer(reihe!);
    console.log('ZDF-TRAILER', JSON.stringify(t));
    expect(t).not.toBeNull();
    expect(t!.url).toMatch(/^https:\/\/.+\.(m3u8|mp4)/);
  }, 60_000);
});
