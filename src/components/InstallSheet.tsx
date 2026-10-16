import type { ReactNode } from 'react';
import { Check, Copy, Download, Ellipsis, Globe, MoreVertical, Share, SquarePlus } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { type InstallWay, isIos, promptInstall } from '@/lib/installHint';
import { t } from '@/lib/i18n';

interface InstallSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  way: InstallWay;
  canPrompt: boolean;
}

interface Step {
  text: string;
  hint?: string;
  /** The button as the phone draws it, so it is easy to spot. */
  visual: ReactNode;
}

const icon = 'h-5 w-5';

/** iOS's own switch, as it looks in the "Zet op beginscherm" screen. */
const IosSwitch = () => (
  <span className="flex h-[22px] w-[38px] items-center justify-end rounded-full bg-[#34C759] p-0.5">
    <span className="h-[18px] w-[18px] rounded-full bg-white shadow-sm" />
  </span>
);

const stepsFor = (way: InstallWay, browser: string): Step[] => {
  switch (way) {
    case 'ios-safari':
      return [
        { text: t("Tik op ••• en dan op ‘Deel’."), hint: t("Geen ••• te zien? Tik dan op het deelsymbool: het vierkantje met de pijl omhoog."), visual: <Ellipsis className={icon} /> },
        { text: t("Scrol omlaag en tik op ‘Zet op beginscherm’."), hint: t("Staat het er niet bij? Tik onderaan op ‘Wijzig taken’ en zet het erbij."), visual: <SquarePlus className={icon} /> },
        { text: t("Laat ‘Open als webapp’ aanstaan."), visual: <IosSwitch /> },
        { text: t("Tik op ‘Voeg toe’."), visual: <Check className={icon} /> },
      ];
    case 'ios-browser':
      return [
        { text: t("Tik op het deelsymbool."), hint: t("In Chrome staat het rechts in de adresbalk; in andere browsers in het menu."), visual: <Share className={icon} /> },
        { text: t("Kies ‘Zet op beginscherm’."), hint: t("Staat het er niet bij? Scrol omlaag in de lijst."), visual: <SquarePlus className={icon} /> },
        { text: t("Tik op ‘Voeg toe’."), visual: <Check className={icon} /> },
      ];
    case 'ios-in-app':
    case 'android-in-app':
      return [
        { text: t("Kopieer de link hieronder."), visual: <Copy className={icon} /> },
        { text: t("Open {0} en plak de link in de adresbalk.", [browser]), visual: <Globe className={icon} /> },
        { text: t("Daar zet je CoupleCart met een paar tikken tussen je apps."), visual: <SquarePlus className={icon} /> },
      ];
    default:
      return [
        { text: t("Tik op ⋮ rechtsboven in Chrome."), visual: <MoreVertical className={icon} /> },
        { text: t("Kies ‘App installeren’ of ‘Toevoegen aan startscherm’."), visual: <SquarePlus className={icon} /> },
        { text: t("Tik op ‘Installeren’."), visual: <Check className={icon} /> },
      ];
  }
};

/** The steps onto the home screen, for the browser this page is open in. */
const InstallSteps = ({ way, canPrompt, onDone }: { way: InstallWay; canPrompt: boolean; onDone: () => void }) => {
  const { session } = useAuth();
  const inApp = way === 'ios-in-app' || way === 'android-in-app';
  const browser = way === 'android-in-app' ? 'Chrome' : 'Safari';
  const link = `${window.location.origin}/`;

  // A home-screen app on iOS has storage of its own, so the session in this browser stays behind.
  const note = !isIos(way) ? null
    : !session ? t("Open CoupleCart daarna vanaf je beginscherm en log daar in.")
    : session.user.is_anonymous ? t("Let op: als gast blijft je lijst hier in de browser. In de app op je beginscherm begin je met een lege lijst.")
    : t("Open CoupleCart daarna vanaf je beginscherm en log daar nog één keer in.");

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success(t("Link gekopieerd"));
    } catch {
      toast.error(t("Kopiëren lukte niet. Houd de link ingedrukt en kies Kopiëren."));
    }
  };

  const install = async () => {
    onDone();
    await promptInstall();
  };

  return (
    <>
      <SheetHeader className="pr-10 text-left">
        <SheetTitle className="font-display text-xl">
          {inApp ? t("Open CoupleCart in {0}", [browser])
            : isIos(way) ? t("Zet CoupleCart op je beginscherm")
            : t("Installeer CoupleCart als app")}
        </SheetTitle>
        <SheetDescription>
          {inApp
            ? t("In de browser van deze app kun je CoupleCart niet op je beginscherm zetten. In {0} wel.", [browser])
            : t("Dan open je CoupleCart met één tik, schermvullend als een app.")}
        </SheetDescription>
      </SheetHeader>

      {canPrompt ? (
        <Button className="mt-5 min-h-12 w-full gap-2" onClick={() => void install()}>
          <Download className="h-4 w-4" /> {t("Installeer CoupleCart")}
        </Button>
      ) : (
        <ol className="mt-5 space-y-2">
          {stepsFor(way, browser).map((step, index) => (
            <li key={step.text} className="flex items-start gap-3 rounded-[14px] border border-border bg-card p-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary font-display text-xs font-bold text-primary-foreground">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.9375rem] font-medium leading-snug text-foreground">{step.text}</p>
                {step.hint && <p className="mt-1 text-xs text-muted-foreground">{step.hint}</p>}
              </div>
              <span aria-hidden="true" className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-[10px] bg-muted px-1.5 text-foreground">
                {step.visual}
              </span>
            </li>
          ))}
        </ol>
      )}

      {inApp && (
        <div className="mt-3 space-y-2">
          <label htmlFor="install-link" className="sr-only">{t("Link naar CoupleCart")}</label>
          <Input id="install-link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="bg-card font-body text-sm" />
          <Button className="min-h-11 w-full gap-2" onClick={() => void copyLink()}>
            <Copy className="h-4 w-4" /> {t("Link kopiëren")}
          </Button>
          <p className="text-xs text-muted-foreground">
            {t("Sneller: tik in deze app op ••• en kies openen in {0}, als dat erbij staat.", [browser])}
          </p>
        </div>
      )}

      {way === 'ios-browser' && <p className="mt-3 text-xs text-muted-foreground">{t("Lukt het niet? Open CoupleCart in Safari, daar werkt het altijd.")}</p>}
      {note && <p className="mt-4 rounded-xl bg-info-soft px-3.5 py-3 text-[0.8125rem] text-info">{note}</p>}

      <Button variant="outline" className="mt-4 min-h-12 w-full" onClick={onDone}>{t("Klaar")}</Button>
    </>
  );
};

/** How to put CoupleCart on the home screen: the steps per browser, or Chrome's own install prompt. */
const InstallSheet = ({ open, onOpenChange, way, canPrompt }: InstallSheetProps) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="bottom" className="mx-auto max-h-[85vh] [@supports(height:100dvh)]:max-h-[85dvh] max-w-lg overflow-y-auto rounded-t-[20px] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <InstallSteps way={way} canPrompt={canPrompt} onDone={() => onOpenChange(false)} />
    </SheetContent>
  </Sheet>
);

export default InstallSheet;
