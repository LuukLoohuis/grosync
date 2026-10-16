import { useState, useSyncExternalStore } from 'react';
import {
  canInstall, canPromptInstall, currentInstallWay, dismissInstallCard, installCardDismissed, isInstalledNow,
  subscribeInstallPrompt,
} from '@/lib/installHint';

/** Which way onto the home screen this browser has, and whether to offer it. */
export function useInstallHint() {
  const [way] = useState(currentInstallWay);
  const canPrompt = useSyncExternalStore(subscribeInstallPrompt, canPromptInstall);
  const installedNow = useSyncExternalStore(subscribeInstallPrompt, isInstalledNow);
  const [cardHidden, setCardHidden] = useState(installCardDismissed);
  const offer = !installedNow && canInstall(way, canPrompt);

  return {
    way,
    canPrompt,
    offer,
    /** The card on "Vandaag" is for phones; on a computer the menu is enough. */
    showCard: offer && way !== 'desktop' && !cardHidden,
    hideCard: () => {
      dismissInstallCard();
      setCardHidden(true);
    },
  };
}
