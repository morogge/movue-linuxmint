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
      MOVUE_FILMLISTE_VOLL: join(__dirname, '../fixtures/filmliste-mini.json'),
      MOVUE_UPDATE_SIMULIEREN: '9.9.9',
      MOVUE_BILDER_AUS: '1',
      MOVUE_KEINE_MELDUNG: '1'
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
  await expect(win.getByText(/Version \d+\.\d+\.\d+/)).toBeVisible();
  await expect(win.getByRole('status')).toContainText('6 Sendungen', { timeout: 60_000 });
  await expect(win.getByRole('status')).toContainText('Stand 01.11.');
  await expect(win.getByRole('heading', { name: 'Krimi & Thriller', level: 2 })).toBeVisible();
  await win.screenshot({ path: 'test-results/screens/start.png' });
});

test('Kachel öffnet die Detailseite mit weiteren Folgen, Alt+← führt zurück', async () => {
  await win.getByRole('button', { name: /Tatort: Der Fall Münster/ }).first().click();
  await expect(win.getByRole('heading', { name: 'Tatort: Der Fall Münster', level: 1 })).toBeVisible();
  await expect(win.getByRole('heading', { name: 'Weitere Folgen von „Tatort“' })).toBeVisible();
  await expect(win.getByRole('button', { name: /Tatort: Zweiter Fall/ })).toBeVisible();
  await win.screenshot({ path: 'test-results/screens/detail.png' });
  await win.keyboard.press('Alt+ArrowLeft');
  await expect(win.getByRole('heading', { name: 'Krimi & Thriller', level: 2 })).toBeVisible();
});

test('Player öffnet sich und meldet nicht abspielbare Videos verständlich', async () => {
  await win.getByRole('button', { name: /Tatort: Der Fall Münster/ }).first().click();
  await win.getByRole('button', { name: /Abspielen/ }).first().click();
  await expect(win.getByRole('heading', { name: 'Tatort: Der Fall Münster', level: 1 })).toBeVisible();
  await expect(win.locator('.player-steuerung').getByRole('button', { name: 'Vollbild' })).toBeAttached();
  // Die Testliste zeigt auf nicht existierende Videos → verständliche Meldung statt schwarzem Bild
  await expect(win.getByRole('alert')).toContainText('lässt sich nicht abspielen', { timeout: 20_000 });
  await expect(win.getByRole('heading', { name: /Als Nächstes|Weitere Folgen/ })).toBeVisible();
  await win.screenshot({ path: 'test-results/screens/player.png' });
  await win.getByRole('button', { name: 'Start', exact: true }).click();
});

test('Merken und Reihe abonnieren landen in der Merkliste', async () => {
  await win.getByRole('button', { name: /Tatort: Der Fall Münster/ }).first().click();
  await expect(win.getByRole('heading', { name: 'Tatort: Der Fall Münster', level: 1 })).toBeVisible();
  await win.getByRole('button', { name: 'Merken' }).click();
  await expect(win.getByRole('button', { name: 'Gemerkt' })).toHaveAttribute('aria-pressed', 'true');
  await win.getByRole('button', { name: 'Reihe abonnieren' }).click();
  await expect(win.getByRole('button', { name: 'Abonniert' })).toBeVisible();

  await win.getByRole('button', { name: 'Merkliste', exact: true }).click();
  await expect(win.getByRole('heading', { name: 'Merkliste', level: 1 })).toBeVisible();
  await expect(win.getByRole('heading', { name: 'Abos' })).toBeVisible();
  await expect(win.getByRole('button', { name: 'Abo „Tatort“ beenden' })).toBeVisible();
  await expect(win.getByRole('region', { name: 'Gemerkt' }).getByRole('button', { name: /^Tatort: Der Fall Münster/ })).toBeVisible();
  await win.screenshot({ path: 'test-results/screens/merkliste.png' });

  await win.getByRole('button', { name: '„Tatort: Der Fall Münster“ aus der Merkliste entfernen' }).click();
  await expect(win.getByText('Noch nichts gemerkt.')).toBeVisible();
  await win.getByRole('button', { name: 'Abo „Tatort“ beenden' }).click();
  await expect(win.getByRole('heading', { name: 'Abos' })).toHaveCount(0);

  await win.getByRole('button', { name: 'Läuft bald ab', exact: true }).click();
  await expect(win.getByRole('heading', { name: 'Läuft bald ab', level: 1 })).toBeVisible();
  await expect(win.getByText('Gerade läuft nichts davon ab.')).toBeVisible();
  await win.getByRole('button', { name: 'Start', exact: true }).click();
});

