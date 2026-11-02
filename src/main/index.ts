import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { join } from 'node:path';
import type { IndexZustand, SuchAnfrage } from '@shared/film';
import type { UpdateZustand } from '@shared/update';
import { IndexDienst } from './index/dienst';
import { UpdateDienst } from './update';
import { BildDienst } from './bilder';
import { NutzerDb } from './nutzer';
import { ladeUntertitel } from './untertitel';
import { seitenZiel } from './links';
import { istGruppe } from '@shared/sender';
import { istGenre } from '@shared/genres';

// Für Tests: eigenes Datenverzeichnis statt ~/.config/Movue
if (process.env['MOVUE_DATEN']) app.setPath('userData', process.env['MOVUE_DATEN']);

let index: IndexDienst | null = null;
let update: UpdateDienst | null = null;
let bilder: BildDienst | null = null;
let nutzer: NutzerDb | null = null;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: 'Movue',
    backgroundColor: '#0E0F12',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true
    }
  });

  win.once('ready-to-show', () => win.show());

  // Externe Links im Standardbrowser öffnen, nie in einem App-Fenster
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (!app.isPackaged && devUrl) {
    void win.loadURL(devUrl);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }
  return win;
}

function sendeZustand(z: IndexZustand): void {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send('index:zustand', z);
}

function sendeUpdate(z: UpdateZustand): void {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send('update:zustand', z);
}

ipcMain.handle('app:info', () => ({
  version: app.getVersion(),
  electron: process.versions.electron,
  platform: process.platform
}));

ipcMain.handle('window:toggle-fullscreen', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return false;
  win.setFullScreen(!win.isFullScreen());
  return win.isFullScreen();
});

ipcMain.handle('index:zustand', () => index?.aktuellerZustand() ?? { phase: 'leer', anzahl: 0, stand: null });

ipcMain.handle('index:suche', (_event, anfrage: SuchAnfrage) => {
  if (!index || typeof anfrage?.text !== 'string') return { treffer: [], gesamt: 0 };
  return index.suche(anfrage);
});

ipcMain.handle('index:genres', () => index?.genres() ?? []);

ipcMain.handle('index:reihe', (_event, a: { genre?: unknown; gruppe?: unknown; limit?: unknown }) => {
  if (!index || !istGenre(a?.genre)) return [];
  return index.reihe({
    genre: a.genre,
    gruppe: istGruppe(a.gruppe) ? a.gruppe : null,
    limit: typeof a.limit === 'number' ? a.limit : undefined
  });
});

ipcMain.handle('index:film', (_event, id: unknown) => (index && typeof id === 'number' ? index.film(id) : null));

ipcMain.handle('index:folgen', (_event, id: unknown) => (index && typeof id === 'number' ? index.folgen(id) : []));

ipcMain.handle('bild:url', (_event, website: unknown) =>
  bilder && typeof website === 'string' ? bilder.url(website) : null
);

ipcMain.handle('untertitel:laden', async (_event, url: unknown) => {
  if (typeof url !== 'string') return null;
  try {
    return await ladeUntertitel(url);
  } catch {
    return null;
  }
});

ipcMain.handle('fortschritt:setzen', (_event, url: unknown, position: unknown, dauer: unknown) => {
  if (typeof url === 'string' && typeof position === 'number' && typeof dauer === 'number') {
    nutzer?.setzeFortschritt(url, position, dauer);
  }
});

ipcMain.handle('fortschritt:holen', (_event, url: unknown) => (typeof url === 'string' ? (nutzer?.fortschritt(url) ?? null) : null));

ipcMain.handle('fortschritt:vergessen', (_event, url: unknown) => {
  if (typeof url === 'string') nutzer?.vergessen(url);
});

/** Angefangene Videos mit ihrer Sendung; Videos, die es nicht mehr gibt, fallen weg */
ipcMain.handle('index:weiterschauen', () => {
  if (!nutzer || !index) return [];
  const liste = nutzer.angefangen(30);
  const filme = index.filmeNachUrl(liste.map((f) => f.url));
  return liste
    .filter((f) => filme.has(f.url))
    .map((f) => ({ film: filme.get(f.url)!, position: f.position, dauer: f.dauer }));
});

ipcMain.handle('film:seite-oeffnen', async (_event, film: { website?: unknown; gruppe?: unknown; titel?: unknown }) => {
  if (typeof film?.website !== 'string' || typeof film.titel !== 'string' || !istGruppe(film.gruppe)) return null;
  const ziel = await seitenZiel({ website: film.website, gruppe: film.gruppe, titel: film.titel });
  await shell.openExternal(ziel.url);
  return ziel.art;
});

ipcMain.handle('update:zustand', () => update?.aktuellerZustand() ?? { phase: 'aus' });

ipcMain.handle('update:installieren', () => update?.installieren());

app.whenReady().then(() => {
  const userAgent = `Movue/${app.getVersion()} (+https://github.com/morogge/movue-linuxmint)`;
  index = new IndexDienst(join(app.getPath('userData'), 'index.db'), userAgent, sendeZustand);
  update = new UpdateDienst(sendeUpdate);
  nutzer = new NutzerDb(join(app.getPath('userData'), 'nutzer.db'));
  // Für Tests: keine Abrufe bei den Sendern
  bilder = new BildDienst(
    join(app.getPath('userData'), 'bilder.db'),
    process.env['MOVUE_BILDER_AUS'] ? async () => null : undefined
  );
  createWindow();
  index.start();
  update.start();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  index?.stop();
  update?.stop();
  bilder?.schliessen();
  nutzer?.schliessen();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
