import { useVorschauen, useWenigBewegung } from '../einstellungen';

/** Einstellungen dieses Rechners */
export function EinstellungenScreen() {
  const [vorschauen, setVorschauen] = useVorschauen();
  const wenigBewegung = useWenigBewegung();

  return (
    <section className="einstellungen" aria-labelledby="einstellungen-titel">
      <header className="seiten-kopf">
        <h1 id="einstellungen-titel">Einstellungen</h1>
        <p className="seiten-text">Movue merkt sich diese Einstellungen auf diesem Rechner.</p>
      </header>

      <section aria-labelledby="e-wiedergabe" className="kategorie-gruppe">
        <h2 id="e-wiedergabe">Wiedergabe</h2>
        <label className="schalter">
          <input type="checkbox" role="switch" checked={vorschauen} onChange={(e) => setVorschauen(e.target.checked)} />
          <span className="schalter-text">
            <span className="kategorie-name">Vorschauen automatisch abspielen</span>
            <span className="kategorie-zahl">
              Hat eine Serie oder Sendung einen Trailer, läuft er oben auf ihrer Seite einmal ohne Ton ab. Über den Knopf „Trailer“ kannst du ihn
              jederzeit im Player ansehen.
            </span>
          </span>
        </label>
        {wenigBewegung && (
          <p className="hinweis">Dein System wünscht weniger Bewegung – deshalb laufen Vorschauen gerade nicht von selbst, egal wie dieser Schalter steht.</p>
        )}
        <p className="anzahl">Qualität, Untertitel, Lautstärke und das automatische Abspielen der nächsten Folge stellst du direkt im Player ein.</p>
      </section>
    </section>
  );
}
