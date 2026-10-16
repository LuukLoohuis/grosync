import { describe, expect, it } from 'vitest';
import { canInstall, installWay, type InstallWay } from '@/lib/installHint';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240805.005; wv) AppleWebKit/537.36 (KHTML, like Gecko)';

const cases: [string, string, number, InstallWay][] = [
  ['Safari op de iPhone', `${IPHONE} Version/26.0 Mobile/15E148 Safari/604.1`, 5, 'ios-safari'],
  ['Safari op de iPad, die zich als Mac voordoet', `${MAC} Version/26.0 Safari/605.1.15`, 5, 'ios-safari'],
  ['Chrome op de iPhone', `${IPHONE} CriOS/141.0.7390.41 Mobile/15E148 Safari/604.1`, 5, 'ios-browser'],
  ['Firefox op de iPhone', `${IPHONE} FxiOS/143.0 Mobile/15E148 Safari/605.1.15`, 5, 'ios-browser'],
  ['de browser in Instagram', `${IPHONE} Mobile/15E148 Instagram 400.0.0.40.86 (iPhone15,2; iOS 18_6; nl_NL; nl; scale=3.00)`, 5, 'ios-in-app'],
  ['de browser in Facebook', `${IPHONE} Mobile/15E148 [FBAN/FBIOS;FBAV/530.0.0.43.97;FBLC/nl_NL]`, 5, 'ios-in-app'],
  ['de browser in TikTok', `${IPHONE} Mobile/15E148 musical_ly_41.5.0 JsSdk/2.0 NetType/WIFI ByteLocale/nl`, 5, 'ios-in-app'],
  ['de Google-app', `${IPHONE} GSA/390.0.785286043 Mobile/15E148 Safari/604.1`, 5, 'ios-in-app'],
  ['een web view zonder naam', `${IPHONE} Mobile/15E148`, 5, 'ios-in-app'],
  ['Chrome op Android', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36', 5, 'android'],
  ['de browser in Instagram op Android', `${ANDROID} Version/4.0 Chrome/141.0.7390.43 Mobile Safari/537.36 Instagram 400.0.0.40.86 Android`, 5, 'android-in-app'],
  ['Chrome op een Mac', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36', 0, 'desktop'],
  ['Safari op een Mac', `${MAC} Version/26.0 Safari/605.1.15`, 0, 'desktop'],
];

describe('installWay', () => {
  for (const [name, userAgent, maxTouchPoints, way] of cases) {
    it(`herkent ${name}`, () => {
      expect(installWay({ userAgent, maxTouchPoints, standalone: false })).toBe(way);
    });
  }

  it('ziet een app op het beginscherm als al geïnstalleerd, welke browser het ook is', () => {
    expect(installWay({ userAgent: cases[0][1], maxTouchPoints: 5, standalone: true })).toBe('installed');
    expect(installWay({ userAgent: cases[9][1], maxTouchPoints: 5, standalone: true })).toBe('installed');
  });
});

describe('canInstall', () => {
  it('biedt het op een telefoon altijd aan, op een computer alleen met de prompt van de browser', () => {
    expect(canInstall('ios-safari', false)).toBe(true);
    expect(canInstall('ios-in-app', false)).toBe(true);
    expect(canInstall('android', false)).toBe(true);
    expect(canInstall('desktop', false)).toBe(false);
    expect(canInstall('desktop', true)).toBe(true);
    expect(canInstall('installed', true)).toBe(false);
  });
});
