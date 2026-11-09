import { describe, expect, it } from 'vitest';
import { countdownText, istKommendLive, istSenderStream, laeuftJetzt, liveGruppe, senderName, sortiereSender, terminText, type LiveSender } from '@shared/live';
import type { Film } from '@shared/film';

describe('Livestreams der Sender', () => {
  it('benennt die Streams wie im Fernsehen', () => {
    expect(senderName('ARD Livestream')).toBe('Das Erste');
    expect(senderName('ARD Tagesschau Livestream')).toBe('tagesschau24');
    expect(senderName('ARD Alpha Livestream')).toBe('ARD alpha');
    expect(senderName('ZDF.neo Livestream')).toBe('ZDFneo');
    expect(senderName('ZDF.info Livestream')).toBe('ZDFinfo');
    expect(senderName('ARTE.DE Livestream')).toBe('Arte');
    expect(senderName('3Sat Livestream')).toBe('3sat');
    expect(senderName('WDR Livestream (Deutschland)')).toBe('WDR');
    expect(senderName('NDR Hamburg')).toBe('NDR Hamburg');
    expect(senderName('WDR Lokalzeit Bonn Livestream')).toBe('WDR Lokalzeit Bonn');
  });

  it('teilt in Hauptsender, weitere und die Dritten', () => {
    expect(liveGruppe('ZDF')).toBe('haupt');
    expect(liveGruppe('ZDFneo')).toBe('weitere');
    expect(liveGruppe('BR Süd')).toBe('dritte');
    const s = (name: string): LiveSender => ({ name, gruppe: liveGruppe(name), film: {} as Film });
    expect(sortiereSender([s('WDR Lokalzeit Bonn'), s('NDR Hamburg'), s('ZDFneo'), s('Arte'), s('Das Erste')]).map((x) => x.name)).toEqual([
      'Das Erste',
      'Arte',
      'ZDFneo',
      'NDR Hamburg',
      'WDR Lokalzeit Bonn'
    ]);
  });

  it('erkennt Sender-Streams nur am Thema', () => {
    expect(istSenderStream({ thema: 'Livestream' })).toBe(true);
    expect(istSenderStream({ thema: 'Brennpunkt' })).toBe(false);
  });
});

describe('Termine', () => {
  const jetzt = new Date(2026, 10, 8, 20, 0).getTime();
  const s = (d: Date) => Math.floor(d.getTime() / 1000);

  it('zeigt heute, morgen und sonst den Wochentag', () => {
    expect(terminText(s(new Date(2026, 10, 8, 20, 15)), jetzt)).toBe('Heute 20:15');
    expect(terminText(s(new Date(2026, 10, 9, 14, 0)), jetzt)).toBe('Morgen 14:00');
    expect(terminText(s(new Date(2026, 10, 14, 18, 30)), jetzt)).toBe('Sa 14.11. 18:30');
  });

  it('weiß, ob eine Übertragung gerade läuft', () => {
    const beginn = s(new Date(2026, 10, 8, 19, 30));
    expect(laeuftJetzt({ datum: beginn, dauer: 7200 }, jetzt)).toBe(true);
    expect(laeuftJetzt({ datum: beginn, dauer: 600 }, jetzt)).toBe(false);
    expect(laeuftJetzt({ datum: beginn + 3600, dauer: 7200 }, jetzt)).toBe(false);
  });
});

describe('Countdown bis zum Beginn', () => {
  const jetzt = Date.UTC(2026, 10, 9, 18, 0, 0);
  const s = jetzt / 1000;
  it('zählt Tage, Stunden und unter einer Stunde sekundengenau', () => {
    expect(countdownText(s + 3 * 86_400 + 4 * 3600 + 120, jetzt)).toBe('in 3 Tagen, 4 Std.');
    expect(countdownText(s + 86_400 + 30, jetzt)).toBe('in 1 Tag');
    expect(countdownText(s + 2 * 3600 + 14 * 60 + 59, jetzt)).toBe('in 2 Std. 14 Min.');
    expect(countdownText(s + 14 * 60 + 5, jetzt)).toBe('in 14:05 Min.');
    expect(countdownText(s + 9, jetzt)).toBe('in 0:09 Min.');
    expect(countdownText(s, jetzt)).toBeNull();
    expect(countdownText(s - 60, jetzt)).toBeNull();
  });

  it('gilt nur für kommende Live-Übertragungen', () => {
    expect(istKommendLive({ live: true, datum: s + 60 }, jetzt)).toBe(true);
    expect(istKommendLive({ live: true, datum: s - 60 }, jetzt)).toBe(false);
    expect(istKommendLive({ live: false, datum: s + 60 }, jetzt)).toBe(false);
    expect(istKommendLive({ datum: s + 60 }, jetzt)).toBe(false);
  });
});
