import { Tag } from 'lucide-react';

const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });

interface BonusOfferCardProps {
  title: string;
  mechanism: string | null;
  price: number | null;
  priceBefore: number | null;
  imageUrl?: string | null;
  unitSize?: string | null;
  /** Why this offer is here: the ingredient from your recipe it matched. */
  because?: string;
  onAdd?: () => void;
}

/**
 * One offer, the way a shelf label shows it: picture, what it is, what the
 * discount does, and what it costs now against what it cost before.
 */
const BonusOfferCard = ({ title, mechanism, price, priceBefore, imageUrl, unitSize, because, onAdd }: BonusOfferCardProps) => {
  const cheaper = price != null && priceBefore != null && priceBefore > price;

  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={!onAdd}
      className="flex w-[9.5rem] shrink-0 flex-col overflow-hidden rounded-[12px] border border-border bg-card text-left transition-shadow duration-150 ease-smooth hover:shadow-soft disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative h-24 w-full bg-white">
        {imageUrl ? (
          <img src={imageUrl} alt="" loading="lazy" className="h-full w-full object-contain p-1.5" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-muted-foreground"><Tag className="h-5 w-5" /></span>
        )}
        <span className="absolute left-1 top-1 rounded-md bg-[hsl(var(--ah-bonus))] px-1.5 py-0.5 font-display text-[0.625rem] font-bold text-white">
          Bonus
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-2">
        <p className="line-clamp-2 text-xs leading-tight text-foreground">{title}</p>
        {unitSize && <p className="text-[0.625rem] text-muted-foreground">{unitSize}</p>}
        {mechanism && (
          <p className="font-display text-[0.6875rem] font-bold leading-tight text-accent-ink">{mechanism}</p>
        )}
        <p className="mt-auto flex items-baseline gap-1.5">
          {price != null && (
            <span className="font-display text-sm font-bold tabular-nums text-foreground">{euro.format(price)}</span>
          )}
          {cheaper && (
            <span className="text-[0.6875rem] tabular-nums text-muted-foreground line-through">{euro.format(priceBefore!)}</span>
          )}
        </p>
        {because && <p className="truncate text-[0.625rem] text-muted-foreground">voor je {because}</p>}
      </div>
    </button>
  );
};

export default BonusOfferCard;
