import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { join } from 'node:path';
import type { IndexZustand, SuchAnfrage } from '@shared/film';
import { IndexDienst } from './index/dienst';

// Für Tests: eigenes Datenverzeichnis statt ~/.config/Movue
if (process.env['MOVUE_DATEN']) app.setPath('userData', process.env['MOVUE_DATEN']);

let index: IndexDienst | null = null;

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

app.whenReady().then(() => {
  const userAgent = `Movue/${app.getVersion()} (+https://github.com/morogge/movue-linuxmint)`;
  index = new IndexDienst(join(app.getPath('userData'), 'index.db'), userAgent, sendeZustand);
  createWindow();
  index.start();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => index?.stop());

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
