/**
 * Untertitel der Sender in WebVTT umwandeln, das der Player versteht.
 * ZDF, 3sat und ARD liefern EBU-TT-D (TTML), einzelne ARD-Anstalten schon WebVTT.
 * Abgerufen wird im Hauptprozess – dort gelten keine Browser-Beschränkungen (CORS).
 */

const UA = 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0';

/** TTML-Zeitangabe → Sekunden: „00:01:02.500“, „00:01:02:12“ (Frames, 25 fps), „62.5s“, „1500ms“ */
export function ttmlZeit(wert: string): number | null {
  const v = wert.trim();
  let m = /^(\d+):(\d{2}):(\d{2})(?:\.(\d+))?$/.exec(v);
  if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + (m[4] ? Number(`0.${m[4]}`) : 0);
  m = /^(\d+):(\d{2}):(\d{2}):(\d{2})$/.exec(v);
  if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 25;
  m = /^([\d.]+)(h|m|s|ms)$/.exec(v);
  if (m) {
    const n = Number(m[1]);
    return m[2] === 'h' ? n * 3600 : m[2] === 'm' ? n * 60 : m[2] === 's' ? n : n / 1000;
  }
  return null;
}

function vttZeit(sekunden: number): string {
  const ms = Math.round(sekunden * 1000);
  const h = Math.floor(ms / 3_600_000);
  const min = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const rest = ms % 1000;
  const zwei = (n: number) => String(n).padStart(2, '0');
  return `${zwei(h)}:${zwei(min)}:${zwei(s)}.${String(rest).padStart(3, '0')}`;
}

function entitaeten(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
}

/** Wandelt TTML/EBU-TT in WebVTT. Gibt null zurück, wenn nichts Brauchbares darin steht. */
export function ttmlZuVtt(xml: string): string | null {
  const absaetze = xml.matchAll(/<(?:\w+:)?p\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?p>/g);
  const cues: string[] = [];
  for (const [, attribute, inhalt] of absaetze) {
    const begin = /\bbegin="([^"]+)"/.exec(attribute);
    const end = /\bend="([^"]+)"/.exec(attribute);
    if (!begin || !end) continue;
    const von = ttmlZeit(begin[1]);
    const bis = ttmlZeit(end[1]);
    if (von === null || bis === null || bis <= von) continue;
    const text = entitaeten(
      inhalt
        .replace(/<(?:\w+:)?br\s*\/?>/g, '\n')
        .replace(/<[^>]+>/g, '')
        .split('\n')
        .map((z) => z.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join('\n')
    );
    if (!text) continue;
    cues.push(`${vttZeit(von)} --> ${vttZeit(bis)}\n${text}`);
  }
  return cues.length ? `WEBVTT\n\n${cues.join('\n\n')}\n` : null;
}

/** Lädt Untertitel und liefert sie als WebVTT – oder null, wenn es keine (mehr) gibt */
export async function ladeUntertitel(url: string): Promise<string | null> {
  const adresse = url.startsWith('//') ? `https:${url}` : url.replace(/^http:\/\//, 'https://');
  if (!/^https:\/\//.test(adresse)) return null;
  const antwort = await fetch(adresse, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15_000) });
  if (!antwort.ok) return null;
  const text = await antwort.text();
  if (/^﻿?WEBVTT/.test(text)) return text;
  if (/<(?:\w+:)?tt\b/.test(text)) return ttmlZuVtt(text);
  return null;
}
