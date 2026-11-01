/**
 * Streaming-Parser für die MediathekView-Filmliste.
 *
 * Die Liste ist ein einziges JSON-Objekt, dessen Einträge alle den Schlüssel "X" tragen
 * ({"Filmliste":[…],"Filmliste":[…],"X":[…],"X":[…],…}). Ein normaler JSON-Parser würde
 * nur den letzten Eintrag behalten und die ganze Datei (≈ 500 MB) im Speicher halten.
 * Dieser Parser liest Bytes in Stücken und meldet jedes Array aus Strings mit seinem Schlüssel.
 */

const QUOTE = 0x22; // "
const BACKSLASH = 0x5c; // \
const OPEN = 0x5b; // [
const CLOSE = 0x5d; // ]

export type ArrayHandler = (key: string, values: string[]) => void;

export class FilmlistenParser {
  private inString = false;
  private escape = false;
  private hasEscape = false;
  private inArray = false;
  private parts: Buffer[] = [];
  private key = '';
  private values: string[] = [];

  constructor(private readonly onArray: ArrayHandler) {}

  push(chunk: Buffer): void {
    let start = this.inString ? 0 : -1;
    const len = chunk.length;

    for (let i = 0; i < len; i++) {
      const b = chunk[i];

      if (this.inString) {
        if (this.escape) {
          this.escape = false;
          continue;
        }
        if (b === BACKSLASH) {
          this.escape = true;
          this.hasEscape = true;
          continue;
        }
        if (b !== QUOTE) continue;

        // Ende des Strings
        const tail = chunk.subarray(start, i);
        const raw = this.parts.length ? Buffer.concat([...this.parts, tail]) : tail;
        this.parts = [];
        this.inString = false;
        const text = raw.toString('utf8');
        this.finishString(this.hasEscape ? (JSON.parse(`"${text}"`) as string) : text);
        continue;
      }

      if (b === QUOTE) {
        this.inString = true;
        this.hasEscape = false;
        start = i + 1;
      } else if (b === OPEN) {
        this.inArray = true;
        this.values = [];
      } else if (b === CLOSE) {
        if (this.inArray) {
          this.inArray = false;
          this.onArray(this.key, this.values);
          this.values = [];
        }
      }
    }

    if (this.inString) {
      // String geht im nächsten Stück weiter – Bytes merken, erst am Ende dekodieren (UTF-8!)
      this.parts.push(Buffer.from(chunk.subarray(start)));
    }
  }

  end(): void {
    if (this.inString || this.inArray) {
      throw new Error('Die Filmliste endet unerwartet.');
    }
  }

  private finishString(value: string): void {
    if (this.inArray) this.values.push(value);
    else this.key = value;
  }
}
