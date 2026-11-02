import { titelKern } from './titelinfo';

/**
 * Fassungen derselben Sendung: mit Audiodeskription, in Gebärdensprache, im Original … Im Listing steht
 * nur die Standardfassung; die anderen erscheinen als Auswahl auf der Seite der Sendung.
 */

const SPRACHEN: Record<string, string> = {
  swe: 'Schwedisch', dan: 'Dänisch', dän: 'Dänisch', nor: 'Norwegisch', fin: 'Finnisch', isl: 'Isländisch',
  eng: 'Englisch', engl: 'Englisch', fra: 'Französisch', fre: 'Französisch', fr: 'Französisch', ita: 'Italienisch',
  spa: 'Spanisch', esp: 'Spanisch', por: 'Portugiesisch', nld: 'Niederländisch', ndl: 'Niederländisch',
  pol: 'Polnisch', tur: 'Türkisch', ukr: 'Ukrainisch', rus: 'Russisch', heb: 'Hebräisch', ara: 'Arabisch',
  tsch: 'Tschechisch', ces: 'Tschechisch', hun: 'Ungarisch', gre: 'Griechisch', jpn: 'Japanisch', kor: 'Koreanisch'
};

const ZUSATZ = /\((?:[^)]*?\b)?(audiodeskription|gebärdensprache|originalversion|originalfassung|klare sprache|hörfassung|mit untertiteln?|ov|omu)\b[^)]*\)/i;
const ENDE = /\s[-–]\s(audiodeskription|gebärdensprache|hörfassung|originalfassung|originalversion)\s*$/i;
/** Sprachkürzel am Titelende wie „(swe)“ – klein geschrieben, damit „(ZDF)“ oder „(2/3)“ nicht zählen */
const SPRACHE = /\(([a-zäöü]{2,4})\)\s*$/;

/** Name der Fassung, null für die Standardfassung */
export function fassungName(titel: string): string | null {
  const z = ZUSATZ.exec(titel) ?? ENDE.exec(titel);
  if (z) {
    // Den ganzen Zusatz ansehen: „(Originalversion mit Untertitel)“ ist eine Originalfassung
    const t = z[0].toLowerCase();
    if (t.includes('audiodeskription')) return 'Audiodeskription';
    if (t.includes('gebärdensprache')) return 'Gebärdensprache';
    if (t.includes('klare sprache')) return 'Klare Sprache';
    if (t.includes('hörfassung')) return 'Hörfassung';
    if (/omu|original[^)]*untertitel/.test(t)) return 'Original mit Untertiteln';
    if (/original|\bov\b/.test(t)) return 'Originalfassung';
    return 'Mit Untertiteln';
  }
  const s = SPRACHE.exec(titel);
  if (s && SPRACHEN[s[1]]) return `Original (${SPRACHEN[s[1]]})`;
  return null;
}

export function istFassung(titel: string): boolean {
  return fassungName(titel) !== null;
}

/** Schlüssel, unter dem alle Fassungen einer Sendung zusammenfallen */
export function fassungKern(titel: string): string {
  return titelKern(titel.replace(ENDE, '').replace(SPRACHE, ''));
}
