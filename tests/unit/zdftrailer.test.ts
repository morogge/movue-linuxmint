import { describe, expect, it } from 'vitest';
import { zdfTrailerLink, zdfVideo } from '../../src/main/zdftrailer';

const REIHE = 'https://www.zdf.de/video/serien/under-salt-marsh-tod-in-den-salzwiesen-100';

describe('Trailer der Reihe beim ZDF', () => {
  it('findet den Link auf den Trailer nur innerhalb der Reihe', () => {
    const html = `<a href="/video/serien/andere-serie-100/trailer-anders-100">x</a>
      <a class="x" href="/video/serien/under-salt-marsh-tod-in-den-salzwiesen-100/die-flut-100">Folge</a>
      <a href="/video/serien/under-salt-marsh-tod-in-den-salzwiesen-100/trailer-under-salt-marsh-staffel-1-102"><span>Trailer</span></a>`;
    expect(zdfTrailerLink(html, REIHE)).toBe(`${REIHE}/trailer-under-salt-marsh-staffel-1-102`);
    expect(zdfTrailerLink('<a href="https://boese.example/video/serien/under-salt-marsh-tod-in-den-salzwiesen-100/trailer">', REIHE)).toBeNull();
    expect(zdfTrailerLink('<a href="/video/serien/under-salt-marsh-tod-in-den-salzwiesen-100/die-flut-100">', REIHE)).toBeNull();
  });

  it('liest Video, Titel und Dauer aus den Seitendaten (JSON-LD)', () => {
    const html = `<head><script type="application/ld+json">{"@context":"https://schema.org","@type":"VideoObject",
      "name":"Trailer: Under Salt Marsh – Staffel 1","duration":"PT1M38S",
      "contentUrl":"https://zdfvod.akamaized.net/i/mp4/none/zdf/26/09/260909_trailer_s01_usm/1/260909_trailer_s01_usm,_508k_p9,_808k_p11,v17.mp4.csmil/master.m3u8","hasPart":[]}</script></head>`;
    expect(zdfVideo(html)).toEqual({
      url: 'https://zdfvod.akamaized.net/i/mp4/none/zdf/26/09/260909_trailer_s01_usm/1/260909_trailer_s01_usm,_508k_p9,_808k_p11,v17.mp4.csmil/master.m3u8',
      titel: 'Trailer: Under Salt Marsh – Staffel 1',
      dauer: 98
    });
    // Fremde Videoadressen nimmt Movue nicht
    expect(zdfVideo('<script type="application/ld+json">{"contentUrl":"https://boese.example/x.m3u8"}</script>')).toBeNull();
    expect(zdfVideo('<html></html>')).toBeNull();
  });
});
