import { useEffect, useState } from 'react';
import { countdownText } from '@shared/live';

/** Läuft mit: unter einer Stunde jede Sekunde, sonst alle 30 Sekunden */
function useJetzt(datum: number): number {
  const [jetzt, setJetzt] = useState(Date.now());
  const nah = datum * 1000 - jetzt < 3_600_000;
  useEffect(() => {
    const t = setInterval(() => setJetzt(Date.now()), nah ? 1000 : 30_000);
    return () => clearInterval(t);
  }, [nah]);
  return jetzt;
}

/** „Beginnt in 2 Std. 14 Min.“ – danach „Läuft jetzt“ */
export function Countdown({ datum, kurz = false }: { datum: number; kurz?: boolean }) {
  const jetzt = useJetzt(datum);
  const text = countdownText(datum, jetzt);
  return (
    <span className={text ? 'countdown' : 'countdown jetzt'} role="timer" aria-label={text ? `Beginnt ${text}` : 'Läuft jetzt'}>
      {text ? (kurz ? text : `Beginnt ${text}`) : 'Läuft jetzt'}
    </span>
  );
}
