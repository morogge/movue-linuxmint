import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';

let app: ElectronApplication;
let win: Page;

test.beforeAll(async () => {
  // In der CI (Ubuntu-Runner) verhindert AppArmor die Chromium-Sandbox
  const args = ['.', ...(process.env.CI ? ['--no-sandbox'] : [])];
  app = await electron.launch({ args });
  win = await app.firstWindow();
  await win.setViewportSize({ width: 1440, height: 900 });
});

test.afterAll(async () => {
  await app?.close();
});

test('Startseite erscheint', async () => {
  await expect(win.getByRole('heading', { name: 'Willkommen bei Movue' })).toBeVisible();
  await expect(win.getByText(/Version \d+\.\d+\.\d+/)).toBeVisible();
  await win.screenshot({ path: 'test-results/screens/start.png' });
});

test('F1 öffnet die Hilfe zum aktuellen Bildschirm, Esc schließt sie', async () => {
  await win.keyboard.press('F1');
  const dialog = win.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Erste Schritte' })).toBeVisible();
  await win.screenshot({ path: 'test-results/screens/hilfe.png' });
  await win.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('Tastenkürzel-Seite zeigt die Tabelle aus der App', async () => {
  await win.getByRole('button', { name: 'Hilfe (F1)' }).click();
  await win.getByRole('button', { name: 'Tastenkürzel' }).click();
  const table = win.getByRole('table');
  await expect(table.getByRole('cell', { name: 'Hilfe zum aktuellen Bildschirm öffnen' })).toBeVisible();
  await win.screenshot({ path: 'test-results/screens/tastenkuerzel.png' });
  await win.getByRole('button', { name: 'Hilfe schließen (Esc)' }).click();
});
