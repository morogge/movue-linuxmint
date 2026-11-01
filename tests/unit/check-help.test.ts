import { describe, expect, it } from 'vitest';
import { evaluate, EXEMPT_LABEL } from '../../scripts/check-help.mjs';

describe('Hilfe-Check', () => {
  it('verlangt Hilfe und Changelog bei Änderungen an der Oberfläche', () => {
    const result = evaluate({ changed: ['src/renderer/src/App.tsx'], labels: [] });
    expect(result.ok).toBe(false);
    expect(result.problems).toHaveLength(2);
  });

  it('ist zufrieden, wenn Hilfe und Changelog mitgeändert wurden', () => {
    const result = evaluate({
      changed: ['src/renderer/src/App.tsx', 'help/erste-schritte.md', 'CHANGELOG.md'],
      labels: []
    });
    expect(result.ok).toBe(true);
  });

  it('verlangt bei reinen Hauptprozess-Änderungen nur den Changelog', () => {
    const result = evaluate({ changed: ['src/main/index.ts'], labels: [] });
    expect(result.problems).toEqual(['Der Code wurde geändert, aber CHANGELOG.md nicht ergänzt.']);
  });

  it('lässt Änderungen ohne Code durch', () => {
    expect(evaluate({ changed: ['README.md'], labels: [] }).ok).toBe(true);
  });

  it('respektiert das Ausnahme-Label', () => {
    expect(evaluate({ changed: ['src/renderer/src/App.tsx'], labels: [EXEMPT_LABEL] }).ok).toBe(true);
  });
});
