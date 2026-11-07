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
      MOVUE_FILMLISTE_VOLL: join(__dirname, '../fixtures/filmliste-serie.json'),
      MOVUE_UPDATE_SIMULIEREN: '9.9.9',
      MOVUE_BILDER_AUS: '1',
      MOVUE_KEINE_MELDUNG: '1',
      MOVUE_METADATEN_DATEI: join(__dirname, '../fixtures/metadaten.json')
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
  await expect(win.getByRole('status')).toContainText('10 Sendungen', { timeout: 60_000 });
  await expect(win.getByRole('status')).toContainText('Stand 01.11.');
  await expect(win.getByRole('heading', { name: 'Neu bei Filmen', level: 2 })).toBeVisible();
  await expect(win.getByRole('heading', { name: 'Neu bei Serien', level: 2 })).toBeVisible();
  await win.screenshot({ path: 'test-results/screens/start.png' });
});

test('Kachel öffnet die Detailseite mit weiteren Folgen, Alt+← führt zurück', async () => {
  await win.getByRole('button', { name: /Tatort: Der Fall Münster/ }).first().click();
  await expect(win.getByRole('heading', { name: 'Tatort: Der Fall Münster', level: 1 })).toBeVisible();
  await expect(win.getByRole('heading', { name: 'Weitere Folgen von „Tatort“' })).toBeVisible();
  await expect(win.getByRole('button', { name: /Tatort: Zweiter Fall/ })).toBeVisible();
  // Besetzung aus dem Metadaten-Paket (Wikidata), weil die ARD keine nennt
  const besetzung = win.getByRole('list', { name: 'Darsteller' });
  await expect(besetzung).toContainText('Axel Prahl');
  await expect(besetzung).toContainText('Frank Thiel');
  await expect(win.getByRole('link', { name: 'Wikidata' })).toBeVisible();
  await win.screenshot({ path: 'test-results/screens/detail.png' });
  await win.keyboard.press('Alt+ArrowLeft');
  await expect(win.getByRole('heading', { name: 'Neu bei Filmen', level: 2 })).toBeVisible();
});

test('Serien erscheinen als eine Kachel und öffnen die Serienseite mit Staffeln', async () => {
  await win.getByRole('button', { name: /In aller Freundschaft/ }).first().click();
  await expect(win.getByRole('heading', { name: 'In aller Freundschaft', level: 1 })).toBeVisible();
  await expect(win.getByText('2 Staffeln · 3 Folgen')).toBeVisible();
  await expect(win.getByRole('button', { name: /Abspielen S27 · F40/ })).toBeVisible();
  await expect(win.getByRole('tab', { name: 'Staffel 27' })).toHaveAttribute('aria-selected', 'true');
  await expect(win.getByRole('list', { name: 'Darsteller' })).toContainText('Thomas Rühmann');
  await win.getByRole('tab', { name: 'Staffel 28' }).click();
  await expect(win.getByRole('button', { name: 'Folge 1102: Alte Freunde (S28/E02) abspielen' })).toBeVisible();
  await win.screenshot({ path: 'test-results/screens/serie.png' });
  await win.getByRole('tab', { name: 'Extras' }).click();
  await expect(win.getByRole('button', { name: 'Vorschau auf Folge 1103 abspielen' })).toBeVisible();
  await win.getByRole('button', { name: 'Start', exact: true }).click();
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
  await expect(win.getByRole('button', { name: '„Tatort: Der Fall Münster“ aus der Merkliste entfernen' })).toBeVisible();
  await win.screenshot({ path: 'test-results/screens/merkliste.png' });

  await win.getByRole('button', { name: '„Tatort: Der Fall Münster“ aus der Merkliste entfernen' }).click();
  await expect(win.getByText('Noch nichts gemerkt.')).toBeVisible();
  await win.getByRole('button', { name: 'Abo „Tatort“ beenden' }).click();
  await expect(win.getByRole('heading', { name: 'Abos' })).toHaveCount(0);

  await win.getByRole('button', { name: 'Alle Kategorien', exact: true }).click();
  await win.getByRole('button', { name: /^Läuft bald ab/ }).click();
  await expect(win.getByRole('heading', { name: 'Läuft bald ab', level: 1 })).toBeVisible();
  await expect(win.getByText('Gerade läuft nichts davon ab.')).toBeVisible();
  await win.getByRole('button', { name: 'Start', exact: true }).click();
});

