const SENDERS = [
  { name: 'ARD Mediathek', color: 'var(--ard)' },
  { name: 'ZDF Mediathek', color: 'var(--zdf)' },
  { name: '3sat Mediathek', color: 'var(--dreisat)' },
  { name: 'Arte Mediathek', color: 'var(--arte)' }
];

export function StartScreen({ onHelp }: { onHelp: () => void }) {
  return (
    <section className="start" aria-labelledby="start-title">
      <div className="hero">
        <h1 id="start-title">Willkommen bei Movue</h1>
        <p>
          Movue bündelt die Mediatheken der öffentlich-rechtlichen Sender in einer Oberfläche. Diese Vorabversion
          enthält das Grundgerüst; Sendungen, Suche und Player folgen in den nächsten Versionen.
        </p>
        <div className="hero-actions">
          <button type="button" className="primary" onClick={onHelp}>
            Erste Schritte (F1)
          </button>
        </div>
      </div>

      <h2>Geplante Quellen</h2>
      <ul className="sender-list">
        {SENDERS.map((s) => (
          <li key={s.name}>
            <span className="dot" style={{ background: s.color }} />
            {s.name}
          </li>
        ))}
      </ul>
    </section>
  );
}
