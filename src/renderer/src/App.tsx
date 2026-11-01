import { useCallback, useEffect, useState } from 'react';
import { matchShortcut } from '@shared/shortcuts';
import { SCREENS, type ScreenId } from '@shared/screens';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { StartScreen } from './screens/StartScreen';
import { HelpView } from './help/HelpView';

export function App() {
  const [screen, setScreen] = useState<ScreenId>('start');
  const [helpPage, setHelpPage] = useState<string | null>(null);

  const openHelp = useCallback(() => setHelpPage(SCREENS[screen].help), [screen]);
  const closeHelp = useCallback(() => setHelpPage(null), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const action = matchShortcut(event);
      if (!action) return;
      event.preventDefault();
      if (action === 'help') openHelp();
      if (action === 'fullscreen') void window.movue?.toggleFullscreen();
      if (action === 'close') closeHelp();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openHelp, closeHelp]);

  return (
    <div className="app">
      <Sidebar current={screen} onNavigate={setScreen} />
      <main className="main">
        <TopBar onHelp={openHelp} />
        {screen === 'start' && <StartScreen onHelp={openHelp} />}
      </main>
      {helpPage && <HelpView page={helpPage} onSelect={setHelpPage} onClose={closeHelp} />}
    </div>
  );
}
