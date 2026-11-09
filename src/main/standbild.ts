/**
 * Standbild aus dem Video selbst – der letzte Ersatz, wenn es die Seite der Sendung beim Sender nicht mehr gibt
 * (bei älteren Einträgen häufig), das Video aber noch abrufbar ist.
 *
 * Ein unsichtbares Fenster ohne Vorschaltskript und ohne Node lädt nur das Video, springt an eine Stelle nach dem
 * Vorspann und zeichnet das Bild in ein Canvas. `webSecurity` ist dort aus, sonst darf das Canvas ein Video von
 * einem fremden Server nicht auslesen. Das Fenster lädt nichts anderes und wird danach geschlossen.
 */
import { BrowserWindow } from 'electron';

/** Nur direkte Videodateien der Sender (HLS bräuchte hls.js im Fenster) */
export function eignetSichFuerStandbild(url: string): boolean {
  return /^https:\/\/[^\s"'<>]+\.(mp4|webm|m4v)(\?[^\s"'<>]*)?$/i.test(url);
}

/** Stelle für das Standbild: nach dem Vorspann, aber nicht zu weit hinten */
export function standbildZeit(dauer: number): number {
  if (!Number.isFinite(dauer) || dauer <= 0) return 5;
  return Math.min(Math.max(dauer * 0.1, 3), 90);
}

function seite(video: string): string {
  // Adresse als JSON eingebettet – kein HTML aus der Filmliste
  return `<!doctype html><meta charset="utf-8"><body><script>
const v = document.createElement('video');
v.muted = true;
v.preload = 'auto';
v.src = ${JSON.stringify(video)};
v.onloadedmetadata = () => {
  const d = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 50;
  v.currentTime = Math.min(Math.max(d * 0.1, 3), 90);
};
v.onseeked = () => {
  const c = document.createElement('canvas');
  const b = 640;
  c.width = b;
  c.height = Math.round(b * (v.videoHeight || 9) / (v.videoWidth || 16));
  c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
  window.__bild = c.toDataURL('image/jpeg', 0.72);
  v.removeAttribute('src');
  v.load();
};
v.onerror = () => { window.__bild = 'FEHLER'; };
</script></body>`;
}

/** Standbild als data:-Adresse (JPEG, 640 px breit) oder null */
export async function standbild(adresse: string, zeitlimit = 20_000): Promise<string | null> {
  // Viele Adressen in der Filmliste beginnen mit http:// – die Server der Sender liefern auch über https
  const video = adresse.replace(/^http:\/\//, 'https://');
  if (!eignetSichFuerStandbild(video)) return null;
  const win = new BrowserWindow({
    show: false,
    width: 640,
    height: 360,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: false, javascript: true, offscreen: true }
  });
  win.webContents.setAudioMuted(true);
  // Keine Navigation, keine neuen Fenster
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(seite(video))}`);
    // Ergebnis abholen (ein Fenstertitel würde lange data:-Adressen kürzen)
    const ende = Date.now() + zeitlimit;
    while (Date.now() < ende) {
      const bild = (await win.webContents.executeJavaScript('window.__bild ?? null', true)) as unknown;
      if (bild === 'FEHLER') return null;
      if (typeof bild === 'string' && bild.startsWith('data:image/jpeg;base64,') && bild.length > 2000) return bild;
      await new Promise((weiter) => setTimeout(weiter, 300));
    }
    return null;
  } catch {
    return null;
  } finally {
    win.destroy();
  }
}
