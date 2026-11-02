/** Wer an einer Sendung mitwirkt: bei Darstellern die Rolle, beim Stab die Aufgabe (z. B. „Regie“) */
export interface Mitwirkende {
  rolle: string;
  name: string;
}

export interface TitelInfo {
  darsteller: Mitwirkende[];
  stab: Mitwirkende[];
  /** Produktionsjahr und -land, sofern der Sender sie nennt (Arte) */
  jahr?: string;
  land?: string;
  /** Originaltitel (Wikidata) */
  originaltitel?: string;
  /** Wikidata-Kennung, wenn Angaben von dort stammen */
  wikidata?: string;
  /** Woher Besetzung und Stab stammen */
  quelle?: 'sender' | 'wikidata';
}

/**
 * Herkunft aus Titel oder Beschreibung: „– Spielfilm, Italien 2015“ (3sat, ZDF) oder
 * „Fernsehfilm Deutschland 2021“ am Anfang der Beschreibung (ARD). null, wenn nichts dasteht.
 */
export function herkunft(titel: string, beschreibung: string): { art: string; land: string; jahr: string } | null {
  const muster = /(Spielfilm|Fernsehfilm|Dokumentarfilm|Kurzfilm|Animationsfilm|Fernsehserie|Serie|Film)[,\s]+([A-ZÄÖÜ][\p{L}/ .,-]*?)\s((?:19|20)\d{2})\b/u;
  const m = muster.exec(titel) ?? muster.exec(beschreibung.slice(0, 160));
  if (!m) return null;
  return { art: m[1], land: m[2].replace(/[,\s]+$/, ''), jahr: m[3] };
}

/** Titel ohne Zusätze, um dieselbe Sendung bei verschiedenen Sendern zu erkennen */
export function titelKern(titel: string): string {
  return titel
    .toLowerCase()
    .replace(/\s[-–]\s(spielfilm|fernsehfilm|film|dokumentarfilm|komödie|thriller|drama|krimi)\b[^-–]*$/i, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
