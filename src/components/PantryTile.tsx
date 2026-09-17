import type { PantryItem } from '@/types';

interface PantryTileProps {
  item: PantryItem;
  onOpen: () => void;
}

/**
 * Eén product in de kast. De staat zit in de rand, niet in een extra element:
 * gewoon is een dunne rand, bijna op is oranje, op is rood met een nul erachter.
 */
const PantryTile = ({ item, onOpen }: PantryTileProps) => {
  const op = item.quantity === 0;
  const staat = op ? 'op' : item.low ? 'bijna op' : null;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${item.name} openen`}
      className={`flex min-h-[46px] w-full items-center gap-2 rounded-[12px] border bg-card px-2.5 py-[7px] text-left transition-colors duration-150 ease-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        op ? 'border-destructive/70' : item.low ? 'border-accent' : 'border-border hover:border-border-strong'
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.90625rem] font-medium leading-tight text-foreground first-letter:uppercase">
          {item.name}
        </span>
        {staat && (
          <span
            className={`mt-0.5 block font-display text-[0.625rem] font-semibold uppercase tracking-[0.06em] ${
              op ? 'text-destructive' : 'text-accent-ink'
            }`}
          >
            {staat}
          </span>
        )}
      </span>
      <span className="shrink-0 font-display text-sm font-bold tabular-nums text-muted-foreground">
        {item.quantity}
      </span>
    </button>
  );
};

export default PantryTile;
