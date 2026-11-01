import { describe, expect, it } from 'vitest';
import { zeigeWasIstNeu } from '@shared/update';

describe('Was ist neu nach einem Update', () => {
  it('erscheint nach einem Versionswechsel', () => {
    expect(zeigeWasIstNeu('0.2.0', '0.3.0')).toBe(true);
  });

  it('erscheint nicht beim allerersten Start', () => {
    expect(zeigeWasIstNeu(null, '0.3.0')).toBe(false);
    expect(zeigeWasIstNeu('', '0.3.0')).toBe(false);
  });

  it('erscheint nicht bei gleicher Version', () => {
    expect(zeigeWasIstNeu('0.3.0', '0.3.0')).toBe(false);
  });
});
