import { describe, expect, it } from 'vitest';
import { istVeraltet, seitenZiel, suchAdresse, suchTitel } from '../../src/main/links';

describe('Veraltete Adressen', () => {
  it('erkennt alte Portale', () => {
    expect(istVeraltet('https://classic.ardmediathek.de/tv/Tatort/Video?documentId=1')).toBe(true);
    expect(istVeraltet('https://www.ardmediathek.de/tv/Tatort/Sendung?bcastId=1')).toBe(true);
    expect(istVeraltet('https://www.sr-mediathek.de/index.php?seite=7&id=1')).toBe(true);
    expect(istVeraltet('https://www.br.de/mediathek/video/x')).toBe(true);
    expect(istVeraltet('http://www.arte.tv/guide/de/048295-011-A/360-geo-reportage')).toBe(true);
  });

  it('lässt aktuelle Adressen durch', () => {
    expect(istVeraltet('https://www.ardmediathek.de/video/Y3JpZDovL3N3ci5kZS9hZXgvbzIxNDUxODU')).toBe(false);
    expect(istVeraltet('https://www.zdf.de/video/dokus/terra-x-100/x-100')).toBe(false);
    expect(istVeraltet('https://www.arte.tv/de/videos/122631-049-A/filmgeschichte/')).toBe(false);
  });
});

describe('Suche beim Sender', () => {
  it('baut die Suchadresse je Mediathek', () => {
    expect(suchAdresse('ARD', 'Tatort: Gier')).toBe('https://www.ardmediathek.de/suche/Tatort%3A%20Gier');
    expect(suchAdresse('ZDF', 'Terra X')).toBe('https://www.zdf.de/suche?q=Terra%20X');
    expect(suchAdresse('3sat', 'nano')).toBe('https://www.3sat.de/suche?q=nano');
    expect(suchAdresse('Arte', 'Xenius')).toBe('https://www.arte.tv/de/search/?q=Xenius');
  });

  it('entfernt Zusätze aus dem Titel', () => {
    expect(suchTitel('Südspanien von oben (S01/E17)')).toBe('Südspanien von oben');
    expect(suchTitel('Ein unmoralisches Angebot - Spielfilm, USA 1993 (Audiodeskription)')).toBe('Ein unmoralisches Angebot');
    expect(suchTitel('Die Kinder der Villa Emma (Audiodeskription)')).toBe('Die Kinder der Villa Emma');
  });
});

describe('seitenZiel', () => {
  const film = { website: 'https://www.3sat.de/film/a-100.html', gruppe: '3sat' as const, titel: 'A Breath Away - Spielfilm, Frankreich 2018' };

  it('öffnet die Seite, wenn sie existiert', async () => {
    expect(await seitenZiel(film, async () => true)).toEqual({ url: film.website, art: 'seite' });
  });

  it('öffnet die Suche, wenn die Seite fehlt', async () => {
    expect(await seitenZiel(film, async () => false)).toEqual({ url: 'https://www.3sat.de/suche?q=A%20Breath%20Away', art: 'suche' });
  });

  it('prüft veraltete oder fehlende Adressen gar nicht erst', async () => {
    const nie = async () => {
      throw new Error('darf nicht prüfen');
    };
    expect((await seitenZiel({ ...film, website: '' }, nie)).art).toBe('suche');
    expect((await seitenZiel({ ...film, website: 'https://classic.ardmediathek.de/tv/x' }, nie)).art).toBe('suche');
  });

  it('macht aus http https', async () => {
    expect((await seitenZiel({ ...film, website: 'http://www.zdf.de/x' }, async () => true)).url).toBe('https://www.zdf.de/x');
  });
});
