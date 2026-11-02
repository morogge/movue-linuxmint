/**
 * Abfragen an Wikidata (SPARQL). Nur für die GitHub-Action „Metadaten“, nie aus der App heraus.
 * Höflich: eigener User-Agent, eine Anfrage nach der anderen, Pausen dazwischen.
 */

const ENDPUNKT = 'https://query.wikidata.org/sparql';
const UA = 'Movue-Metadaten/1.0 (https://github.com/morogge/movue-linuxmint; Wikidata-Abgleich einmal täglich)';

/** Wikidata-Klassen für Filme und Serien */
export const FILM_TYPEN = ['Q11424', 'Q506240', 'Q24862', 'Q202866', 'Q93204', 'Q226730', 'Q130232', 'Q24869'];
export const SERIEN_TYPEN = ['Q5398426', 'Q1259759', 'Q526877', 'Q15416', 'Q63952888', 'Q117467246'];

type Bindung = Record<string, { value: string } | undefined>;

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function sparql(abfrage: string, versuche = 3): Promise<Bindung[]> {
  for (let i = 0; i < versuche; i++) {
    const antwort = await fetch(ENDPUNKT, {
      method: 'POST',
      headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/sparql-results+json' },
      body: 'query=' + encodeURIComponent(abfrage),
      signal: AbortSignal.timeout(90_000)
    }).catch(() => null);
    if (antwort?.ok) {
      const j = (await antwort.json()) as { results: { bindings: Bindung[] } };
      await pause(800);
      return j.results.bindings;
    }
    // 429/503: Wikidata bittet um Pause
    const warten = Number(antwort?.headers.get('retry-after')) || 10 * (i + 1);
    await pause(warten * 1000);
  }
  throw new Error('Wikidata antwortet nicht');
}

const zeichen = (s: string) => JSON.stringify(s);
const qid = (uri?: string) => uri?.split('/').pop() ?? '';

export interface Kandidat {
  label: string;
  q: string;
  jahr?: string;
}

/** Items, deren deutsches Label genau einem der Titel entspricht und die zu den Typen gehören */
export async function suche(titel: string[], typen: string[]): Promise<Kandidat[]> {
  if (titel.length === 0) return [];
  const abfrage = `SELECT ?label ?item (MIN(?d) AS ?jahr) WHERE {
    VALUES ?label { ${titel.map((t) => `${zeichen(t)}@de`).join(' ')} }
    ?item rdfs:label ?label ; wdt:P31 ?typ .
    VALUES ?typ { ${typen.map((t) => `wd:${t}`).join(' ')} }
    OPTIONAL { ?item wdt:P577 ?d }
  } GROUP BY ?label ?item`;
  return (await sparql(abfrage)).map((b) => ({ label: b.label?.value ?? '', q: qid(b.item?.value), jahr: b.jahr?.value.slice(0, 4) }));
}

export interface Details {
  darsteller: [string, string][];
  regie: string[];
  land: string[];
  jahr?: string;
  original?: string;
}

/** Besetzung (mit Rolle, wo eingetragen), Regie, Land, Jahr, Originaltitel für mehrere Items */
export async function details(items: string[]): Promise<Map<string, Details>> {
  const map = new Map<string, Details>();
  if (items.length === 0) return map;
  const werte = items.map((q) => `wd:${q}`).join(' ');
  const leer = (): Details => ({ darsteller: [], regie: [], land: [] });
  const hole = (q: string) => {
    let d = map.get(q);
    if (!d) map.set(q, (d = leer()));
    return d;
  };

  // Namen über den Label-Dienst: deutsch, sonst englisch – je Person genau eine Zeile
  const besetzung = await sparql(`SELECT ?item ?name ?rolle ?rolleText WHERE {
    VALUES ?item { ${werte} }
    ?item p:P161 ?st . ?st ps:P161 ?p .
    OPTIONAL { ?st pq:P453 ?r }
    OPTIONAL { ?st pq:P4633 ?rolleText }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en". ?p rdfs:label ?name . ?r rdfs:label ?rolle . }
  }`);
  const gesehen = new Set<string>();
  for (const b of besetzung) {
    const q = qid(b.item?.value);
    const name = b.name?.value;
    if (!q || !name) continue;
    const k = `${q}|${name}`;
    const d = hole(q);
    // Rolle: Text-Angabe oder Label der Figur; ohne Label liefert der Dienst nur die Kennung (Q…) – die verwerfen
    const rohRolle = b.rolleText?.value ?? b.rolle?.value ?? '';
    const rolle = /^Q\d+$/.test(rohRolle) ? '' : rohRolle;
    if (/^Q\d+$/.test(name)) continue;
    if (gesehen.has(k)) {
      // Doppelte Zeile (de/en-Label): eine mit Rolle behalten
      const vorhanden = d.darsteller.find(([n]) => n === name);
      if (vorhanden && !vorhanden[1] && rolle) vorhanden[1] = rolle;
      continue;
    }
    gesehen.add(k);
    if (d.darsteller.length < 25) d.darsteller.push([name, rolle]);
  }

  const meta = await sparql(`SELECT ?item ?regie ?land ?jahr ?original WHERE {
    VALUES ?item { ${werte} }
    OPTIONAL { ?item wdt:P57 ?r }
    OPTIONAL { ?item wdt:P495 ?l }
    OPTIONAL { ?item wdt:P577 ?jahr }
    OPTIONAL { ?item wdt:P1476 ?original }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en". ?r rdfs:label ?regie . ?l rdfs:label ?land . }
  }`);
  for (const b of meta) {
    const q = qid(b.item?.value);
    if (!q) continue;
    const d = hole(q);
    const regie = b.regie?.value;
    if (regie && !/^Q\d+$/.test(regie) && !d.regie.includes(regie) && d.regie.length < 4) d.regie.push(regie);
    const land = b.land?.value;
    if (land && !/^Q\d+$/.test(land) && !d.land.includes(land) && d.land.length < 4) d.land.push(land);
    const jahr = b.jahr?.value.slice(0, 4);
    if (jahr && (!d.jahr || jahr < d.jahr)) d.jahr = jahr;
    if (b.original?.value && !d.original) d.original = b.original.value;
  }
  return map;
}

/** Bei mehreren Treffern: der mit passendem Jahr (±1); ohne Jahr nur ein eindeutiger Treffer */
export function waehle(kandidaten: Kandidat[], jahr?: string): Kandidat | null {
  const eindeutig = [...new Map(kandidaten.map((k) => [k.q, k])).values()];
  if (eindeutig.length === 1) return !jahr || !eindeutig[0].jahr || Math.abs(Number(eindeutig[0].jahr) - Number(jahr)) <= 1 ? eindeutig[0] : null;
  if (!jahr) return null;
  const passend = eindeutig.filter((k) => k.jahr && Math.abs(Number(k.jahr) - Number(jahr)) <= 1);
  return passend.length === 1 ? passend[0] : null;
}
