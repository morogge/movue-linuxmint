import { describe, expect, it } from 'vitest';
import { reihenId, trailerVerweis, videoAdresse } from '../../src/main/ardtrailer';

// Verkleinert, im Aufbau wie die Antworten von api.ardmediathek.de (In aller Freundschaft, November 2026)
const FOLGE = {
  widgets: [
    {
      show: { id: 'Y3JpZDovL21kci5kZS9zZW5kZXJlaWhlbi9zdGFmZmVsc2VyaWUtaW4tYWxsZXItZnJldW5kc2NoYWZ0', title: 'In aller Freundschaft' },
      mediaCollection: { embedded: { streams: [] } }
    }
  ]
};
const REIHE = {
  title: 'In aller Freundschaft',
  trailer: {
    coreAssetType: 'EXTRA_TRAILER',
    duration: 38,
    links: { target: { id: 'Y3JpZDovL21kci5kZS9iZWl0cmFnL2Ntcy8zMmZi', title: 'Trailer zur Folge 1156: Nicht Kind und nicht erwachsen' } }
  }
};
const TRAILER = {
  widgets: [
    {
      mediaCollection: {
        embedded: {
          streams: [
            {
              kind: 'main',
              media: [
                { url: 'https://mdr-progressive.ard-mcdn.de/t_1280.mp4', mimeType: 'video/mp4', maxHResolutionPx: 1280 },
                { url: 'https://vod.unified.mdr.de/t/master.m3u8', mimeType: 'application/vnd.apple.mpegurl', maxHResolutionPx: 1920 },
                { url: 'https://mdr-progressive.ard-mcdn.de/t_1920.mp4', mimeType: 'video/mp4', maxHResolutionPx: 1920 },
                { url: 'https://mdr-progressive.ard-mcdn.de/t_640.mp4', mimeType: 'video/mp4', maxHResolutionPx: 640 }
              ]
            }
          ]
        }
      }
    }
  ]
};

describe('Trailer der Reihe bei der ARD', () => {
  it('liest die Kennung der Reihe aus der Seite einer Folge', () => {
    expect(reihenId(FOLGE)).toBe('Y3JpZDovL21kci5kZS9zZW5kZXJlaWhlbi9zdGFmZmVsc2VyaWUtaW4tYWxsZXItZnJldW5kc2NoYWZ0');
    expect(reihenId({ widgets: [{}] })).toBeNull();
    expect(reihenId(null)).toBeNull();
  });

  it('findet den Trailer auf der Seite der Reihe', () => {
    expect(trailerVerweis(REIHE)).toEqual({
      id: 'Y3JpZDovL21kci5kZS9iZWl0cmFnL2Ntcy8zMmZi',
      titel: 'Trailer zur Folge 1156: Nicht Kind und nicht erwachsen',
      dauer: 38
    });
    expect(trailerVerweis({ title: 'Ohne Trailer' })).toBeNull();
    // Fremde Zeichen in der Kennung landen nie in einer Adresse
    expect(trailerVerweis({ trailer: { links: { target: { id: '../../x' } } } })).toBeNull();
  });

  it('nimmt das größte MP4 bis 1280 Pixel, sonst HLS', () => {
    expect(videoAdresse(TRAILER)).toBe('https://mdr-progressive.ard-mcdn.de/t_1280.mp4');
    const nurHls = { widgets: [{ mediaCollection: { embedded: { streams: [{ kind: 'main', media: [TRAILER.widgets[0]!.mediaCollection.embedded.streams[0]!.media[1]] }] } } }] };
    expect(videoAdresse(nurHls)).toBe('https://vod.unified.mdr.de/t/master.m3u8');
    expect(videoAdresse({ widgets: [{}] })).toBeNull();
  });
});
