import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { GroceryItem } from '@/types';
import { t } from '@/lib/i18n';
import { itemThumb } from '@/lib/itemThumb';

interface ItemThumbProps {
  item: GroceryItem;
  /** Naam zonder aantal, voor de tekst bij de vergroting. */
  label: string;
  className?: string;
}

/** Miniatuur naast een boodschap; tikken laat hem groot zien, met de notitie erbij. */
const ItemThumb = ({ item, label, className = 'h-12 w-12' }: ItemThumbProps) => {
  const [open, setOpen] = useState(false);
  const src = itemThumb(item);
  if (!src) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("Foto van {0} groot bekijken", [label])}
        className={`shrink-0 overflow-hidden rounded-lg border border-border bg-white ${className}`}
      >
        <img src={src} alt="" loading="lazy" className={`h-full w-full ${item.photo ? 'object-cover' : 'object-contain'}`} />
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
