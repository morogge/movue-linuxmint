import type { Film } from '@shared/film';
import type { Ablauf } from '@shared/nutzer';
import { ardId } from './bilder';
import type { NutzerDb } from './nutzer';

/**
 * Wie lange ein Video noch abrufbar ist. Die Filmliste kennt kein Ablaufdatum; die Sender nennen es
 * aber auf der Sendungsseite (ZDF, 3sat, Arte) bzw. in ihrer Schnittstelle (ARD). Movue fragt nur für
 * gemerkte und angefangene Videos nach und merkt sich das Ergebnis in nutzer.db.
 */

const UA = 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0';
const MAX_BYTES = 2_000_000;
const TAG = 86_400_000;

function zeitpunkt(iso: string): number | null {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/** Tag ohne Uhrzeit (wie „bis 30.11.2026“) → Ende des Tages in deutscher Zeit, gerundet auf 23:59 UTC */
function tagesende(tag: number, monat: number, jahr: number): number | null {
  if (!(tag >= 1 && tag <= 31 && monat >= 1 && monat <= 12 && jahr >= 2000)) return null;
  return Date.UTC(jahr, monat - 1, tag, 21, 59);
}

/** Ablaufdatum aus der ARD-Schnittstelle (page-gateway/item) */
export function ablaufAusArd(json: string): number | null {
  const m = /"availableTo"\s*:\s*"([^"]+)"/.exec(json);
  return m ? zeitpunkt(m[1]) : null;
}

/** Ablaufdatum aus einer Sendungsseite von ZDF, 3sat oder Arte; null = nicht gefunden */
export function ablaufAusSeite(html: string): number | null {
  // ZDF: „Verfügbar bis <time dateTime="2028-04-18T15:05:00.000Z">“ bzw. JSON-LD "expires"
  const zdf = /Verf(?:ü|&uuml;)gbar bis\s*<time[^>]*dateTime="([^"]+)"/i.exec(html) ?? /"expires"\s*:\s*"([^"]+)"/.exec(html);
  if (zdf) return zeitpunkt(zdf[1]);
  // 3sat: <dt …>Verfügbar bis: </dt> <dd …>09.11.2026</dd>
  const dreisat = /Verf(?:ü|&uuml;)gbar bis:?\s*<\/dt>\s*<dd[^>]*>([^<]*)/i.exec(html);
  if (dreisat) {
    const d = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(dreisat[1]);
    if (d) return tagesende(Number(d[1]), Number(d[2]), Number(d[3]));
  }
  // Arte: „Verfügbar bis zum 18/11/2026“
  const arte = /Verf(?:ü|&uuml;)gbar bis zum (\d{2})\/(\d{2})\/(\d{4})/i.exec(html);
  if (arte) return tagesende(Number(arte[1]), Number(arte[2]), Number(arte[3]));
  return null;
}

/** Fragt beim Sender nach. null = nicht ermittelbar (Netz, unbekanntes Format) – dann später noch einmal */
export async function frageAblauf(website: string): Promise<Ablauf | null> {
  const id = ardId(website);
  const adresse = id
    ? `https://api.ardmediathek.de/page-gateway/pages/ard/item/${id}?devicetype=pc&embedded=true`
    : website.replace(/^http:\/\//, 'https://');
  if (!/^https:\/\//.test(adresse)) return null;
  const antwort = await fetch(adresse, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'de-DE,de;q=0.9' },
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000)
  });
  if (antwort.status === 404 || antwort.status === 410) return { bis: null, weg: true };
  if (!antwort.ok || !antwort.body) return null;

  const reader = antwort.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  try {
    while (text.length < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      // Seiten sind groß (Arte ~1 MB): aufhören, sobald das Datum gefunden ist
      if (!id && ablaufAusSeite(text) !== null) break;
    }
  } finally {
    void reader.cancel().catch(() => undefined);
  }
  const bis = id ? ablaufAusArd(text) : ablaufAusSeite(text);
  return { bis, weg: false };
}

/** Wann ein gespeichertes Ergebnis erneut geprüft wird */
export function mussPruefen(gespeichert: (Ablauf & { geprueft: number }) | null, jetzt = Date.now()): boolean {
  if (!gespeichert) return true;
  const alter = jetzt - gespeichert.geprueft;
  if (gespeichert.weg) return alter > 7 * TAG;
  // Kurz vor dem Ende täglich, sonst wöchentlich (Sender verlängern manchmal)
  if (gespeichert.bis !== null && gespeichert.bis - jetzt < 14 * TAG) return alter > TAG;
  return alter > 7 * TAG;
}

/** Holt Ablaufdaten im Hintergrund, höchstens ein paar Anfragen gleichzeitig; Fehler bleiben folgenlos */
export class AblaufDienst {
  private laufend = new Map<string, Promise<Ablauf | null>>();

  constructor(
    private readonly nutzer: NutzerDb,
    private readonly frage: (website: string) => Promise<Ablauf | null> = frageAblauf
  ) {}

  /** Gespeicherter Stand sofort; ist er veraltet, wird im Hintergrund neu gefragt */
  bekannt(film: Pick<Film, 'url' | 'website'>): Ablauf | null {
    const g = this.nutzer.ablauf(film.url);
    if (mussPruefen(g)) void this.pruefe(film);
    return g ? { bis: g.bis, weg: g.weg } : null;
  }

  /** Fragt (falls nötig) beim Sender nach und wartet auf das Ergebnis */
  async hole(film: Pick<Film, 'url' | 'website'>): Promise<Ablauf | null> {
    const g = this.nutzer.ablauf(film.url);
    if (!mussPruefen(g)) return g ? { bis: g.bis, weg: g.weg } : null;
    return (await this.pruefe(film)) ?? (g ? { bis: g.bis, weg: g.weg } : null);
  }

  private pruefe(film: Pick<Film, 'url' | 'website'>): Promise<Ablauf | null> {
    const schon = this.laufend.get(film.url);
    if (schon) return schon;
    const p = (async () => {
      try {
        if (!film.website) return null;
        const a = await this.frage(film.website);
        if (a) this.nutzer.setzeAblauf(film.url, a);
        return a;
      } catch {
        return null;
      } finally {
        this.laufend.delete(film.url);
      }
    })();
    this.laufend.set(film.url, p);
    return p;
  }
}
