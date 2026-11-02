import Database from 'better-sqlite3';
import type { Mitwirkende, TitelInfo } from '@shared/titelinfo';

/**
 * Besetzung und Stab aus den Sendungsseiten von ZDF und 3sat. Die ARD und Arte liefern keine
 * auslesbare Liste; dort bleibt die Info leer. Ergebnisse landen in infos.db und werden selten neu geholt.
 */

const UA = 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0';
const MAX_BYTES = 1_500_000;
const TAG = 86_400_000;
const GUELTIG = 30 * TAG;
const LEER_GUELTIG = 7 * TAG;

const ENTITAETEN: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß', eacute: 'é', egrave: 'è', ndash: '–'
};

function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+\d*);/gi, (m, e: string) => {
      if (e.startsWith('#x')) return String.fromCodePoint(parseInt(e.slice(2), 16));
      if (e.startsWith('#')) return String.fromCodePoint(Number(e.slice(1)));
      return ENTITAETEN[e] ?? m;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/** „Rolle - Name“, „Rolle: Name“ oder „Rolle – Name“; ohne Trenner nur ein Name */
function teile(eintrag: string): Mitwirkende | null {
  const t = text(eintrag);
  if (!t || t.length > 160) return null;
  const m = /^(.+?)\s+[-–]\s+(.+)$/.exec(t) ?? /^(.+?):\s+(.+)$/.exec(t);
  return m ? { rolle: m[1].trim(), name: m[2].trim() } : { rolle: '', name: t };
}

/** Einträge unter einer Überschrift wie „Darsteller“ oder „Stab“ – Liste, Definitionsliste oder Zeilen */
function abschnitt(html: string, ueberschrift: RegExp): Mitwirkende[] {
  const kopf = new RegExp(`<h[2-4][^>]*>\\s*(?:${ueberschrift.source})\\s*</h[2-4]>`, 'i').exec(html);
  if (!kopf) return [];
  const rest = html.slice(kopf.index + kopf[0].length, kopf.index + kopf[0].length + 20_000);
  const ende = rest.search(/<h[1-4][\s>]/i);
  const teil = ende >= 0 ? rest.slice(0, ende) : rest;

  const listen = [...teil.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => m[1]);
  if (listen.length) return listen.map(teile).filter((x): x is Mitwirkende => x !== null);

  const dts = [...teil.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi)];
  if (dts.length) return dts.map((m) => ({ rolle: text(m[1]), name: text(m[2]) })).filter((x) => x.name);

  const zeilen = teil
    .split(/<br\s*\/?>|<\/p>/i)
    .map(teile)
    .filter((x): x is Mitwirkende => x !== null && x.rolle !== '');
  return zeilen;
}

export function leseTitelInfo(html: string): TitelInfo {
  return {
    darsteller: abschnitt(html, /Darsteller(?:innen)?|Besetzung|Mitwirkende/).slice(0, 40),
    stab: abschnitt(html, /Stab/).slice(0, 20)
  };
}

/** Nur Seiten, die eine Besetzung enthalten können */
export function hatBesetzung(website: string): boolean {
  return /^https?:\/\/(www\.)?(zdf|3sat)\.de\//.test(website);
}

export async function frageTitelInfo(website: string): Promise<TitelInfo | null> {
  if (!hatBesetzung(website)) return { darsteller: [], stab: [] };
  const antwort = await fetch(website.replace(/^http:\/\//, 'https://'), {
    headers: { 'User-Agent': UA, 'Accept-Language': 'de-DE,de;q=0.9' },
    redirect: 'follow',
    signal: AbortSignal.timeout(15_000)
  });
  if (!antwort.ok || !antwort.body) return antwort.status === 404 ? { darsteller: [], stab: [] } : null;
  const reader = antwort.body.getReader();
  const decoder = new TextDecoder();
  let html = '';
  try {
    while (html.length < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
    }
  } finally {
    void reader.cancel().catch(() => undefined);
  }
  return leseTitelInfo(html);
}

export class TitelInfoDienst {
  private db: Database.Database;
  private laufend = new Map<string, Promise<TitelInfo | null>>();

  constructor(
    pfad: string,
    private readonly frage: (website: string) => Promise<TitelInfo | null> = frageTitelInfo
  ) {
    this.db = new Database(pfad);
    this.db.pragma('journal_mode = WAL');
    this.db.exec('CREATE TABLE IF NOT EXISTS info (website TEXT PRIMARY KEY, json TEXT NOT NULL, zeit INTEGER NOT NULL)');
  }

  schliessen(): void {
    this.db.close();
  }

  async hole(website: string, jetzt = Date.now()): Promise<TitelInfo | null> {
    if (!/^https?:\/\//.test(website)) return null;
    const z = this.db.prepare('SELECT json, zeit FROM info WHERE website = ?').get(website) as { json: string; zeit: number } | undefined;
    if (z) {
      const info = JSON.parse(z.json) as TitelInfo;
      const leer = info.darsteller.length === 0 && info.stab.length === 0;
      if (jetzt - z.zeit < (leer ? LEER_GUELTIG : GUELTIG)) return info;
    }
    let p = this.laufend.get(website);
    if (!p) {
      p = this.frage(website)
        .catch(() => null)
        .then((info) => {
          if (info) {
            this.db
              .prepare('INSERT INTO info (website, json, zeit) VALUES (?, ?, ?) ON CONFLICT(website) DO UPDATE SET json = excluded.json, zeit = excluded.zeit')
              .run(website, JSON.stringify(info), jetzt);
          }
          this.laufend.delete(website);
          return info;
        });
      this.laufend.set(website, p);
    }
    return p;
  }
}
