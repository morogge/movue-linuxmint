import { describe, expect, it } from 'vitest';
import { MELDE_REPO, meldeAdresse } from '@shared/melden';

describe('Falsch einsortiert melden', () => {
  it('füllt einen Fehlerbericht mit dem, was Movue über die Sendung weiß', () => {
    const url = new URL(
      meldeAdresse(
        {
          was: 'Sendung',
          titel: 'Kiel schockt Hoffenheim: Sieg nach Elfmeter-Krimi',
          thema: 'Sportstudio',
          sender: 'ZDF',
          format: 'sport',
          genres: ['sport', 'sonstiges'],
          website: 'https://www.zdf.de/sport/x-100',
          datum: 1_793_000_000
        },
        '0.16.0'
      )
    );
    expect(`${url.origin}${url.pathname}`).toBe(MELDE_REPO);
    expect(url.searchParams.get('title')).toBe('Falsch einsortiert: Kiel schockt Hoffenheim: Sieg nach Elfmeter-Krimi');
    expect(url.searchParams.get('labels')).toBe('einsortierung');
    const body = url.searchParams.get('body')!;
    expect(body).toContain('**Art in Movue:** Sport');
    expect(body).toContain('**Genres in Movue:** Sport');
    expect(body).not.toContain('Sonstiges');
    expect(body).toContain('**Thema:** Sportstudio');
    expect(body).toContain('https://www.zdf.de/sport/x-100');
    expect(body).toContain('**Movue:** 0.16.0');
    expect(body).toContain('### Was wäre richtig?');
  });

  it('bleibt bei sehr langen Titeln in den Grenzen von GitHub', () => {
    const url = new URL(meldeAdresse({ was: 'Serie', titel: 'x'.repeat(500), thema: '', sender: 'ARD', format: null, genres: [], website: '' }, '1'));
    expect(url.searchParams.get('title')!.length).toBeLessThanOrEqual(200);
    expect(url.searchParams.get('body')).toContain('**Art in Movue:** –');
  });
});
