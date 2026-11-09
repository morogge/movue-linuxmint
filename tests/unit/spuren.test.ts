import { describe, expect, it } from 'vitest';
import { bevorzugteSpur, spurName } from '@shared/player';

describe('Ton- und Untertitelspuren', () => {
  it('benennt Spuren nach Name, sonst nach Sprache', () => {
    expect(spurName({ name: 'Deutsch (Audiodeskription)', lang: 'de' }, 0)).toBe('Deutsch (Audiodeskription)');
    expect(spurName({ name: 'audio_1', lang: 'en' }, 1)).toBe('Englisch');
    expect(spurName({ lang: 'mis' }, 2)).toBe('Originalton');
    expect(spurName({ lang: 'fr-FR' }, 0)).toBe('Französisch');
    expect(spurName({}, 3)).toBe('Spur 4');
  });

  it('wählt die gemerkte Sprache, sonst die Vorgabe des Streams', () => {
    const spuren = [{ lang: 'de' }, { lang: 'en' }, { lang: 'fr' }];
    expect(bevorzugteSpur(spuren, 'en', 0)).toBe(1);
    expect(bevorzugteSpur(spuren, 'it', 0)).toBe(0);
    expect(bevorzugteSpur(spuren, null, 2)).toBe(2);
  });
});
