import { Beef, Carrot, CookingPot, Croissant, CupSoda, Leaf, Milk, Package, Salad, Snowflake, SprayCan, type LucideIcon } from 'lucide-react';
import type { Department } from '@/lib/storeRouteSort';

/**
 * One icon and one quiet hue per department, so you recognise the aisle before
 * you read the word. The tints are written out per department because Tailwind
 * only keeps class names it can see in the source.
 */
/** "kruiden" is not a shop department; the cupboard keeps its own shelf for it. */
export type HeadingCategory = Department | 'kruiden';

const DEPARTMENTS: Record<HeadingCategory, { icon: LucideIcon; tint: string }> = {
  kruiden: { icon: Leaf, tint: 'bg-[hsl(var(--cat-olijf)/0.15)] text-[hsl(var(--cat-olijf))] dark:bg-[hsl(var(--cat-olijf)/0.22)]' },
  groente_fruit: { icon: Carrot, tint: 'bg-[hsl(var(--dept-groente)/0.15)] text-[hsl(var(--dept-groente))] dark:bg-[hsl(var(--dept-groente)/0.22)]' },
  brood: { icon: Croissant, tint: 'bg-[hsl(var(--dept-brood)/0.15)] text-[hsl(var(--dept-brood))] dark:bg-[hsl(var(--dept-brood)/0.22)]' },
  vlees_vis: { icon: Beef, tint: 'bg-[hsl(var(--dept-vlees)/0.15)] text-[hsl(var(--dept-vlees))] dark:bg-[hsl(var(--dept-vlees)/0.22)]' },
  zuivel: { icon: Milk, tint: 'bg-[hsl(var(--dept-zuivel)/0.15)] text-[hsl(var(--dept-zuivel))] dark:bg-[hsl(var(--dept-zuivel)/0.22)]' },
  maaltijden: { icon: Salad, tint: 'bg-[hsl(var(--dept-maaltijden)/0.15)] text-[hsl(var(--dept-maaltijden))] dark:bg-[hsl(var(--dept-maaltijden)/0.22)]' },
  pasta_rijst: { icon: CookingPot, tint: 'bg-[hsl(var(--dept-pasta)/0.15)] text-[hsl(var(--dept-pasta))] dark:bg-[hsl(var(--dept-pasta)/0.22)]' },
  houdbaar: { icon: Package, tint: 'bg-[hsl(var(--dept-houdbaar)/0.15)] text-[hsl(var(--dept-houdbaar))] dark:bg-[hsl(var(--dept-houdbaar)/0.22)]' },
  drinken: { icon: CupSoda, tint: 'bg-[hsl(var(--dept-drinken)/0.15)] text-[hsl(var(--dept-drinken))] dark:bg-[hsl(var(--dept-drinken)/0.22)]' },
  huishouden: { icon: SprayCan, tint: 'bg-[hsl(var(--dept-huishouden)/0.15)] text-[hsl(var(--dept-huishouden))] dark:bg-[hsl(var(--dept-huishouden)/0.22)]' },
  diepvries: { icon: Snowflake, tint: 'bg-[hsl(var(--dept-diepvries)/0.15)] text-[hsl(var(--dept-diepvries))] dark:bg-[hsl(var(--dept-diepvries)/0.22)]' },
};

interface DepartmentHeadingProps {
  category: HeadingCategory;
  label: string;
  count: number;
}

const DepartmentHeading = ({ category, label, count }: DepartmentHeadingProps) => {
  const { icon: Icon, tint } = DEPARTMENTS[category];
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] ${tint}`} aria-hidden="true">
        <Icon className="h-4 w-4" strokeWidth={1.9} />
      </span>
      <h2 className="font-display text-[0.9375rem] font-bold tracking-[-0.01em] text-foreground">{label}</h2>
      <span className="ml-auto text-xs font-medium tabular-nums text-muted-foreground">{count}</span>
    </div>
  );
};

export default DepartmentHeading;
