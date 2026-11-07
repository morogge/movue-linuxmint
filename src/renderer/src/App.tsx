import { useCallback, useEffect, useRef, useState } from 'react';
import type { Film } from '@shared/film';
import type { Format, GenreId } from '@shared/genres';
import { CHANGELOG_PAGE_ID } from '@shared/help';
import { SCREENS, type ScreenId } from '@shared/screens';
import type { SenderGruppe } from '@shared/sender';
import { matchShortcut } from '@shared/shortcuts';
import { zeigeWasIstNeu } from '@shared/update';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { UpdateBanner, useUpdateZustand } from './components/UpdateBanner';
import { HelpView } from './help/HelpView';
import { useIndexZustand } from './hooks/useIndexZustand';
import { DetailScreen } from './screens/DetailScreen';
import { ArtScreen } from './screens/ArtScreen';
import { GenreScreen } from './screens/GenreScreen';
import { KategorienScreen } from './screens/KategorienScreen';
import { artSeite, type ArtSeite } from '@shared/arten';
import { SearchScreen } from './screens/SearchScreen';
import { StartScreen } from './screens/StartScreen';
import { PlayerScreen } from './screens/PlayerScreen';
import { MiniPlayer } from './components/MiniPlayer';
import { MerklisteScreen } from './screens/MerklisteScreen';
import { AblaufScreen } from './screens/AblaufScreen';
import { istScreen } from '@shared/screens';
import { SerieScreen } from './screens/SerieScreen';
import type { SerieRef } from '@shared/serie';

const ZULETZT_GESEHEN = 'movue.zuletztGeseheneVersion';
const SEITENLEISTE = 'movue.seitenleiste';

