/**
 * Getting CoupleCart onto the home screen. iOS has no install button: Safari only offers
 * "Zet op beginscherm" in its share menu, so the app shows the steps itself. Chrome on
 * Android and on a computer does have an install prompt, which the app keeps for its own button.
 */

export type InstallWay =
  /** Opened from the home screen already. */
  | 'installed'
  /** Safari on iPhone or iPad: ••• → Deel → Zet op beginscherm. */
  | 'ios-safari'
  /** Chrome, Firefox, Edge and the like on iPhone: their own share button. */
  | 'ios-browser'
  /** The browser inside Instagram, TikTok, Facebook and the like on iPhone: open Safari first. */
  | 'ios-in-app'
  /** Chrome on Android: its menu, or its install prompt. */
  | 'android'
  /** The browser inside an app on Android: open Chrome first. */
  | 'android-in-app'
  /** A computer: only the browser's own install prompt, when it offers one. */
  | 'desktop';

export interface InstallEnv {
  userAgent: string;
  maxTouchPoints: number;
  standalone: boolean;
}

// Apps that open links in a browser of their own, where "Zet op beginscherm" does not exist.
const IN_APP = /Instagram|FBAN|FBAV|FB_IAB|BytedanceWebview|musical_ly|TikTok|LinkedInApp|Snapchat|Pinterest|GSA\/|Line\/|MicroMessenger|; wv\)/;
const IOS_BROWSERS = /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/;

export function installWay({ userAgent, maxTouchPoints, standalone }: InstallEnv): InstallWay {
  if (standalone) return 'installed';
  // iPadOS presents itself as a Mac; the touch screen gives it away.
  const ios = /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  if (ios) {
    // A web view inside an app leaves out the "Safari/" that every iOS browser sends.
    if (IN_APP.test(userAgent) || !/Safari\//.test(userAgent)) return 'ios-in-app';
    return IOS_BROWSERS.test(userAgent) ? 'ios-browser' : 'ios-safari';
  }
  if (/Android/.test(userAgent)) return IN_APP.test(userAgent) ? 'android-in-app' : 'android';
  return 'desktop';
}

export const currentInstallWay = (): InstallWay =>
  installWay({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints || 0,
    standalone:
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
  });

/** On iOS a home-screen app keeps its own storage, apart from Safari: you sign in there again. */
export const isIos = (way: InstallWay) => way.startsWith('ios-');

/** Somewhere CoupleCart can be put on the home screen at all (on a computer: only with the prompt). */
export const canInstall = (way: InstallWay, canPrompt: boolean) =>
  way !== 'installed' && (way !== 'desktop' || canPrompt);

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
// Installed from this page just now; the tab itself still runs in the browser.
let installedNow = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/** Chrome offers its prompt once, early on; call this before React renders so it is not missed. */
export function watchInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => {
    // No mini-infobar of Chrome's own: the app offers the prompt in the menu and on "Vandaag".
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installedNow = true;
    notify();
  });
}

export const canPromptInstall = () => deferredPrompt !== null;
export const isInstalledNow = () => installedNow;

export const subscribeInstallPrompt = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Shows the browser's install prompt; a prompt can be shown only once. */
export async function promptInstall(): Promise<boolean> {
  const event = deferredPrompt;
  if (!event) return false;
  deferredPrompt = null;
  notify();
  await event.prompt();
  return (await event.userChoice).outcome === 'accepted';
}

const CARD_KEY = 'couplecart-install-card';

export const installCardDismissed = () => {
  try {
    return localStorage.getItem(CARD_KEY) === 'weg';
  } catch {
    return false;
  }
};

export const dismissInstallCard = () => {
  try {
    localStorage.setItem(CARD_KEY, 'weg');
  } catch {
    // Without storage the card comes back on the next visit; the ✕ still hides it for now.
  }
};
