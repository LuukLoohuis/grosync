import { ArrowRight } from 'lucide-react';
import type { PantryItem } from '@/types';
import { t } from '@/lib/i18n';

interface PantryTileProps {
  item: PantryItem;
  /** In de bijwerkstand loopt een tik door vol → bijna op → op. */
  bijwerken?: boolean;
  onOpen: () => void;
}

/**
 * Eén product in de kast. De staat zit in de rand, niet in een extra element:
 * gewoon is een dunne rand, bijna op is oranje, op is rood met een nul erachter.
 */
const PantryTile = ({ item, bijwerken = false, onOpen }: PantryTileProps) => {
  const op = item.quantity === 0;
  const staat = op ? 'op' : item.low ? 'bijna op' : null;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={bijwerken ? t('Werk {0} bij', [item.name]) : t("{0} openen", [item.name])}
      className={`flex min-h-[46px] w-full items-center gap-2 rounded-[12px] border bg-card px-2.5 py-[7px] text-left transition-colors duration-150 ease-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        bijwerken ? 'border-primary/50 hover:border-primary' : op ? 'border-destructive/70' : item.low ? 'border-accent' : 'border-border hover:border-border-strong'
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
      {bijwerken ? (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary" aria-hidden="true">
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.4} />
        </span>
      ) : (
        <span className="shrink-0 font-display text-sm font-bold tabular-nums text-muted-foreground">
          {item.quantity}
        </span>
      )}
    </button>
  );
};

export default PantryTile;
