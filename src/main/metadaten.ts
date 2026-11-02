import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { Film } from '@shared/film';
import { filmSchluessel, METADATEN_URL, serienSchluessel, zuTitelInfo, type MetaDatei } from '@shared/metadaten';
import type { TitelInfo } from '@shared/titelinfo';

const TAG = 86_400_000;

/**
 * Hält das Metadaten-Paket (Wikidata) aktuell: einmal am Tag die ganze Datei von GitHub laden,
 * mit ETag, damit unveränderte Dateien nicht neu übertragen werden. Ausfälle sind folgenlos –
 * dann fehlen eben die Zusatzangaben.
 */
export class MetadatenDienst {
  private daten: MetaDatei | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly pfad: string,
    private readonly quelle: string | null = METADATEN_URL,
    private readonly userAgent = 'Movue'
  ) {}

  start(): void {
    this.lies();
    if (!this.quelle) return;
    // Nicht gleich beim Start: zuerst soll das Sendungsverzeichnis laden
    setTimeout(() => void this.aktualisiere(), 60_000).unref();
    this.timer = setInterval(() => void this.aktualisiere(), TAG / 4);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private lies(): void {
    try {
      if (existsSync(this.pfad)) this.daten = JSON.parse(readFileSync(this.pfad, 'utf8')) as MetaDatei;
    } catch {
      this.daten = null;
    }
  }

  /** Lädt die Datei neu, wenn sie älter als einen Tag ist (oder fehlt) */
  async aktualisiere(jetzt = Date.now()): Promise<void> {
    if (!this.quelle) return;
    const meta = `${this.pfad}.etag`;
    let etag: string | null = null;
    let geprueft = 0;
    try {
      [etag, geprueft] = (JSON.parse(readFileSync(meta, 'utf8')) as [string | null, number]) ?? [null, 0];
    } catch {
      // erste Abfrage
    }
    if (this.daten && jetzt - geprueft < TAG) return;
    try {
      const antwort = await fetch(this.quelle, {
        headers: { 'User-Agent': this.userAgent, ...(etag && this.daten ? { 'If-None-Match': etag } : {}) },
        redirect: 'follow',
        signal: AbortSignal.timeout(60_000)
      });
      if (antwort.status === 304) {
        writeFileSync(meta, JSON.stringify([etag, jetzt]));
        return;
      }
      if (!antwort.ok) return;
      const roh = Buffer.from(await antwort.arrayBuffer());
      const text = (roh[0] === 0x1f && roh[1] === 0x8b ? gunzipSync(roh) : roh).toString('utf8');
      const daten = JSON.parse(text) as MetaDatei;
      if (daten.version !== 1 || typeof daten.eintraege !== 'object') return;
      writeFileSync(`${this.pfad}.neu`, text);
      renameSync(`${this.pfad}.neu`, this.pfad);
      writeFileSync(meta, JSON.stringify([antwort.headers.get('etag'), jetzt]));
      this.daten = daten;
    } catch {
      // offline oder Datei kaputt: alte Daten behalten
    }
  }

  stand(): string | null {
    return this.daten?.stand ?? null;
  }

  /** Angaben zu einem Film (über den Titel) */
  film(film: Pick<Film, 'titel'>): TitelInfo | null {
    const e = this.daten?.eintraege[filmSchluessel(film.titel)];
    return e ? zuTitelInfo(e) : null;
  }

  /** Angaben zu einer Serie (über ihren Namen) */
  serie(thema: string): TitelInfo | null {
    const e = this.daten?.eintraege[serienSchluessel(thema)];
    return e ? zuTitelInfo(e) : null;
  }
}