function leseSpeicher(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function schreibeSpeicher(key: string, wert: string): void {
  try {
    window.localStorage.setItem(key, wert);
  } catch {
    // Ohne Speicher erscheint „Was ist neu“ eben nicht automatisch
  }
}

/** Wo der Nutzer gerade ist – mit allem, was die Ansicht braucht */
export interface Ansicht {
  screen: ScreenId;
  gruppe?: SenderGruppe;
  filmId?: number;
  serie?: SerieRef;
  /** Art-Seite (Serien, Filme …) */
  seite?: string;
  genre?: GenreId;
}

export function App() {
  const [ansicht, setAnsicht] = useState<Ansicht>({ screen: 'start' });
  const [, setVerlauf] = useState<Ansicht[]>([]);
  const [helpPage, setHelpPage] = useState<string | null>(null);
  const [eingeklappt, setEingeklappt] = useState(() => leseSpeicher(SEITENLEISTE) === 'eingeklappt');
  const einklappen = useCallback(
    () =>
      setEingeklappt((e) => {
        schreibeSpeicher(SEITENLEISTE, e ? 'offen' : 'eingeklappt');
        return !e;
      }),
    []
  );
  const [suchtext, setSuchtext] = useState('');
  const [genre, setGenre] = useState<GenreId | null>(null);
  const [format, setFormat] = useState<Format | null>(null);
  const suchfeld = useRef<HTMLInputElement>(null);
  const zustand = useIndexZustand();
  const update = useUpdateZustand();
  /** Was gerade läuft – für den Mini-Player, wenn du den Player verlässt */
  const [wiedergabe, setWiedergabe] = useState<{ film: Film; position: number } | null>(null);
  const [mini, setMini] = useState(false);
  const laeuft = useRef(false);

  // Nach einem Update einmal „Was ist neu“ zeigen
  useEffect(() => {
    void window.movue?.getInfo().then(({ version }) => {
      if (zeigeWasIstNeu(leseSpeicher(ZULETZT_GESEHEN), version)) setHelpPage(CHANGELOG_PAGE_ID);
      schreibeSpeicher(ZULETZT_GESEHEN, version);
    });
  }, []);

  const gehe = useCallback(
    (neu: Ansicht) => {
      // Player verlassen, während das Video läuft → im Mini-Player weiterspielen
      if (ansicht.screen === 'player' && neu.screen !== 'player') setMini(laeuft.current);
      if (neu.screen === 'player') setMini(false);
      setVerlauf((v) => [...v.slice(-30), ansicht]);
      setAnsicht(neu);
      window.scrollTo({ top: 0 });
    },
    [ansicht]
  );

  // Klick auf eine Benachrichtigung (neue Folgen) öffnet die Merkliste
  const gehZu = useRef(gehe);
  useEffect(() => {
    gehZu.current = gehe;
  }, [gehe]);
  useEffect(
    () =>
      window.movue?.beiNavigation((screen) => {
        if (istScreen(screen)) gehZu.current({ screen });
      }),
    []
  );

  const zurueck = useCallback(() => {
    setVerlauf((v) => {
      if (v.length === 0) return v;
      const vorher = v[v.length - 1];
      setAnsicht((jetzt) => {
        if (jetzt.screen === 'player' && vorher.screen !== 'player') setMini(laeuft.current);
        if (vorher.screen === 'player') setMini(false);
        return vorher;
      });
      return v.slice(0, -1);
    });
  }, []);

  const abspielen = useCallback((f: Film) => gehe({ screen: 'player', filmId: f.id }), [gehe]);
  const merkeFilm = useCallback(
    (f: Film) => setWiedergabe((w) => (w && w.film.id === f.id ? w : { film: f, position: 0 })),
    []
  );
  const merkePosition = useCallback((position: number) => setWiedergabe((w) => (w ? { ...w, position } : w)), []);
  const merkeLaeuft = useCallback((l: boolean) => {
    laeuft.current = l;
  }, []);

  const oeffneFilm = useCallback((f: Film) => gehe({ screen: 'detail', filmId: f.id }), [gehe]);
  const oeffneSerie = useCallback((s: SerieRef) => gehe({ screen: 'serie', serie: { gruppe: s.gruppe, thema: s.thema } }), [gehe]);
  const zeigeArt = useCallback((s: ArtSeite, gruppe: SenderGruppe | null = null) => gehe({ screen: 'art', seite: s.id, gruppe: gruppe ?? undefined }), [gehe]);
  const zeigeGenre = useCallback((g: GenreId) => gehe({ screen: 'genre', genre: g }), [gehe]);
  const zeigeKategorien = useCallback(() => gehe({ screen: 'kategorien' }), [gehe]);

  const openHelp = useCallback(() => setHelpPage(SCREENS[ansicht.screen].help), [ansicht.screen]);
  const closeHelp = useCallback(() => setHelpPage(null), []);

  const sucheAendern = useCallback(
    (text: string) => {
      setSuchtext(text);
      if (text.trim() && ansicht.screen !== 'suche') gehe({ screen: 'suche' });
    },
    [ansicht.screen, gehe]
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const action = matchShortcut(event);
      if (!action) return;
      event.preventDefault();
      if (action === 'help') openHelp();
      if (action === 'search') {
        closeHelp();
        suchfeld.current?.focus();
        suchfeld.current?.select();
      }
      if (action === 'back') zurueck();
      if (action === 'fullscreen') void window.movue?.toggleFullscreen();
      if (action === 'seitenleiste') einklappen();
      if (action === 'close') {
        if (helpPage) closeHelp();
        else if (document.activeElement === suchfeld.current) setSuchtext('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openHelp, closeHelp, helpPage, zurueck, einklappen]);

  return (
    <div className="app">
      <Sidebar ansicht={ansicht} onNavigate={gehe} zustand={zustand} update={update} eingeklappt={eingeklappt} onEinklappen={einklappen} />
      <main className="main">
        <UpdateBanner zustand={update} />
        <TopBar ref={suchfeld} suchtext={suchtext} onSuche={sucheAendern} onHelp={openHelp} />
        {ansicht.screen === 'start' && (
          <StartScreen zustand={zustand} onOeffne={oeffneFilm} onArt={zeigeArt} onAbspielen={abspielen} onSerie={oeffneSerie} />
        )}
        {ansicht.screen === 'sender' && ansicht.gruppe && (
          <StartScreen
            key={ansicht.gruppe}
            zustand={zustand}
            gruppe={ansicht.gruppe}
            onOeffne={oeffneFilm}
            onArt={zeigeArt}
            onAbspielen={abspielen}
            onSerie={oeffneSerie}
          />
        )}
        {ansicht.screen === 'suche' && (
          <SearchScreen
            suchtext={suchtext}
            zustand={zustand}
            genre={genre}
            onGenre={setGenre}
            format={format}
            onFormat={setFormat}
            onOeffne={oeffneFilm}
            onAbspielen={abspielen}
            onSerie={oeffneSerie}
          />
        )}
        {ansicht.screen === 'art' && artSeite(ansicht.seite) && (
          <ArtScreen
            key={`${ansicht.seite}|${ansicht.gruppe ?? ''}`}
            seite={artSeite(ansicht.seite)!}
            gruppe={ansicht.gruppe ?? null}
            zustand={zustand}
            onOeffne={oeffneFilm}
            onSerie={oeffneSerie}
            onKategorien={zeigeKategorien}
          />
        )}
        {ansicht.screen === 'kategorien' && (
          <KategorienScreen
            zustand={zustand}
            onArt={zeigeArt}
            onGenre={zeigeGenre}
            onSender={(g) => gehe({ screen: 'sender', gruppe: g })}
            onAblauf={() => gehe({ screen: 'ablauf' })}
          />
        )}
        {ansicht.screen === 'genre' && ansicht.genre && (
          <GenreScreen key={ansicht.genre} genre={ansicht.genre} zustand={zustand} onOeffne={oeffneFilm} onSerie={oeffneSerie} onKategorien={zeigeKategorien} />
        )}
        {ansicht.screen === 'merkliste' && <MerklisteScreen stand={zustand.stand} onOeffne={oeffneFilm} onSerie={oeffneSerie} />}
        {ansicht.screen === 'ablauf' && <AblaufScreen stand={zustand.stand} onOeffne={oeffneFilm} />}
        {ansicht.screen === 'detail' && ansicht.filmId !== undefined && (
          <DetailScreen filmId={ansicht.filmId} onOeffne={oeffneFilm} onZurueck={zurueck} onAbspielen={abspielen} onSerie={oeffneSerie} />
        )}
        {ansicht.screen === 'serie' && ansicht.serie && (
          <SerieScreen
            key={`${ansicht.serie.gruppe}|${ansicht.serie.thema}`}
            serie={ansicht.serie}
            onZurueck={zurueck}
            onAbspielen={abspielen}
            onOeffne={oeffneFilm}
          />
        )}
        {ansicht.screen === 'player' && ansicht.filmId !== undefined && (
          <PlayerScreen
            filmId={ansicht.filmId}
            startHinweis={wiedergabe && wiedergabe.film.id === ansicht.filmId ? wiedergabe.position : undefined}
            onAbspielen={abspielen}
            onDetails={oeffneFilm}
            onZurueck={zurueck}
            onFilm={merkeFilm}
            onPosition={merkePosition}
            onLaeuft={merkeLaeuft}
          />
        )}
      </main>
      {mini && wiedergabe && ansicht.screen !== 'player' && (
        <MiniPlayer
          key={wiedergabe.film.id}
          film={wiedergabe.film}
          start={wiedergabe.position}
          onOeffnen={() => abspielen(wiedergabe.film)}
          onSchliessen={() => {
            setMini(false);
            laeuft.current = false;
          }}
          onPosition={merkePosition}
        />
      )}
      {helpPage && <HelpView page={helpPage} onSelect={setHelpPage} onClose={closeHelp} />}
    </div>
  );
}
