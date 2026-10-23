import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { GroceryItem } from '@/types';
import { t } from '@/lib/i18n';
import { itemThumb } from '@/lib/itemThumb';
import { beginletter, productIcoon } from '@/lib/productIcoon';
import { departmentOf } from '@/lib/storeRouteSort';
import { DEPARTMENT_COUNT } from '@/components/DepartmentHeading';

interface ItemThumbProps {
  item: GroceryItem;
  /** Naam zonder aantal, voor de tekst bij de vergroting. */
  label: string;
  className?: string;
  /** Tikken = groot bekijken. Uit waar de hele regel al een knop is. */
  vergroot?: boolean;
}

/**
 * Miniatuur naast een boodschap: je eigen foto, het AH-plaatje, of anders een
 * pictogram (🍌). Een foto kun je aantikken om hem groot te zien.
 */
const ItemThumb = ({ item, label, className = 'h-12 w-12', vergroot = true }: ItemThumbProps) => {
  const [open, setOpen] = useState(false);
  const src = itemThumb(item);
  const vak = `flex shrink-0 items-center justify-center overflow-hidden rounded-lg ${className}`;
  if (!src) {
    const icoon = productIcoon(item.name);
    if (icoon) {
      return <span aria-hidden="true" className={`${vak} border border-border bg-card leading-none`}><span className="text-[1.5em]">{icoon}</span></span>;
    }
    // Onbekend product: de beginletter in de kleur van de afdeling, geen plaatje dat iets anders zegt.
    return (
      <span aria-hidden="true" className={`${vak} ${DEPARTMENT_COUNT[departmentOf(item.name)]} font-display font-bold leading-none`}>
        {beginletter(item.name)}
      </span>
    );
  }
  const plaatje = <img src={src} alt="" loading="lazy" className={`h-full w-full ${item.photo ? 'object-cover' : 'object-contain'}`} />;
  if (!vergroot) return <span aria-hidden="true" className={`${vak} border border-border bg-white`}>{plaatje}</span>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("Foto van {0} groot bekijken", [label])}
        className={`${vak} border border-border bg-white`}
      >
        {plaatje}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm gap-3 rounded-[20px] p-4">
          <DialogTitle className="pr-8 font-display text-lg">{label}</DialogTitle>
          <DialogDescription className={item.note ? 'text-[0.9375rem] text-foreground' : 'sr-only'}>
            {item.note || (item.ahProduct?.title ?? label)}
          </DialogDescription>
          <img src={src} alt={item.note || item.ahProduct?.title || label} className="max-h-[60vh] w-full rounded-lg bg-white object-contain" />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ItemThumb;
