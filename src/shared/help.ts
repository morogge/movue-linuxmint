/**
 * Hilfeseiten: Markdown-Dateien in help/. Reihenfolge und Titel ergeben sich hieraus.
 * „Was ist neu“ wird nicht aus help/, sondern aus CHANGELOG.md erzeugt.
 */

export const HELP_ORDER = ['erste-schritte', 'stoebern', 'serien', 'player', 'merkliste', 'suchen', 'kategorien', 'live', 'tastenkuerzel', 'aktualisierungen', 'datenquellen', 'was-ist-neu'] as const;

export const CHANGELOG_PAGE_ID = 'was-ist-neu';

/** Platzhalter, an dessen Stelle die Tastenkürzel-Tabelle aus SHORTCUTS erscheint. */
export const SHORTCUTS_PLACEHOLDER = '{{tastenkuerzel}}';

export interface HelpPage {
  id: string;
  title: string;
  /** Markdown ohne die Titelzeile */
  body: string;
}

export function idFromPath(path: string): string {
  const file = path.split('/').pop() ?? path;
  return file.replace(/\.md$/, '');
}

export function parsePage(id: string, raw: string): HelpPage {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const titleIndex = lines.findIndex((l) => l.startsWith('# '));
  const title = titleIndex >= 0 ? lines[titleIndex].slice(2).trim() : id;
  const body = (titleIndex >= 0 ? lines.slice(titleIndex + 1) : lines).join('\n').trim();
  return { id, title, body };
}

/**
 * Baut die geordnete Liste der Hilfeseiten.
 * @param files Pfad → Markdown-Inhalt aller Dateien in help/
 * @param changelog Inhalt von CHANGELOG.md
 */
export function buildHelp(files: Record<string, string>, changelog: string): HelpPage[] {
  const byId = new Map<string, HelpPage>();
  for (const [path, raw] of Object.entries(files)) {
    const id = idFromPath(path);
    byId.set(id, parsePage(id, raw));
  }
  const changelogPage = parsePage(CHANGELOG_PAGE_ID, changelog);
  byId.set(CHANGELOG_PAGE_ID, { ...changelogPage, title: 'Was ist neu' });

  return HELP_ORDER.map((id) => byId.get(id)).filter((p): p is HelpPage => p !== undefined);
}