test('Sender-Seite zeigt nur Sendungen dieser Mediathek', async () => {
  await win.getByRole('button', { name: 'ZDF Mediathek' }).click();
  await expect(win.getByRole('heading', { name: 'ZDF Mediathek', level: 1 })).toBeVisible();
  await expect(win.getByRole('heading', { name: 'Neu bei Serien', level: 2 })).toHaveCount(0);
  await expect(win.getByRole('button', { name: /Terra X: Die Ostsee/ }).first()).toBeVisible();
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
  // Ohne Suchbegriff: Serien gebündelt (In aller Freundschaft = 1 Eintrag statt 4)
  await expect(win.getByText('7 Treffer')).toBeVisible();
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

test('Alle Kategorien: ohne „Weitere Sendungen“, Genre-Seite mit Reitern je Art', async () => {
  await win.getByRole('button', { name: 'Alle Kategorien', exact: true }).click();
  await expect(win.getByRole('heading', { name: 'Alle Kategorien', level: 1 })).toBeVisible();
  await expect(win.getByText('Weitere Sendungen')).toHaveCount(0);
  await expect(win.getByRole('button', { name: /^Magazine/ })).toContainText('nur hier');
  const krimi = win.getByRole('button', { name: /Krimi & Thriller/ });
  await expect(krimi).toContainText('2 Sendungen');
  await win.screenshot({ path: 'test-results/screens/kategorien.png' });
  await krimi.click();
  await expect(win.getByRole('heading', { name: 'Krimi & Thriller', level: 1 })).toBeVisible();
  // Tatort ist eine Filmreihe: Reiter „Filme“ mit beiden Filmen, keine Serien
  await expect(win.getByRole('tab', { name: /^Serien/ })).toHaveCount(0);
  await win.getByRole('tab', { name: /^Filme/ }).click();
  await expect(win.getByRole('tab', { name: /^Filme/ })).toHaveAttribute('aria-selected', 'true');
  await expect(win.getByText('2 Einträge', { exact: false })).toBeVisible();
  await expect(win.getByRole('button', { name: /Tatort: Der Fall Münster/ })).toBeVisible();
  await win.screenshot({ path: 'test-results/screens/genre-krimi.png' });
});

test('Seite einer Art: Serien als eine Kachel, Filter nach Sender', async () => {
  await win.getByRole('button', { name: 'Serien', exact: true }).click();
  await expect(win.getByRole('heading', { name: 'Serien', level: 1 })).toBeVisible();
  await expect(win.getByRole('heading', { name: 'Neu bei Serien', level: 2 })).toBeVisible();
  await expect(win.getByRole('button', { name: /In aller Freundschaft/ }).first()).toBeVisible();
  await win.screenshot({ path: 'test-results/screens/art-serien.png' });
  await win.getByRole('group', { name: 'Sender' }).getByRole('button', { name: 'ZDF' }).click();
  await expect(win.getByRole('button', { name: /In aller Freundschaft/ })).toHaveCount(0);
  await win.getByRole('button', { name: 'Dokus', exact: true }).click();
  await expect(win.getByRole('heading', { name: 'Dokus', level: 1 })).toBeVisible();
  await expect(win.getByRole('group', { name: 'Thema' })).toBeVisible();
  await win.screenshot({ path: 'test-results/screens/art-dokus.png' });
  await win.getByRole('button', { name: 'Start', exact: true }).click();
});

test('Hinweis auf eine heruntergeladene neue Version', async () => {
  const hinweis = win.getByRole('region', { name: 'Neue Version' });
  await expect(hinweis).toContainText('Movue 9.9.9 ist da.');
  await expect(hinweis.getByRole('button', { name: 'Jetzt neu starten' })).toBeVisible();
  await win.screenshot({ path: 'test-results/screens/update-hinweis.png' });
  await hinweis.getByRole('button', { name: 'Später' }).click();
  await expect(hinweis).toBeHidden();
});
