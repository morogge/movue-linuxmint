import { useCallback, useEffect, useRef, useState } from 'react';
import { matchShortcut } from '@shared/shortcuts';
import { SCREENS, type ScreenId } from '@shared/screens';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { StartScreen } from './screens/StartScreen';
import { SearchScreen } from './screens/SearchScreen';
import { HelpView } from './help/HelpView';
import { useIndexZustand } from './hooks/useIndexZustand';

export function App() {
  const [screen, setScreen] = useState<ScreenId>('start');
  const [helpPage, setHelpPage] = useState<string | null>(null);
  const [suchtext, setSuchtext] = useState('');
  const suchfeld = useRef<HTMLInputElement>(null);
  const zustand = useIndexZustand();

  const openHelp = useCallback(() => setHelpPage(SCREENS[screen].help), [screen]);
  const closeHelp = useCallback(() => setHelpPage(null), []);

  const sucheAendern = useCallback((text: string) => {
    setSuchtext(text);
    if (text.trim()) setScreen('suche');
  }, []);

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
      if (action === 'fullscreen') void window.movue?.toggleFullscreen();
      if (action === 'close') {
        if (helpPage) closeHelp();
        else if (document.activeElement === suchfeld.current) setSuchtext('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openHelp, closeHelp, helpPage]);

  return (
    <div className="app">
      <Sidebar current={screen} onNavigate={setScreen} zustand={zustand} />
      <main className="main">
        <TopBar ref={suchfeld} suchtext={suchtext} onSuche={sucheAendern} onHelp={openHelp} />
        {screen === 'start' && <StartScreen zustand={zustand} onHelp={openHelp} onSuche={() => suchfeld.current?.focus()} />}
        {screen === 'suche' && <SearchScreen suchtext={suchtext} zustand={zustand} />}
      </main>
      {helpPage && <HelpView page={helpPage} onSelect={setHelpPage} onClose={closeHelp} />}
    </div>
  );
}
