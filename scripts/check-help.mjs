// Prüft in Pull Requests, dass Hilfe und Changelog mit dem Code mitwachsen.
// Aufruf in der CI: BASE_REF=origin/main PR_LABELS='["..."]' node scripts/check-help.mjs
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const EXEMPT_LABEL = 'keine-hilfe-noetig';

const UI_FILES = ['src/shared/shortcuts.ts', 'src/shared/screens.ts'];

/**
 * @param {{ changed: string[], labels: string[] }} input
 * @returns {{ ok: boolean, problems: string[] }}
 */
export function evaluate({ changed, labels }) {
  const touchesUi = changed.some((f) => f.startsWith('src/renderer/') || UI_FILES.includes(f));
  const touchesSrc = changed.some((f) => f.startsWith('src/'));
  const helpChanged = changed.some((f) => f.startsWith('help/'));
  const changelogChanged = changed.includes('CHANGELOG.md');
  const problems = [];

  if (!labels.includes(EXEMPT_LABEL)) {
    if (touchesUi && !helpChanged) {
      problems.push('Die Oberfläche wurde geändert, aber keine Hilfeseite in help/ angepasst.');
    }
    if (touchesSrc && !changelogChanged) {
      problems.push('Der Code wurde geändert, aber CHANGELOG.md nicht ergänzt.');
    }
  }
  return { ok: problems.length === 0, problems };
}

function main() {
  const base = process.env.BASE_REF || 'origin/main';
  const changed = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  const labels = JSON.parse(process.env.PR_LABELS || '[]');
  const { ok, problems } = evaluate({ changed, labels });

  if (ok) {
    console.log('Hilfe-Check bestanden.');
    return;
  }
  for (const p of problems) console.error(`✗ ${p}`);
  console.error(`Wenn die Änderung wirklich keine Hilfe braucht, setze das Label „${EXEMPT_LABEL}“.`);
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
