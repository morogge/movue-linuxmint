import { useState } from 'react';

/** „Falsch einsortiert?“ – öffnet einen vorausgefüllten Fehlerbericht im Browser */
export function MeldenKnopf({ ziel }: { ziel: { filmId: number } | { gruppe: string; thema: string } }) {
  const [offen, setOffen] = useState(false);
  return (
    <span className="melden">
      <button
        type="button"
        className="text-button"
        onClick={() => void window.movue.melden.einsortierung(ziel).then((ok) => setOffen(ok))}
        title="Art oder Genre stimmen nicht? Öffnet einen vorausgefüllten Fehlerbericht auf GitHub."
      >
        Falsch einsortiert?
      </button>
      {offen && (
        <span className="klein" role="status">
          Im Browser geöffnet – abschicken entscheidest du dort.
        </span>
      )}
    </span>
  );
}
