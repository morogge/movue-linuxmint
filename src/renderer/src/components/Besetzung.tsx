import type { Mitwirkende, TitelInfo } from '@shared/titelinfo';

function Liste({ eintraege, name }: { eintraege: Mitwirkende[]; name: string }) {
  return (
    <ul className="besetzung-liste" aria-label={name}>
      {eintraege.map((d, i) => (
        <li key={`${d.name}-${i}`}>
          <span className="besetzung-name">{d.name}</span>
          {d.rolle && <span className="besetzung-rolle">{d.rolle}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Besetzung und Stab; nennt die Quelle, wenn die Angaben aus Wikidata stammen */
export function Besetzung({ info }: { info: TitelInfo | null }) {
  if (!info || (info.darsteller.length === 0 && info.stab.length === 0)) return null;
  return (
    <section className="besetzung" aria-labelledby="besetzung-titel">
      <h2 id="besetzung-titel">Besetzung</h2>
      {info.darsteller.length > 0 && <Liste eintraege={info.darsteller} name="Darsteller" />}
      {info.stab.length > 0 && (
        <>
          <h2>Stab</h2>
          <Liste eintraege={info.stab} name="Stab" />
        </>
      )}
      {info.quelle === 'wikidata' && info.wikidata && (
        <p className="klein quelle">
          Angaben aus{' '}
          <a href={`https://www.wikidata.org/wiki/${info.wikidata}`} target="_blank" rel="noreferrer">
            Wikidata
          </a>{' '}
          (frei nutzbar, CC0). Fehlt etwas oder stimmt es nicht? Dort kann es jeder ergänzen.
        </p>
      )}
    </section>
  );
}
