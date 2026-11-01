import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { fileURLToPath } from 'node:url';

export type ListenArt = 'voll' | 'diff';

const VERWEIS: Record<ListenArt, string> = {
  voll: 'https://res.mediathekview.de/akt.xml',
  diff: 'https://res.mediathekview.de/diff.xml'
};

const RUECKFALL: Record<ListenArt, string> = {
  voll: 'https://liste.mediathekview.de/Filmliste-akt.xz',
  diff: 'https://liste.mediathekview.de/Filmliste-diff.xz'
};

/** Für Tests: lokale Listen statt des Servers (Pfad oder http-Adresse) */
const UEBERSCHREIBEN: Record<ListenArt, string> = {
  voll: 'MOVUE_FILMLISTE_VOLL',
  diff: 'MOVUE_FILMLISTE_DIFF'
};

/** Liest die Adresse der Liste aus der offiziellen Verweisdatei, mit festem Rückfall. */
export async function listenAdresse(art: ListenArt, userAgent: string): Promise<string> {
  const vorgabe = process.env[UEBERSCHREIBEN[art]];
  if (vorgabe) return vorgabe;
  try {
    const antwort = await fetch(VERWEIS[art], {
      headers: { 'User-Agent': userAgent },
      signal: AbortSignal.timeout(15_000)
    });
    if (antwort.ok) {
      const xml = await antwort.text();
      const treffer = /<URL>\s*([^<\s]+)\s*<\/URL>/.exec(xml);
      if (treffer && /^https:\/\//.test(treffer[1])) return treffer[1];
    }
  } catch {
    // Verweisdatei nicht erreichbar – feste Adresse nehmen
  }
  return RUECKFALL[art];
}

/** Öffnet die Liste (http oder Datei) und entpackt sie bei .xz mit dem Systemprogramm xz. */
export async function oeffneListe(adresse: string, userAgent: string): Promise<Readable> {
  let roh: Readable;
  if (/^https?:\/\//.test(adresse)) {
    const antwort = await fetch(adresse, { headers: { 'User-Agent': userAgent } });
    if (!antwort.ok || !antwort.body) {
      throw new Error(`Die Filmliste konnte nicht geladen werden (HTTP ${antwort.status}).`);
    }
    roh = Readable.fromWeb(antwort.body as unknown as WebReadableStream<Uint8Array>);
  } else {
    roh = createReadStream(adresse.startsWith('file:') ? fileURLToPath(adresse) : adresse);
  }

  if (!adresse.endsWith('.xz')) return roh;

  const xz = spawn('xz', ['-dc'], { stdio: ['pipe', 'pipe', 'pipe'] });
  const fehler: Buffer[] = [];
  xz.stderr.on('data', (d: Buffer) => fehler.push(d));
  xz.on('error', (err: NodeJS.ErrnoException) => {
    const meldung =
      err.code === 'ENOENT'
        ? 'Zum Entpacken der Filmliste fehlt das Programm „xz“ (Paket xz-utils).'
        : `Entpacken fehlgeschlagen: ${err.message}`;
    xz.stdout.destroy(new Error(meldung));
  });
  xz.on('close', (code) => {
    if (code) xz.stdout.destroy(new Error(`Entpacken fehlgeschlagen: ${Buffer.concat(fehler).toString().trim()}`));
  });
  roh.on('error', (err) => xz.stdout.destroy(err));
  roh.pipe(xz.stdin);
  return xz.stdout;
}
