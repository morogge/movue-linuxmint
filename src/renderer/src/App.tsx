import { useCallback, useEffect, useRef, useState } from 'react';
import type { Film } from '@shared/film';
import type { GenreId } from '@shared/genres';
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
import { GenresScreen } from './screens/GenresScreen';
import { SearchScreen } from './screens/SearchScreen';
import { StartScreen } from './screens/StartScreen';
import { PlayerScreen } from './screens/PlayerScreen';
import { MiniPlayer } from './components/MiniPlayer';

const ZULETZT_GESEHEN = 'movue.zuletztGeseheneVersion';

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
}

export function App() {
  const [ansicht, setAnsicht] = useState<Ansicht>({ screen: 'start' });
  const [, setVerlauf] = useState<Ansicht[]>([]);
  const [helpPage, setHelpPage] = useState<string | null>(null);
  const [suchtext, setSuchtext] = useState('');
  const [genre, setGenre] = useState<GenreId | null>(null);
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
  const zeigeGenre = useCallback(
    (g: GenreId) => {
      setGenre(g);
      setSuchtext('');
      gehe({ screen: 'suche' });
    },
    [gehe]
  );

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
      if (action === 'close') {
        if (helpPage) closeHelp();
        else if (document.activeElement === suchfeld.current) setSuchtext('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openHelp, closeHelp, helpPage, zurueck]);

  return (
    <div className="app">
      <Sidebar ansicht={ansicht} onNavigate={gehe} zustand={zustand} update={update} />
      <main className="main">
        <UpdateBanner zustand={update} />
        <TopBar ref={suchfeld} suchtext={suchtext} onSuche={sucheAendern} onHelp={openHelp} />
        {ansicht.screen === 'start' && (
          <StartScreen zustand={zustand} onOeffne={oeffneFilm} onGenre={zeigeGenre} onAbspielen={abspielen} />
        )}
        {ansicht.screen === 'sender' && ansicht.gruppe && (
          <StartScreen key={ansicht.gruppe} zustand={zustand} gruppe={ansicht.gruppe} onOeffne={oeffneFilm} onGenre={zeigeGenre} onAbspielen={abspielen} />
        )}
        {ansicht.screen === 'suche' && (
          <SearchScreen suchtext={suchtext} zustand={zustand} genre={genre} onGenre={setGenre} onOeffne={oeffneFilm} onAbspielen={abspielen} />
        )}
        {ansicht.screen === 'genres' && <GenresScreen zustand={zustand} onWaehle={zeigeGenre} />}
        {ansicht.screen === 'detail' && ansicht.filmId !== undefined && (
          <DetailScreen filmId={ansicht.filmId} onOeffne={oeffneFilm} onZurueck={zurueck} onAbspielen={abspielen} />
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