test('Sender-Seite zeigt nur Sendungen dieser Mediathek', async () => {
  await win.getByRole('button', { name: 'ZDF Mediathek' }).click();
  await expect(win.getByRole('heading', { name: 'ZDF Mediathek', level: 1 })).toBeVisible();
  await expect(win.getByRole('heading', { name: 'Krimi & Thriller', level: 2 })).toHaveCount(0);
  await win.getByRole('button', { name: 'Start', exact: true }).click();
});

test('Suche findet Sendungen über alle Sender und filtert nach Sender', async () => {
  await win.keyboard.press('Control+K');
  await win.keyboard.type('tatort');
  await expect(win.getByRole('heading', { name: 'Suche: „tatort“' })).toBeVisible();
  await expect(win.getByText('3 Treffer')).toBeVisible();
  // Standard: Kacheln
  await expect(win.getByRole('button', { name: /Tatort: Der Fall Münster/ })).toBeVisible();
  await win.screenshot({ path: 'test-results/screens/suche-kacheln.png' });
  // Liste mit Bild und Beschreibung
  await win.getByRole('button', { name: 'Liste', exact: true }).click();
  await expect(win.getByRole('heading', { name: 'Tatort: Der Fall Münster' })).toBeVisible();
  await win.screenshot({ path: 'test-results/screens/suche-liste.png' });
  await win.getByRole('button', { name: 'Kacheln', exact: true }).click();

  await win.getByRole('button', { name: 'ZDF', exact: true }).click();
  await expect(win.getByText('1 Treffer')).toBeVisible();
  await expect(win.getByRole('button', { name: /Terra X: Die Ostsee/ })).toBeVisible();

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
  await expect(win.getByRole('cell', { name: 'Ins Suchfeld springen' })).toBeVisible();
  await expect(win.getByRole('cell', { name: 'Abspielen / Pause' })).toBeVisible();
  await win.getByRole('button', { name: 'Hilfe schließen (Esc)' }).click();
});

test('Genres: Kacheln zeigen, ein Genre öffnen', async () => {
  await win.getByRole('button', { name: 'Genres', exact: true }).click();
  await expect(win.getByRole('heading', { name: 'Genres', level: 1 })).toBeVisible();
  const krimi = win.getByRole('button', { name: /Krimi & Thriller/ });
  await expect(krimi).toContainText('2 Sendungen');
  await win.screenshot({ path: 'test-results/screens/genres.png' });
  await krimi.click();
  await expect(win.getByRole('heading', { name: 'Krimi & Thriller', level: 1 })).toBeVisible();
  await expect(win.getByText('2 Treffer')).toBeVisible();
  await win.screenshot({ path: 'test-results/screens/genre-krimi.png' });
});

test('Hinweis auf eine heruntergeladene neue Version', async () => {
  const hinweis = win.getByRole('region', { name: 'Neue Version' });
  await expect(hinweis).toContainText('Movue 9.9.9 ist da.');
  await expect(hinweis.getByRole('button', { name: 'Jetzt neu starten' })).toBeVisible();
  await win.screenshot({ path: 'test-results/screens/update-hinweis.png' });
  await hinweis.getByRole('button', { name: 'Später' }).click();
  await expect(hinweis).toBeHidden();
});
