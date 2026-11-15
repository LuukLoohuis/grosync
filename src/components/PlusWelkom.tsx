import type { CSSProperties } from 'react';
import { Check } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { PlusMerk } from '@/components/PlusMerk';
import { PLUS_GROEPEN } from '@/lib/plusPerks';
import { t } from '@/lib/i18n';

const VONKEN = [0, 45, 90, 135, 180, 225, 270, 315];

/** Terug van Stripe met een betaling: een echt welkom in plaats van een toast, met wat er nu openstaat. */
const PlusWelkom = ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="bottom" className="mx-auto max-h-[85vh] [@supports(height:100dvh)]:max-h-[85dvh] max-w-lg overflow-y-auto rounded-t-[20px]">
      <SheetHeader className="items-center pt-2 text-center">
        <span aria-hidden="true" className="relative mb-3 flex h-14 w-14 items-center justify-center">
          {open && VONKEN.map((hoek, i) => (
            <span
              key={hoek}
              className={`absolute left-1/2 top-1/2 -ml-1 -mt-1 h-2 w-2 rounded-full animate-feest-vonk [animation-delay:180ms] opacity-0 ${i % 2 ? 'bg-accent' : 'bg-primary'}`}
              style={{ '--hoek': `${hoek}deg` } as CSSProperties}
            />
          ))}
          <PlusMerk maat="lg" className="animate-feest-pop" />
        </span>
        <SheetTitle className="font-display text-2xl">{t('Welkom bij Plus')}</SheetTitle>
        <SheetDescription className="max-w-[30ch]">
          {t('Alles staat voor je open. Fijn dat je CoupleCart steunt.')}
        </SheetDescription>
      </SheetHeader>

      <ul className="mt-6 space-y-2.5 rounded-[16px] border border-border bg-card p-4 shadow-flat">
        {PLUS_GROEPEN.flatMap(({ perks }) => perks).map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-2.5 text-[0.9375rem] leading-snug text-foreground">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" strokeWidth={2} aria-hidden="true" />
            <span className="flex-1">{text}</span>
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2.4} aria-hidden="true" />
          </li>
        ))}
      </ul>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        {t('Het kan een paar tellen duren voor alles bij je staat.')}
      </p>

      <Button className="mt-4 min-h-[52px] w-full text-base" onClick={() => onOpenChange(false)}>
        {t('Aan de slag')}
      </Button>
    </SheetContent>
  </Sheet>
);

export default PlusWelkom;
