import type { Film } from './film';

/**
 * „Live & demnächst“: Livestreams der Sender, einzelne Live-Übertragungen und Sendungen, die schon
 * vor ihrem Fernsehtermin in der Mediathek stehen.
 */

export interface LiveAngebot {
  /** Dauerhafte Livestreams der Sender (Das Erste, ZDF, die Dritten …) */
  sender: LiveSender[];
  /** Übertragungen mit Beginn und Länge (Sport, Sondersendungen), laufende zuerst */
  uebertragungen: Film[];
  /** Schon abrufbar, im Fernsehen erst später */
  vorab: Film[];
}

export type LiveGruppe = 'haupt' | 'weitere' | 'dritte';

export interface LiveSender {
  name: string;
  gruppe: LiveGruppe;
  film: Film;
}

/** Livestream eines Senders: Thema „Livestream“ – Event-Streams ohne Länge sind meist längst vorbei */
export function istSenderStream(f: Pick<Film, 'thema'>): boolean {
  return f.thema.trim().toLowerCase() === 'livestream';
}

const NAMEN: [RegExp, string][] = [
  [/^ard tagesschau/i, 'tagesschau24'],
  [/^ard alpha/i, 'ARD alpha'],
  [/^ard one/i, 'ARD ONE'],
  [/^ard$/i, 'Das Erste'],
  [/^arte(\.de)?$/i, 'Arte'],
  [/^3sat$/i, '3sat'],
  [/^zdf\.?info$/i, 'ZDFinfo'],
  [/^zdf\.?neo$/i, 'ZDFneo'],
  [/^wdr \(deutschland\)$/i, 'WDR'],
  [/^radio bremen tv$/i, 'Radio Bremen']
];

/** „ARD Livestream“ → „Das Erste“, „ZDF.neo Livestream“ → „ZDFneo“, „NDR Hamburg“ bleibt */
export function senderName(titel: string): string {
  const kern = titel.replace(/\s*livestream\s*/i, ' ').replace(/\s+/g, ' ').trim();
  for (const [muster, name] of NAMEN) if (muster.test(kern)) return name;
  return kern;
}

const HAUPT = ['Das Erste', 'ZDF', '3sat', 'Arte'];
const WEITERE = ['tagesschau24', 'ARD ONE', 'ARD alpha', 'ZDFinfo', 'ZDFneo'];

export function liveGruppe(name: string): LiveGruppe {
  if (HAUPT.includes(name)) return 'haupt';
  if (WEITERE.includes(name)) return 'weitere';
  return 'dritte';
}

/** Hauptsender in fester Reihenfolge, dann die weiteren, dann die Dritten alphabetisch (Lokalzeiten zuletzt) */
export function sortiereSender(liste: LiveSender[]): LiveSender[] {
  const rang = (s: LiveSender) => {
    const i = [...HAUPT, ...WEITERE].indexOf(s.name);
    return i >= 0 ? i : 100 + (/lokalzeit/i.test(s.name) ? 50 : 0);
  };
  return [...liste].sort((a, b) => rang(a) - rang(b) || a.name.localeCompare(b.name, 'de'));
}

/** Läuft eine Übertragung gerade? `datum` in s, `jetzt` in ms */
export function laeuftJetzt(f: Pick<Film, 'datum' | 'dauer'>, jetzt = Date.now()): boolean {
  const s = jetzt / 1000;
  return f.datum <= s && s < f.datum + Math.max(f.dauer, 60);
}

const TAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** „Heute 20:15“, „Morgen 14:00“, „Sa 14.11. 18:30“ */
export function terminText(datum: number, jetzt = Date.now()): string {
  const d = new Date(datum * 1000);
  const zeit = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const heute = new Date(jetzt);
  heute.setHours(0, 0, 0, 0);
  const tag = Math.floor((d.getTime() - heute.getTime()) / 86_400_000);
  if (tag === 0) return `Heute ${zeit}`;
  if (tag === 1) return `Morgen ${zeit}`;
  return `${TAGE[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}. ${zeit}`;
}

/** So lange vor Beginn meldet sich eine Erinnerung */
export const ERINNERN_VORHER = 5 * 60_000;
