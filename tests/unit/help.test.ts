import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildHelp, CHANGELOG_PAGE_ID, HELP_ORDER, idFromPath, parsePage } from '@shared/help';
import { SCREENS } from '@shared/screens';

const root = join(__dirname, '../..');
const helpDir = join(root, 'help');
const files = Object.fromEntries(
  readdirSync(helpDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => [`help/${f}`, readFileSync(join(helpDir, f), 'utf8')])
);
const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');

describe('Hilfeseiten', () => {
  it('jede Datei in help/ ist in HELP_ORDER eingetragen', () => {
    for (const path of Object.keys(files)) {
      expect(HELP_ORDER).toContain(idFromPath(path));
    }
  });

  it('jede Seite aus HELP_ORDER existiert', () => {
    const pages = buildHelp(files, changelog);
    expect(pages.map((p) => p.id)).toEqual([...HELP_ORDER]);
  });

  it('jeder Bildschirm verweist auf eine vorhandene Hilfeseite', () => {
    const ids = buildHelp(files, changelog).map((p) => p.id);
    for (const screen of Object.values(SCREENS)) {
      expect(ids).toContain(screen.help);
    }
  });

  it('jede Seite hat einen Titel und Inhalt', () => {
    for (const page of buildHelp(files, changelog)) {
      expect(page.title.length).toBeGreaterThan(0);
      expect(page.body.length).toBeGreaterThan(0);
    }
  });

  it('„Was ist neu“ kommt aus dem Changelog', () => {
    const page = buildHelp(files, changelog).find((p) => p.id === CHANGELOG_PAGE_ID);
    expect(page?.title).toBe('Was ist neu');
    expect(page?.body).toContain('0.1.0');
  });
});

describe('parsePage', () => {
  it('trennt Titel und Inhalt', () => {
    expect(parsePage('x', '# Titel\n\nText')).toEqual({ id: 'x', title: 'Titel', body: 'Text' });
  });

  it('nimmt die id als Titel, wenn keiner da ist', () => {
    expect(parsePage('x', 'Nur Text').title).toBe('x');
  });
});
