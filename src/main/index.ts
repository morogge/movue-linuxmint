import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { join } from 'node:path';
import type { IndexZustand, SuchAnfrage } from '@shared/film';
import type { UpdateZustand } from '@shared/update';
import { IndexDienst } from './index/dienst';
import { UpdateDienst } from './update';
import { seitenZiel } from './links';
import { istGruppe } from '@shared/sender';

// Für Tests: eigenes Datenverzeichnis statt ~/.config/Movue
if (process.env['MOVUE_DATEN']) app.setPath('userData', process.env['MOVUE_DATEN']);

let index: IndexDienst | null = null;
let update: UpdateDienst | null = null;

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
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
