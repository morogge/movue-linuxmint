import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';

let app: ElectronApplication;
let win: Page;
let daten: string;

test.beforeAll(async () => {
  daten = mkdtempSync(join(tmpdir(), 'movue-e2e-'));
  // In der CI (Ubuntu-Runner) verhindert AppArmor die Chromium-Sandbox
  const args = ['.', ...(process.env.CI ? ['--no-sandbox'] : [])];
  app = await electron.launch({
    args,
    env: {
      ...process.env,
      MOVUE_DATEN: daten,
      MOVUE_FILMLISTE_VOLL: join(__dirname, '../fixtures/filmliste-mini.json')
    }
  });
  win = await app.firstWindow();
  await win.setViewportSize({ width: 1440, height: 900 });
});

test.afterAll(async () => {
  await app?.close();
  rmSync(daten, { recursive: true, force: true });
});

test('Startseite erscheint und das Sendungsverzeichnis wird geladen', async () => {
  await expect(win.getByRole('heading', { name: 'Willkommen bei Movue' })).toBeVisible();
  await expect(win.getByText(/Version \d+\.\d+\.\d+/)).toBeVisible();
  await expect(win.getByRole('status')).toContainText('6 Sendungen', { timeout: 30_000 });
  await expect(win.getByRole('status')).toContainText('Stand 01.11.');
  await win.screenshot({ path: 'test-results/screens/start.png' });
});

test('Suche findet Sendungen über alle Sender und filtert nach Sender', async () => {
  await win.keyboard.press('Control+K');
  await win.keyboard.type('tatort');
  await expect(win.getByRole('heading', { name: 'Suche: „tatort“' })).toBeVisible();
  await expect(win.getByText('3 Treffer')).toBeVisible();
  await expect(win.getByRole('heading', { name: 'Tatort: Der Fall Münster' })).toBeVisible();
  await win.screenshot({ path: 'test-results/screens/suche.png' });

  await win.getByRole('button', { name: 'ZDF', exact: true }).click();
  await expect(win.getByText('1 Treffer')).toBeVisible();
  await expect(win.getByRole('heading', { name: 'Terra X: Die Ostsee' })).toBeVisible();

  await win.getByRole('button', { name: 'Alle Sender' }).click();
  await win.getByLabel('Suche in allen Mediatheken').focus();
  await win.keyboard.press('Escape');
  await expect(win.getByRole('heading', { name: 'Neueste Sendungen' })).toBeVisible();
  await expect(win.getByText('6 Treffer')).toBeVisible();
});

test('F1 öffnet die Hilfe zum aktuellen Bildschirm, Esc schließt sie', async () => {
  await win.keyboard.press('F1');
  const dialog = win.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Suchen', level: 1 })).toBeVisible();
  await win.screenshot({ path: 'test-results/screens/hilfe-suchen.png' });
  await win.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('Tastenkürzel-Seite zeigt die Tabelle aus der App', async () => {
  await win.getByRole('button', { name: 'Hilfe (F1)' }).click();
  await win.getByRole('button', { name: 'Tastenkürzel' }).click();
  const table = win.getByRole('table');
  await expect(table.getByRole('cell', { name: 'Ins Suchfeld springen' })).toBeVisible();
  await win.getByRole('button', { name: 'Hilfe schließen (Esc)' }).click();
});
