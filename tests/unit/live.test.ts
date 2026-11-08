import { describe, expect, it } from 'vitest';
import { istSenderStream, laeuftJetzt, liveGruppe, senderName, sortiereSender, terminText, type LiveSender } from '@shared/live';
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
