import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import { RELEASES_URL, type UpdateZustand } from '@shared/update';

const PRUEF_INTERVALL = 6 * 60 * 60 * 1000;
const ERSTE_PRUEFUNG = 15 * 1000;

/**
 * Sucht bei GitHub-Releases nach neuen Versionen, lädt sie im Hintergrund und installiert sie
 * auf Wunsch sofort oder beim Beenden.
 *
 * AppImage: Datei wird ersetzt. .deb: Installation über pkexec (Mint fragt nach dem Passwort).
 * Klappt beides nicht, zeigt die App einen Link zur Release-Seite.
 */
export class UpdateDienst {
  private zustand: UpdateZustand = { phase: 'aus' };
  private neueVersion: string | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly melde: (z: UpdateZustand) => void) {}

  start(): void {
    // Für Tests: einen fertigen Download vortäuschen, ohne den Server zu fragen
    const simuliert = process.env['MOVUE_UPDATE_SIMULIEREN'];
    if (simuliert) {
      this.setze({ phase: 'bereit', version: simuliert });
      return;
    }
    // Nur im installierten Paket – im Entwicklungsmodus gibt es nichts zu aktualisieren
    if (!app.isPackaged) return;

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = false;

    autoUpdater.on('checking-for-update', () => {
      if (this.zustand.phase === 'aus' || this.zustand.phase === 'aktuell') this.setze({ phase: 'pruefe' });
    });
    autoUpdater.on('update-not-available', () => this.setze({ phase: 'aktuell' }));
    autoUpdater.on('update-available', (info) => {
      this.neueVersion = info.version;
      this.setze({ phase: 'laedt', version: info.version, prozent: 0 });
    });
    autoUpdater.on('download-progress', (p) => {
      if (this.neueVersion) this.setze({ phase: 'laedt', version: this.neueVersion, prozent: Math.round(p.percent) });
    });
    autoUpdater.on('update-downloaded', (info) => this.setze({ phase: 'bereit', version: info.version }));
    autoUpdater.on('error', (err) => {
      console.error('Update fehlgeschlagen:', err);
      // Neue Version bekannt, aber Laden/Installieren klappt nicht: Download-Link anbieten
      if (this.neueVersion) {
        this.setze({ phase: 'manuell', version: this.neueVersion, url: `${RELEASES_URL}/tag/v${this.neueVersion}` });
      } else if (this.zustand.phase === 'pruefe') {
        this.setze({ phase: 'aktuell' });
      }
    });

    setTimeout(() => this.pruefe(), ERSTE_PRUEFUNG);
    this.timer = setInterval(() => this.pruefe(), PRUEF_INTERVALL);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  aktuellerZustand(): UpdateZustand {
    return this.zustand;
  }

  installieren(): void {
    if (this.zustand.phase !== 'bereit') return;
    if (process.env['MOVUE_UPDATE_SIMULIEREN']) return;
    autoUpdater.quitAndInstall(false, true);
  }

  private pruefe(): void {
    // Läuft schon ein Download oder wartet eins aufs Installieren, nicht erneut fragen
    if (this.zustand.phase === 'laedt' || this.zustand.phase === 'bereit') return;
    autoUpdater.checkForUpdates().catch((err: unknown) => console.error('Update-Prüfung fehlgeschlagen:', err));
  }

  private setze(z: UpdateZustand): void {
    this.zustand = z;
    this.melde(z);
  }
}
