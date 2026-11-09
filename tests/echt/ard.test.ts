import { describe, expect, it } from 'vitest';
import { findeReihenTrailer } from '../../src/main/ardtrailer';

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
