import type { HeadingCategory } from '@/components/DepartmentHeading';
import { DEPARTMENT_CHIP, DEPARTMENT_COUNT } from '@/components/DepartmentHeading';
import type { PantryItem } from '@/types';
import { t } from '@/lib/i18n';

interface PantryChipProps {
  item: PantryItem;
  /** The shelf it stands on; it borrows that colour. */
  shelf: HeadingCategory;
  onOpen: () => void;
}

/**
 * One jar on the shelf, in the colour of that shelf. The count is a badge, the
 * state is the whole chip: amber when it is running out, red when it is gone.
 */
const PantryChip = ({ item, shelf, onOpen }: PantryChipProps) => {
  const out = item.quantity === 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t("{0} openen", [item.name])}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-[0.9375rem] transition-[background-color,border-color,transform] duration-150 ease-smooth active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        out
          ? 'border-destructive/35 bg-destructive/10 text-destructive'
          : item.low
            ? 'border-accent/40 bg-accent-soft text-accent-ink'
            : `${DEPARTMENT_CHIP[shelf]} text-foreground`
      }`}
    >
      <span className="first-letter:uppercase">{item.name}</span>

      {item.quantity > 1 && (
        <span
          className={`-mr-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-display text-[0.6875rem] font-bold tabular-nums ${
            out || item.low ? 'bg-background/60 text-current' : DEPARTMENT_COUNT[shelf]
          }`}
        >
          {item.quantity}
        </span>
      )}

      {out && <span className="-mr-0.5 text-xs font-semibold">{t("op")}</span>}
      {!out && item.low && <span className="-mr-0.5 text-xs font-semibold">{t("bijna op")}</span>}
    </button>
  );
};

export default PantryChip;
