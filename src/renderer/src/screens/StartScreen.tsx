import type { IndexZustand } from '@shared/film';
import { formatZahl } from '@shared/format';
import { GRUPPEN } from '@shared/sender';
import { SENDER_FARBE } from '../senderFarben';


interface Props {
  zustand: IndexZustand;
  onHelp: () => void;
  onSuche: () => void;
}

export function StartScreen({ zustand, onHelp, onSuche }: Props) {
  return (
    <section className="start" aria-labelledby="start-title">
      <div className="hero">
        <h1 id="start-title">Willkommen bei Movue</h1>
        <p>
          Movue bündelt die Mediatheken der öffentlich-rechtlichen Sender in einer Oberfläche.
          {zustand.anzahl > 0
            ? ` ${formatZahl(zustand.anzahl)} Sendungen sind durchsuchbar.`
            : ' Das Sendungsverzeichnis wird gerade geladen.'}{' '}
          Stöbern nach Genre und der eigene Player folgen in den nächsten Versionen.
        </p>
        <div className="hero-actions">
          <button type="button" className="primary" onClick={onSuche}>
            Sendung suchen (Strg K)
          </button>
          <button type="button" className="secondary" onClick={onHelp}>
            Erste Schritte (F1)
          </button>
        </div>
      </div>

      <h2>Quellen</h2>
      <ul className="sender-list">
        {GRUPPEN.map((g) => (
          <li key={g.id}>
            <span className="dot" style={{ background: SENDER_FARBE[g.id] }} />
            {g.name}
          </li>
        ))}
      </ul>
    </section>
  );
}
