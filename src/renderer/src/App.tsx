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

  // Nach einem Update einmal „Was ist neu“ zeigen
  useEffect(() => {
    void window.movue?.getInfo().then(({ version }) => {
      if (zeigeWasIstNeu(leseSpeicher(ZULETZT_GESEHEN), version)) setHelpPage(CHANGELOG_PAGE_ID);
      schreibeSpeicher(ZULETZT_GESEHEN, version);
    });
  }, []);

  const gehe = useCallback(
    (neu: Ansicht) => {
      setVerlauf((v) => [...v.slice(-30), ansicht]);
      setAnsicht(neu);
      window.scrollTo({ top: 0 });
    },
    [ansicht]
  );

  const zurueck = useCallback(() => {
    setVerlauf((v) => {
      if (v.length === 0) return v;
      setAnsicht(v[v.length - 1]);
      return v.slice(0, -1);
    });
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
        {ansicht.screen === 'start' && <StartScreen zustand={zustand} onOeffne={oeffneFilm} onGenre={zeigeGenre} />}
        {ansicht.screen === 'sender' && ansicht.gruppe && (
          <StartScreen key={ansicht.gruppe} zustand={zustand} gruppe={ansicht.gruppe} onOeffne={oeffneFilm} onGenre={zeigeGenre} />
        )}
        {ansicht.screen === 'suche' && (
          <SearchScreen suchtext={suchtext} zustand={zustand} genre={genre} onGenre={setGenre} onOeffne={oeffneFilm} />
        )}
        {ansicht.screen === 'genres' && <GenresScreen zustand={zustand} onWaehle={zeigeGenre} />}
        {ansicht.screen === 'detail' && ansicht.filmId !== undefined && (
          <DetailScreen filmId={ansicht.filmId} onOeffne={oeffneFilm} onZurueck={zurueck} />
        )}
      </main>
      {helpPage && <HelpView page={helpPage} onSelect={setHelpPage} onClose={closeHelp} />}
    </div>
  );
}
