import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';

const MAAT = {
  sm: { vak: 'h-[18px] w-[18px] rounded-[6px]', icoon: 'h-2.5 w-2.5' },
  md: { vak: 'h-8 w-8 rounded-[10px]', icoon: 'h-4 w-4' },
  lg: { vak: 'h-14 w-14 rounded-[18px] shadow-soft', icoon: 'h-7 w-7' },
} as const;

/**
 * Het zegel van Plus: oranje verloop met een glans aan de bovenkant. Het donkere eind is
 * vast (het accent-ink van het lichte thema), zodat het zegel in het donkere thema niet bleek wordt. Overal hetzelfde,
 * zodat je Plus herkent zonder het woord te lezen. Puur decoratie, dus aria-hidden.
 */
export const PlusMerk = ({ maat = 'md', className }: { maat?: keyof typeof MAAT; className?: string }) => (
  <span
    aria-hidden="true"
    className={cn(
      'relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-[linear-gradient(145deg,hsl(var(--accent))_0%,hsl(22_84%_37%)_100%)] text-white',
      'before:absolute before:inset-x-0 before:top-0 before:h-1/2 before:bg-white/15',
      MAAT[maat].vak,
      className,
    )}
  >
    <Sparkles className={cn('relative', MAAT[maat].icoon)} strokeWidth={2.4} />
  </span>
);

/** Klein "Plus"-labeltje op een knop die alleen met Plus werkt: je weet het vóór je tikt. */
export const PlusLabel = ({ className }: { className?: string }) => (
  <span
    className={cn(
      'inline-flex shrink-0 items-center gap-0.5 rounded-full bg-accent-soft px-1.5 py-0.5 text-[0.625rem] font-bold uppercase leading-none tracking-[0.06em] text-accent-ink ring-1 ring-inset ring-accent/30',
      className,
    )}
  >
    <Sparkles className="!h-2.5 !w-2.5" strokeWidth={2.6} aria-hidden="true" />
    {t('Plus')}
  </span>
);
