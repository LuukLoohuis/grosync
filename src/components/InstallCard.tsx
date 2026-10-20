import { useState } from 'react';
import { ArrowRight, SquarePlus, X } from 'lucide-react';
import { LazySheet } from '@/components/LazyBoundary';
import { useInstallHint } from '@/hooks/useInstallHint';
import { isIos, promptInstall } from '@/lib/installHint';
import { lazyPart } from '@/lib/lazyPart';
import { t } from '@/lib/i18n';

const InstallSheet = lazyPart(() => import('@/components/InstallSheet'));

/** A one-off card on "Vandaag": put CoupleCart on the home screen. The ✕ hides it for good; the menu keeps it. */
const InstallCard = () => {
  const { way, canPrompt, showCard, hideCard } = useInstallHint();
  const [open, setOpen] = useState(false);
  if (!showCard) return null;

  const install = async () => {
    if (await promptInstall()) hideCard();
  };

  const inApp = way === 'ios-in-app' || way === 'android-in-app';
  const title = inApp ? t("Open CoupleCart in {0}", [way === 'android-in-app' ? 'Chrome' : 'Safari'])
    : isIos(way) ? t("Zet CoupleCart op je beginscherm")
    : t("Installeer CoupleCart als app");

  return (
    <section className="relative rounded-[14px] border border-border bg-card p-3.5 pr-12">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-accent-soft text-accent-ink">
          <SquarePlus className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-[1.0625rem] font-bold leading-snug text-foreground">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {inApp ? t("Hier kun je CoupleCart niet op je beginscherm zetten.") : t("Eén tik en je lijst staat open, ook in de winkel.")}
          </p>
          <button
            type="button"
            onClick={canPrompt ? () => void install() : () => setOpen(true)}
            className="-ml-1 mt-1 inline-flex min-h-11 items-center gap-1 rounded-lg px-1 text-sm font-semibold text-primary hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            {canPrompt ? t("Installeren") : t("Laat zien hoe")} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={hideCard}
        aria-label={t("Niet meer tonen")}
        title={t("Niet meer tonen")}
        className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-4 w-4" />
      </button>
      <LazySheet open={open} onClose={() => setOpen(false)}>
        <InstallSheet open={open} onOpenChange={setOpen} way={way} canPrompt={canPrompt} />
      </LazySheet>
    </section>
  );
};

export default InstallCard;
