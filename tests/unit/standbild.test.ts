import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ BrowserWindow: class {} }));
const { eignetSichFuerStandbild, standbildZeit } = await import('../../src/main/standbild');

describe('Standbild aus dem Video', () => {
  it('nimmt nur direkte Videodateien über https', () => {
    expect(eignetSichFuerStandbild('https://mdr-progressive.ard-mcdn.de/x/video.avc720.mp4')).toBe(true);
    expect(eignetSichFuerStandbild('https://rodlzdf-a.akamaihd.net/de/zdf/21/05/x_808k_p11v15.mp4')).toBe(true);
    expect(eignetSichFuerStandbild('http://cdn.example.org/x.mp4')).toBe(false);
    expect(eignetSichFuerStandbild('https://x.example.org/master.m3u8')).toBe(false);
    expect(eignetSichFuerStandbild('https://x.example.org/a.mp4"<script>')).toBe(false);
  });

  it('springt hinter den Vorspann, aber nicht weiter als anderthalb Minuten', () => {
    expect(standbildZeit(60)).toBe(6);
    expect(standbildZeit(10)).toBe(3);
    expect(standbildZeit(5400)).toBe(90);
    expect(standbildZeit(0)).toBe(5);
  });
});
