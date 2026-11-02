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

/** Bildart: Bild der Folge, Titelbild der Serie (16:9) oder breites Banner der Serie (16:7) */
export type BildArt = 'folge' | 'serie' | 'banner';

/**
 * Sucht in der Antwort der ARD-Schnittstelle das Bild der Sendereihe („show“) im gewünschten Format.
 * Die ARD liefert dort eigene Titelbilder je Serie, oft mit Schriftzug – anders als das Szenenbild der Folge.
 */
export function ardSerienBild(json: unknown, format: '16x9' | '16x7'): string | null {
  const stapel: unknown[] = [json];
  let schritte = 0;
  while (stapel.length && schritte++ < 200_000) {
    const o = stapel.pop();
    if (!o || typeof o !== 'object') continue;
    if (Array.isArray(o)) {
      for (const x of o) stapel.push(x);
      continue;
    }
    const rec = o as Record<string, unknown>;
    const show = rec['show'] as Record<string, unknown> | undefined;
    const bilder = show && typeof show === 'object' ? (show['images'] as Record<string, { src?: unknown }> | undefined) : undefined;
    if (bilder && typeof bilder === 'object') {
      const b = bilder[format] ?? bilder[`aspect${format}`];
      if (b && typeof b.src === 'string' && /^https:\/\//.test(b.src)) return b.src;
    }
    for (const v of Object.values(rec)) if (v && typeof v === 'object') stapel.push(v);
  }
  return null;
}

async function ardSerie(id: string, format: '16x9' | '16x7'): Promise<string | null> {
  const antwort = await fetch(`https://api.ardmediathek.de/page-gateway/pages/ard/item/${id}?devicetype=pc&embedded=true`, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(10_000)
  });
  if (!antwort.ok) return null;
  return ardSerienBild(await antwort.json(), format);
}

/**
 * Seite der Sendereihe zu einer Folge bei ZDF und 3sat: die Adresse ohne den letzten Teil,
 * z. B. …/video/serien/under-salt-marsh-100/die-flut-100 → …/video/serien/under-salt-marsh-100
 */
export function serienSeite(website: string): string | null {
  const zdf = /^(https?:\/\/(?:www\.)?zdf\.de\/video\/[^/]+\/[^/]+)\/[^/]+\/?$/.exec(website);
  if (zdf) return zdf[1];
  const dreisat = /^(https?:\/\/(?:www\.)?3sat\.de\/[^/]+\/[^/]+)\/[^/]+\.html$/.exec(website);
  return dreisat ? dreisat[1] : null;
}

/** Titelbild einer Serie: ARD über die Schnittstelle, ZDF und 3sat über die Seite der Sendereihe; sonst null */
export async function findeSerienBild(website: string, art: 'serie' | 'banner'): Promise<string | null> {
  const id = ardId(website);
  if (!id) {
    // ZDF/3sat haben kein Banner-Format; das Titelbild (16:9, oft mit Schriftzug) steht als og:image auf der Seite der Reihe
    const seite = art === 'serie' ? serienSeite(website) : null;
    const bild = seite ? await seitenBild(seite) : null;
    // Ersatzbild der Mediathek (Senderlogo) ist kein Titelbild
    if (!bild || /\/_next\/static\/|zdf_logo|3sat_logo/i.test(bild)) return null;
    return verkleinere(bild);
  }
  const url = await ardSerie(id, art === 'banner' ? '16x7' : '16x9');
  return url ? url.replace(/\{width\}/g, art === 'banner' ? '1600' : '640') : null;
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
    private readonly finde: (website: string) => Promise<string | null> = findeBild,
    private readonly findeSerie: (website: string, art: 'serie' | 'banner') => Promise<string | null> = findeSerienBild
  ) {
    this.db = new Database(pfad);
    this.db.pragma('journal_mode = WAL');
    this.db.exec('CREATE TABLE IF NOT EXISTS bild (website TEXT PRIMARY KEY, url TEXT, zeit INTEGER NOT NULL)');
  }

  schliessen(): void {
    this.db.close();
  }

  /** Bildadresse zu einer Sendungsseite – aus dem Zwischenspeicher oder frisch geholt */
  async url(website: string, art: BildArt = 'folge'): Promise<string | null> {
    if (!/^https?:\/\//.test(website)) return null;
    // Serienbilder unter eigenem Schlüssel, damit sie das Bild der Folge nicht überschreiben
    const schluessel = art === 'folge' ? website : `${art}|${website}`;
    const gespeichert = this.db.prepare('SELECT url, zeit FROM bild WHERE website = ?').get(schluessel) as
      | { url: string | null; zeit: number }
      | undefined;
    if (gespeichert && (gespeichert.url || Date.now() - gespeichert.zeit < NEGATIV_GUELTIG)) return gespeichert.url;

    let p = this.laufend.get(schluessel);
    if (!p) {
      p = this.begrenzt(() => (art === 'folge' ? this.finde(website) : this.findeSerie(website, art)))
        .catch(() => null)
        .then((url) => {
          this.db
            .prepare('INSERT INTO bild (website, url, zeit) VALUES (?, ?, ?) ON CONFLICT(website) DO UPDATE SET url = excluded.url, zeit = excluded.zeit')
            .run(schluessel, url, Date.now());
          this.laufend.delete(schluessel);
          return url;
        });
      this.laufend.set(schluessel, p);
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
