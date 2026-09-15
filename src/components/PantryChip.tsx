import type { PantryItem } from '@/types';

interface PantryChipProps {
  item: PantryItem;
  /** Tailwind class for the little dot: the colour of its shelf. */
  dot: string;
  onOpen: () => void;
}

/**
 * One jar on the shelf. State is in the colour, the number sits behind the name,
 * and everything you can do with it waits one tap away — the same as the herbs.
 */
const PantryChip = ({ item, dot, onOpen }: PantryChipProps) => {
  const out = item.quantity === 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${item.name} openen`}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors duration-150 ease-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        out
          ? 'border-destructive/40 bg-destructive/10 text-destructive'
          : item.low
            ? 'border-transparent bg-accent-soft text-accent-ink'
            : 'border-border bg-card text-foreground hover:border-border-strong'
      }`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
      <span className="first-letter:uppercase">{item.name}</span>
      {item.quantity > 1 && <span className="text-xs tabular-nums opacity-70">×{item.quantity}</span>}
      {out && <span className="text-xs font-semibold">op</span>}
      {!out && item.low && <span className="text-xs font-semibold">bijna op</span>}
    </button>
  );
};

export default PantryChip;
