import { Camera, Check, Link2, Sparkles, Tag } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { FEATURE_LABEL, FREE_LIMIT, type MeteredFeature } from '@/hooks/useEntitlements';

interface PlusSheetProps {
  /** The feature that ran out, or null when the sheet is closed. */
  feature: MeteredFeature | null;
  onClose: () => void;
}

/** The first day of next month, when the free allowance fills up again. */
const resetDate = () => {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return next.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' });
};

const PERKS = [
  { icon: Link2, text: 'Onbeperkt recepten ophalen uit een link of video' },
  { icon: Camera, text: 'Onbeperkt je kast scannen met een foto' },
  { icon: Sparkles, text: 'Bonuschef, receptsuggesties en voedingswaarden' },
  { icon: Tag, text: 'Eén keer voor jullie samen, ook voor je partner' },
];

const PlusSheet = ({ feature, onClose }: PlusSheetProps) => (
  <Sheet open={Boolean(feature)} onOpenChange={(open) => { if (!open) onClose(); }}>
    <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-[20px]">
      <SheetHeader className="pr-10 text-left">
        <SheetTitle className="font-display text-xl">
          Je {FREE_LIMIT} {feature ? FEATURE_LABEL[feature] : ''} van deze maand zijn op
        </SheetTitle>
        <SheetDescription>
          Op {resetDate()} staat je tegoed weer op {FREE_LIMIT}. Je lijst, je recepten en je voorraad
          blijven gewoon werken.
        </SheetDescription>
      </SheetHeader>

      <div className="mt-5 rounded-[14px] border border-border bg-accent-soft p-4">
        <p className="font-display text-lg font-bold tracking-[-0.01em] text-foreground">CoupleCart Plus</p>
        <ul className="mt-3 space-y-2">
          {PERKS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-2 text-sm text-foreground">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" />
              <span>{text}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Check className="h-4 w-4" /> Binnenkort te koop
        </p>
      </div>

      <Button className="mt-5 min-h-12 w-full" onClick={onClose}>Begrepen</Button>
    </SheetContent>
  </Sheet>
);

export default PlusSheet;
