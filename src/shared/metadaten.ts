import { fassungKern } from './fassung';
import type { GenreId } from './genres';
import { titelKern, type TitelInfo } from './titelinfo';

/**
 * Metadaten-Paket aus Wikidata (CC0): Besetzung, Regie, Jahr, Land, Originaltitel zu Filmen und Serien.
 * Eine GitHub-Action baut die Datei einmal am Tag für alle Titel des Verzeichnisses
 * (scripts/metadaten/baue.ts); die App lädt sie als Ganzes – so erfährt niemand, was du ansiehst.
 */

/** Stand der Einträge: 2 = mit Genres. Ältere gefundene Einträge fragt die Action neu ab */
export const META_STAND = 2;

/** Wikidata-Bezeichnungen → Genres von Movue */
const WD_GENRES: [RegExp, GenreId][] = [
  [/dokumentar/i, 'doku'],
  [/krimi|kriminal|thriller|detektiv|polizei|mord|crime|whodunit|noir|gangster|spionage/i, 'krimi'],
  [/komödie|comedy|sitcom|satire|parodie/i, 'comedy'],
  [/drama|melodram/i, 'drama'],
  [/liebes|romanze|romantisch|familienfilm|familienserie|heimatfilm/i, 'liebe'],
  // „Mystery“ fehlt bewusst: Wikidata nennt so auch Rätselkrimis wie „Death in Paradise“
  [/fantasy|science.?fiction|horror|übernatürlich|dystop|endzeit/i, 'fantasy'],
  [/historien|historisch|kostüm|kriegsfilm|western|biografi|biopic/i, 'historisch'],
  [/kinderfilm|kinderserie|zeichentrick|animationsfilm|animationsserie|jugendfilm|jugendserie/i, 'kinder']
];

/** Genres zu den Wikidata-Angaben; eine Doku ist nie zugleich Krimi (True Crime ist ein Thema) */
export function genresAusWikidata(bezeichnungen: readonly string[]): GenreId[] {
  const genres = new Set<GenreId>();
  for (const b of bezeichnungen) for (const [re, g] of WD_GENRES) if (re.test(b)) genres.add(g);
  if (genres.has('doku')) genres.delete('krimi');
  return [...genres];
}

export const METADATEN_URL = 'https://github.com/morogge/movue-linuxmint/releases/download/metadaten/metadaten.json.gz';

export interface MetaEintrag {
  /** Wikidata-Kennung, z. B. Q22998408; fehlt bei „nicht gefunden“ */
  q?: string;
  /** Jahr der Erstveröffentlichung */
  j?: string;
  /** Produktionsländer */
  l?: string;
  /** Originaltitel, wenn er vom deutschen abweicht */
  o?: string;
  /** Regie */
  r?: string[];
  /** Darsteller: [Name, Rolle] */
  d?: [string, string][];
  /** Genres und Typen aus Wikidata (deutsche Bezeichnungen: „Kriminalfilm“, „Dokumentarserie“) */
  g?: string[];
  /** Stand des Eintrags (fehlt = 1: noch ohne Genres) */
  v?: number;
  /** Zeitpunkt der Abfrage (ms) – auch für „nicht gefunden“, damit nicht täglich neu gefragt wird */
  t: number;
}

export interface MetaDatei {
  version: 1;
  /** Erstellt am (ISO) */
  stand: string;
  eintraege: Record<string, MetaEintrag>;
}

export function filmSchluessel(titel: string): string {
  return `f:${fassungKern(titel)}`;
}

export function serienSchluessel(thema: string): string {
  return `s:${titelKern(thema)}`;
}

/**
 * Titel, unter dem Wikidata den Film vermutlich führt: ohne „– Spielfilm, Italien 2015“, ohne Klammern,
 * ohne Zusätze nach „|“. Dazu eine Variante mit Doppelpunkt („Danowski – Blutapfel“ → „Danowski: Blutapfel“).
 */
export function wikidataTitel(titel: string): string[] {
  const sauber = titel
    .replace(/\s[-–]\s(Spielfilm|Fernsehfilm|Film|Dokumentarfilm|Kurzfilm|Animationsfilm)\b.*$/i, '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s*\|.*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  const varianten = new Set([sauber]);
  const strich = /^(.+?)\s[-–]\s(.+)$/.exec(sauber);
  if (strich) {
    varianten.add(`${strich[1]}: ${strich[2]}`);
    varianten.add(`${strich[1]} – ${strich[2]}`);
  }
  return [...varianten].filter((v) => v.length >= 2);
}

/** Eintrag als Titelinfo für die Seite der Sendung */
export function zuTitelInfo(e: MetaEintrag): TitelInfo | null {
  if (!e.q) return null;
  return {
    darsteller: (e.d ?? []).map(([name, rolle]) => ({ name, rolle })),
    stab: (e.r ?? []).map((name) => ({ rolle: 'Regie', name })),
    jahr: e.j,
    land: e.l,
    originaltitel: e.o,
    wikidata: e.q
  };
}

/**
 * Sender-Angaben gehen vor; was fehlt, ergänzt Wikidata. Die Quelle steht dabei, damit die Seite sie nennen kann.
 */
export function ergaenze(sender: TitelInfo | null, wd: TitelInfo | null): TitelInfo | null {
  if (!wd) return sender;
  if (!sender) return { ...wd, quelle: 'wikidata' };
  const darsteller = sender.darsteller.length ? sender.darsteller : wd.darsteller;
  const stab = sender.stab.length ? sender.stab : wd.stab;
  const ausWd = (!sender.darsteller.length && wd.darsteller.length > 0) || (!sender.stab.length && wd.stab.length > 0);
  return {
    darsteller,
    stab,
    jahr: sender.jahr ?? wd.jahr,
    land: sender.land ?? wd.land,
    originaltitel: wd.originaltitel,
    wikidata: wd.wikidata,
    quelle: ausWd ? 'wikidata' : 'sender'
  };
}
