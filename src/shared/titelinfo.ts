/** Wer an einer Sendung mitwirkt: bei Darstellern die Rolle, beim Stab die Aufgabe (z. B. „Regie“) */
export interface Mitwirkende {
  rolle: string;
  name: string;
}

export interface TitelInfo {
  darsteller: Mitwirkende[];
  stab: Mitwirkende[];
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
