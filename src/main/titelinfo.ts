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
  // Bis zur nächsten Überschrift oder zum Seitenfuß – dahinter stehen Navigation und Impressum
  const ende = rest.search(/<h[1-4][\s>]|<footer[\s>]|<nav[\s>]|<aside[\s>]|<section[\s>]/i);
  const teil = ende >= 0 ? rest.slice(0, ende) : rest;

  // Nur die erste Liste direkt unter der Überschrift
  const liste = /<ul[^>]*>([\s\S]*?)<\/ul>/i.exec(teil);
  const dl = /<dl[^>]*>([\s\S]*?)<\/dl>/i.exec(teil);
  if (liste && (!dl || liste.index < dl.index)) {
    return [...liste[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => teile(m[1])).filter((x): x is Mitwirkende => x !== null);
  }

  const dts = [...(dl ? dl[1] : teil).matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi)];
  if (dts.length) return dts.map((m) => ({ rolle: text(m[1]), name: text(m[2]) })).filter((x) => x.name);

  const zeilen = teil
    .split(/<br\s*\/?>|<\/p>/i)
    .map(teile)
    .filter((x): x is Mitwirkende => x !== null && x.rolle !== '');
  return zeilen;
}

export function leseTitelInfo(html: string): TitelInfo {
  const arte = leseArteCredits(html);
  if (arte) return arte;
  return {
    darsteller: abschnitt(html, /Darsteller(?:innen)?|Besetzung|Mitwirkende/).slice(0, 40),
    stab: abschnitt(html, /Stab/).slice(0, 20)
  };
}

/** Das erste JSON-Array ab `start` (Klammern zählen, Zeichenketten überspringen) */
function jsonArray(text: string, start: number): string | null {
  let tiefe = 0;
  let inString = false;
  for (let i = start; i < text.length && i < start + 40_000; i++) {
    const c = text[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '[') tiefe++;
    else if (c === ']' && --tiefe === 0) return text.slice(start, i + 1);
  }
  return null;
}

/**
 * Arte: Die Seite enthält die Angaben als JSON („credits“: Regie, Darsteller, Land, Jahr …),
 * eingebettet als Zeichenkette – daher erst die maskierten Anführungszeichen auflösen.
 */
export function leseArteCredits(html: string): TitelInfo | null {
  const maskiert = html.indexOf('\\"credits\\":[');
  let roh: string | null = null;
  if (maskiert >= 0) {
    const stueck = html
      .slice(maskiert, maskiert + 40_000)
      .split('\\\\')
      .map((teil) => teil.replace(/\\"/g, '"'))
      .join('\\');
    roh = jsonArray(stueck, stueck.indexOf('['));
  } else {
    const i = html.indexOf('"credits":[');
    if (i >= 0) roh = jsonArray(html, html.indexOf('[', i));
  }
  if (!roh) return null;
  let credits: { code?: string; label?: string; values?: unknown[] }[];
  try {
    credits = JSON.parse(roh) as typeof credits;
  } catch {
    return null;
  }
  const info: TitelInfo = { darsteller: [], stab: [] };
  for (const c of credits) {
    const werte = (c.values ?? []).filter((v): v is string => typeof v === 'string').map((v) => v.trim()).filter(Boolean);
    if (werte.length === 0) continue;
    if (c.code === 'PRODUCTION_YEAR') info.jahr = werte[0];
    else if (c.code === 'COUNTRY') info.land = werte.join(', ');
    else if (c.code === 'ORIGIN') continue;
    else if (c.code === 'ACT' || /darsteller|schauspiel|mit\b|interpret|besetzung/i.test(c.label ?? '')) {
      for (const w of werte) {
        const m = /^(.+?)\s*\((.+)\)$/.exec(w);
        info.darsteller.push(m ? { name: m[1], rolle: m[2] } : { name: w, rolle: '' });
      }
    } else {
      for (const w of werte) info.stab.push({ rolle: (c.label ?? '').replace(/:in$/, ''), name: w });
    }
  }
  info.darsteller = info.darsteller.slice(0, 40);
  info.stab = info.stab.slice(0, 20);
  return info;
}

/** Nur Seiten, die eine Besetzung enthalten können */
export function hatBesetzung(website: string): boolean {
  return /^https?:\/\/(www\.)?(zdf\.de|3sat\.de|arte\.tv)\//.test(website);
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
    // info2: neu ab 0.10, weil 0.9 beim Stab teils den Seitenfuß mitgelesen hat
    this.db.exec('DROP TABLE IF EXISTS info; CREATE TABLE IF NOT EXISTS info2 (website TEXT PRIMARY KEY, json TEXT NOT NULL, zeit INTEGER NOT NULL)');
  }

  schliessen(): void {
    this.db.close();
  }

  async hole(website: string, jetzt = Date.now()): Promise<TitelInfo | null> {
    if (!/^https?:\/\//.test(website)) return null;
    const z = this.db.prepare('SELECT json, zeit FROM info2 WHERE website = ?').get(website) as { json: string; zeit: number } | undefined;
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
              .prepare('INSERT INTO info2 (website, json, zeit) VALUES (?, ?, ?) ON CONFLICT(website) DO UPDATE SET json = excluded.json, zeit = excluded.zeit')
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
