import { describe, expect, it } from 'vitest';
import { ART_SEITEN, KATEGORIE_GENRES, KATEGORIE_THEMEN, artSeite, neuTitel } from '../../src/shared/arten';
import { istFormat, istGenre } from '../../src/shared/genres';

describe('Seiten je Art', () => {
  it('hat eindeutige Seiten mit gültigen Filtern', () => {
    const ids = ART_SEITEN.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of ART_SEITEN) {
      expect(s.format || s.genre, s.id).toBeTruthy();
      if (s.format) expect(istFormat(s.format)).toBe(true);
      if (s.genre) expect(istGenre(s.genre)).toBe(true);
      for (const t of s.teile) expect(t.genre || t.format, `${s.id}: ${t.name}`).toBeTruthy();
    }
  });

  it('führt die Arten der Seitenleiste in der vereinbarten Reihenfolge', () => {
    expect(ART_SEITEN.filter((s) => s.seitenleiste).map((s) => s.titel)).toEqual([
      'Serien',
      'Filme',
      'Dokus',
      'Shows & Talk',
      'Nachrichten',
      'Sport',
      'Kinder'
    ]);
    // Kurzbeiträge haben keine eigene Seite
    expect(ART_SEITEN.some((s) => s.format === 'kurz')).toBe(false);
  });

  it('kennt keine „Weiteren Sendungen“ mehr', () => {
    expect([...KATEGORIE_GENRES, ...KATEGORIE_THEMEN]).not.toContain('sonstiges');
    expect(neuTitel(artSeite('serien')!)).toBe('Neu bei Serien');
    expect(neuTitel(artSeite('kinder')!)).toBe('Neu für Kinder');
    expect(neuTitel(artSeite('filme')!)).toBe('Neu bei Filmen');
    expect(neuTitel(artSeite('magazine')!)).toBe('Neu bei Magazinen');
  });
});
