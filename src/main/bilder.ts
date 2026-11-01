import Database from 'better-sqlite3';

/**
 * Vorschaubilder für Sendungen. Die Filmliste hat keine Bilder; die Sendungsseiten der Sender
 * haben aber ein Vorschaubild für soziale Netzwerke (og:image). Für die ARD gibt es eine schnellere
 * Schnittstelle. Ergebnisse landen in einer eigenen kleinen Datenbank (bilder.db), die das tägliche
 * Neuladen des Sendungsverzeichnisses übersteht.
 */

const UA = 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0';
const MAX_BYTES = 600_000;
const GLEICHZEITIG = 6;
const TAG = 86_400_000;
/** Ohne Bild erneut versuchen nach … */
const NEGATIV_GUELTIG = 3 * TAG;

/** og:image aus HTML (auch mit vertauschter Attribut-Reihenfolge) */
export function extrahiereOgImage(html: string): string | null {
  const m =
    /<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i.exec(html) ??
    /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i.exec(html);
  if (!m) return null;
  const url = m[1].replace(/&amp;/g, '&');
  return /^https:\/\//.test(url) ? url : null;
}

/** Kennung einer ARD-Sendung aus der Adresse www.ardmediathek.de/video/<id> */
export function ardId(website: string): string | null {
  const m = /^https?:\/\/(?:www\.)?ardmediathek\.de\/video\/(?:[^/?#]+\/)*?([A-Za-z0-9_-]{20,})(?:[/?#]|$)/.exec(website);
  return m ? m[1] : null;
}

/** Bilder in Kachelgröße anfordern statt in 1920 Pixeln, wo der Sender das unterstützt */
export function verkleinere(url: string): string {
  return url
    .replace(/(api\.ardmediathek\.de\/image-service\/images\/[^?]+\?)w=\{width\}/, '$1w=640')
    .replace(/\{width\}/g, '640')
    .replace(/~1920x1080(\?|$)/, '~768x432$1')
    .replace(/~1280x720(\?|$)/, '~768x432$1');
}

/** ARD: Bild über die Schnittstelle der Mediathek (schneller als die Seite) */
async function ardBild(id: string): Promise<string | null> {
  const antwort = await fetch(`https://api.ardmediathek.de/page-gateway/pages/ard/item/${id}?devicetype=pc&embedded=true`, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(10_000)
  });
  if (!antwort.ok) return null;
  const text = await antwort.text();
  const m = /"src"\s*:\s*"(https:\/\/api\.ardmediathek\.de\/image-service\/images\/[^"]+)"/.exec(text);
  return m ? m[1] : null;
}

/** Liest die Seite nur so weit, bis das og:image gefunden ist (Arte-Seiten sind ~1 MB groß) */
async function seitenBild(website: string): Promise<string | null> {
  const antwort = await fetch(website.replace(/^http:\/\//, 'https://'), {
    headers: { 'User-Agent': UA, 'Accept-Language': 'de-DE,de;q=0.9' },
    redirect: 'follow',
    signal: AbortSignal.timeout(15_000)
  });
  if (!antwort.ok || !antwort.body) return null;
  const reader = antwort.body.getReader();
  const decoder = new TextDecoder();
  let html = '';
  try {
    while (html.length < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      const bild = extrahiereOgImage(html);
      if (bild) return bild;
      if (/<\/head>/i.test(html)) break;
    }
    return extrahiereOgImage(html);
  } finally {
    void reader.cancel().catch(() => undefined);
  }
}

export async function findeBild(website: string): Promise<string | null> {
  if (!/^https?:\/\//.test(website)) return null;
  const id = ardId(website);
  let bild: string | null = null;
  if (id) bild = await ardBild(id).catch(() => null);
  bild ??= await seitenBild(website);
  return bild ? verkleinere(bild) : null;
}

export class BildDienst {
  private db: Database.Database;
  private laufend = new Map<string, Promise<string | null>>();
  private warteschlange: (() => void)[] = [];
  private aktiv = 0;

  constructor(
    pfad: string,
    private readonly finde: (website: string) => Promise<string | null> = findeBild
  ) {
    this.db = new Database(pfad);
    this.db.pragma('journal_mode = WAL');
    this.db.exec('CREATE TABLE IF NOT EXISTS bild (website TEXT PRIMARY KEY, url TEXT, zeit INTEGER NOT NULL)');
  }

  schliessen(): void {
    this.db.close();
  }

  /** Bildadresse zu einer Sendungsseite – aus dem Zwischenspeicher oder frisch geholt */
  async url(website: string): Promise<string | null> {
    if (!/^https?:\/\//.test(website)) return null;
    const gespeichert = this.db.prepare('SELECT url, zeit FROM bild WHERE website = ?').get(website) as
      | { url: string | null; zeit: number }
      | undefined;
    if (gespeichert && (gespeichert.url || Date.now() - gespeichert.zeit < NEGATIV_GUELTIG)) return gespeichert.url;

    let p = this.laufend.get(website);
    if (!p) {
      p = this.begrenzt(() => this.finde(website))
        .catch(() => null)
        .then((url) => {
          this.db
            .prepare('INSERT INTO bild (website, url, zeit) VALUES (?, ?, ?) ON CONFLICT(website) DO UPDATE SET url = excluded.url, zeit = excluded.zeit')
            .run(website, url, Date.now());
          this.laufend.delete(website);
          return url;
        });
      this.laufend.set(website, p);
    }
    return p;
  }

  /** Höchstens GLEICHZEITIG Abrufe parallel – die Seiten der Sender sollen nicht überrannt werden */
  private async begrenzt<T>(aufgabe: () => Promise<T>): Promise<T> {
    if (this.aktiv >= GLEICHZEITIG) await new Promise<void>((weiter) => this.warteschlange.push(weiter));
    this.aktiv++;
    try {
      return await aufgabe();
    } finally {
      this.aktiv--;
      this.warteschlange.shift()?.();
    }
  }
}
