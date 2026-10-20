import { useState } from 'react';
import { Smartphone } from 'lucide-react';
import { LazySheet } from '@/components/LazyBoundary';
import { useInstallHint } from '@/hooks/useInstallHint';
import { isIos } from '@/lib/installHint';
import { lazyPart } from '@/lib/lazyPart';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';

const InstallSheet = lazyPart(() => import('@/components/InstallSheet'));

/**
 * On the login screen, for iPhone and for the browser inside Instagram and the like: put
 * CoupleCart on the home screen before signing in. A home-screen app on iOS has storage of
 * its own, so whoever signs in here first has to sign in again there.
 */
const InstallTip = ({ className }: { className?: string }) => {
  const { way, canPrompt } = useInstallHint();
  const [open, setOpen] = useState(false);
  if (!isIos(way) && way !== 'android-in-app') return null;

  const inApp = way === 'ios-in-app' || way === 'android-in-app';
  const text = inApp
    ? t("Open CoupleCart eerst in {0}: hier kun je de app niet op je beginscherm zetten, en inloggen met Google lukt hier vaak niet.", [way === 'android-in-app' ? 'Chrome' : 'Safari'])
    : t("Zet CoupleCart eerst op je beginscherm en log daar in. Dan open je de app voortaan met één tik.");

  return (
    <div className={cn('flex gap-2.5 rounded-xl bg-info-soft px-3.5 py-3 text-left text-[0.8125rem] text-info', className)}>
      <Smartphone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>
        {text}{' '}
        <button type="button" onClick={() => setOpen(true)} className="font-semibold underline underline-offset-2 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
          {t("Laat zien hoe")}
        </button>
      </p>
      <LazySheet open={open} onClose={() => setOpen(false)}>
        <InstallSheet open={open} onOpenChange={setOpen} way={way} canPrompt={canPrompt} />
      </LazySheet>
    </div>
  );
};

export default InstallTip;
