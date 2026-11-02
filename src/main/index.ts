import { app, BrowserWindow, ipcMain, Notification, shell } from 'electron';
import { join } from 'node:path';
import type { IndexZustand, SuchAnfrage } from '@shared/film';
import type { UpdateZustand } from '@shared/update';
import { IndexDienst } from './index/dienst';
import { UpdateDienst } from './update';
import { BildDienst } from './bilder';
import { NutzerDb } from './nutzer';
import { AblaufDienst } from './ablauf';
import { aboMeldung, laeuftBaldAb, type Abo, type Ablauf, type MerkEintrag } from '@shared/nutzer';
import type { Film } from '@shared/film';
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
let ablauf: AblaufDienst | null = null;
/** Stand des Verzeichnisses, für den die Abos zuletzt geprüft wurden */
let aboStand: number | null = null;

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
  // Nach jedem neu geladenen Verzeichnis: neue Folgen in den Abos melden
  if (z.phase === 'bereit' && z.fortschritt === undefined && z.stand !== aboStand) {
    aboStand = z.stand;
    pruefeAbos();
  }
}

function zeigeFenster(screen: string): void {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
  win.webContents.send('navigation', screen);
}

/** Meldet neue Folgen abonnierter Reihen, jede Folge nur einmal */
function pruefeAbos(): void {
  if (!nutzer || !index) return;
  const neue: { thema: string; neu: number }[] = [];
  for (const a of nutzer.abos()) {
    const stand = index.reihenStand(a.gruppe, a.thema, a.gemeldet);
    if (!stand?.neueste || stand.neu === 0) continue;
    neue.push({ thema: a.thema, neu: stand.neu });
    nutzer.aboGemeldet(a.gruppe, a.thema, stand.neueste.datum);
  }
  const meldung = aboMeldung(neue);
  if (!meldung) return;
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send('abo:neu');
  if (process.env['MOVUE_KEINE_MELDUNG'] || !Notification.isSupported()) return;
  const n = new Notification({ title: meldung.titel, body: meldung.text });
  n.on('click', () => zeigeFenster('merkliste'));
  n.show();
}

function aboListe(): Abo[] {
  if (!nutzer || !index) return [];
  return nutzer.abos().flatMap((a) => {
    const stand = index!.reihenStand(a.gruppe, a.thema, a.gesehen);
    if (!istGruppe(a.gruppe)) return [];
    return [{ gruppe: a.gruppe, thema: a.thema, seit: a.seit, anzahl: stand?.anzahl ?? 0, neu: stand?.neu ?? 0, neueste: stand?.neueste ?? null }];
  });
}

function merkListe(): MerkEintrag[] {
  if (!nutzer || !index) return [];
  const liste = nutzer.merkliste();
  const aktuell = index.filmeNachUrl(liste.map((e) => e.film.url));
  return liste.map((e) => {
    const film = aktuell.get(e.film.url);
    return { film: film ?? e.film, zeit: e.zeit, verfuegbar: film !== undefined, ablauf: ablauf?.bekannt(e.film) ?? null };
  });
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

ipcMain.handle('merkliste:liste', () => merkListe());

ipcMain.handle('merkliste:ist', (_event, url: unknown) => (typeof url === 'string' ? (nutzer?.istGemerkt(url) ?? false) : false));

/** Merken über die id, damit nur Sendungen aus dem Verzeichnis gespeichert werden; Entfernen über die Adresse */
ipcMain.handle('merkliste:setzen', (_event, ziel: { id?: unknown; url?: unknown }, an: unknown) => {
  if (!nutzer) return false;
  if (an === true && typeof ziel?.id === 'number') {
    const film = index?.film(ziel.id);
    if (!film) return false;
    nutzer.merken(film);
    void ablauf?.hole(film);
    return true;
  }
  if (an === false && typeof ziel?.url === 'string') nutzer.entmerken(ziel.url);
  return false;
});

ipcMain.handle('abo:liste', () => aboListe());

ipcMain.handle('abo:ist', (_event, r: { gruppe?: unknown; thema?: unknown }) =>
  typeof r?.gruppe === 'string' && typeof r.thema === 'string' ? nutzer?.abo(r.gruppe, r.thema) !== null : false
);

ipcMain.handle('abo:setzen', (_event, r: { gruppe?: unknown; thema?: unknown }, an: unknown) => {
  if (!nutzer || !index || !istGruppe(r?.gruppe) || typeof r.thema !== 'string') return false;
  if (an === false) {
    nutzer.abbestellen(r.gruppe, r.thema);
    return false;
  }
  const stand = index.reihenStand(r.gruppe, r.thema, 0);
  if (!stand?.neueste || !index.istReihe(r.thema)) return false;
  nutzer.abonnieren(r.gruppe, r.thema, stand.neueste.datum);
  return true;
});

ipcMain.handle('abo:gesehen', (_event, r: { gruppe?: unknown; thema?: unknown }) => {
  if (!nutzer || !index || typeof r?.gruppe !== 'string' || typeof r.thema !== 'string') return;
  const stand = index.reihenStand(r.gruppe, r.thema, 0);
  if (stand?.neueste) nutzer.aboGesehen(r.gruppe, r.thema, stand.neueste.datum);
});

ipcMain.handle('ablauf:holen', async (_event, id: unknown): Promise<Ablauf | null> => {
  if (!ablauf || !index || typeof id !== 'number') return null;
  const film = index.film(id);
  return film ? ablauf.hole(film) : null;
});

/** Gemerkte und angefangene Videos, die in den nächsten Tagen ablaufen – bald endende zuerst */
ipcMain.handle('ablauf:bald', (): { film: Film; ablauf: Ablauf; gemerkt: boolean }[] => {
  if (!nutzer || !index || !ablauf) return [];
  const gemerkt = merkListe().filter((e) => e.verfuegbar);
  const angefangen = nutzer.angefangen(30);
  const filme = index.filmeNachUrl(angefangen.map((f) => f.url));
  const kandidaten = new Map<string, { film: Film; gemerkt: boolean }>();
  for (const e of gemerkt) kandidaten.set(e.film.url, { film: e.film, gemerkt: true });
  for (const f of filme.values()) if (!kandidaten.has(f.url)) kandidaten.set(f.url, { film: f, gemerkt: false });
  const liste: { film: Film; ablauf: Ablauf; gemerkt: boolean }[] = [];
  for (const k of kandidaten.values()) {
    const a = ablauf.bekannt(k.film);
    if (a && laeuftBaldAb(a)) liste.push({ ...k, ablauf: a });
  }
  return liste.sort((x, y) => (x.ablauf.bis ?? 0) - (y.ablauf.bis ?? 0));
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
  ablauf = new AblaufDienst(nutzer, process.env['MOVUE_BILDER_AUS'] ? async () => null : undefined);
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
