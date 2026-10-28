import type { ReactNode } from 'react';
import type { GroceryItem } from '@/types';
import ItemThumb from '@/components/ItemThumb';
import { CheckCircle } from '@/components/CheckOff';
import { t } from '@/lib/i18n';

interface ItemRegelProps {
  item: GroceryItem;
  /** De naam zoals dit scherm hem toont: in de lijst zonder aantal, in de winkel met. */
  naam: string;
  /** Winkelmodus: groter vinkje, plaatje en naam, voor in het gangpad met één hand. */
  groot?: boolean;
  /** Net afgevinkt: het rondje staat vol terwijl de regel wegvouwt. */
  af?: boolean;
  onVinkAf: () => void;
  /** Tik op de regel opent het product; zonder dit is de regel alleen om af te vinken. */
  onOpen?: () => void;
  /** Direct naast de naam: winkel of Bonus. */
  naastNaam?: ReactNode;
  /** Regels onder de naam: notitie, recept, AH-product. */
  onder?: ReactNode;
  /** Rechts in de regel: prijs of gewicht. */
  rechts?: ReactNode;
  /** Na de regel, buiten de tikzone: het aantal. */
  achter?: ReactNode;
  className?: string;
}

/**
 * Eén boodschap, op elk scherm hetzelfde: rondje, plaatje, naam. Lijst, Vandaag
 * en Winkelmodus verschillen alleen in maat en in wat er rechts staat.
 */
const ItemRegel = ({ item, naam, groot = false, af = false, onVinkAf, onOpen, naastNaam, onder, rechts, achter, className = '' }: ItemRegelProps) => {
  const midden = (
    <>
      <ItemThumb
        item={item}
        label={naam}
        // Een vergroot-knop kan niet in de knop die het product opent.
        vergroot={groot && !onOpen}
        className={groot ? 'h-14 w-14 rounded-xl text-xl' : 'h-10 w-10 rounded-[10px] text-base'}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className={groot
            ? 'truncate font-display text-lg font-bold tracking-[-0.01em] text-foreground'
            : 'truncate text-[0.9375rem] font-medium text-foreground'}
          >
            {naam}
          </span>
          {naastNaam}
        </span>
        {onder}
      </span>
      {rechts}
    </>
  );
  const middenKlasse = 'flex min-w-0 flex-1 items-center gap-2.5 py-2 text-left';

  return (
    <div className={`flex items-center gap-1 pl-1 pr-1.5 ${groot ? 'min-h-18' : 'min-h-14'} ${className}`}>
      <button
        type="button"
        onClick={onVinkAf}
        aria-label={t("Vink {0} af", [item.name])}
        className={`group/check flex shrink-0 items-center justify-center rounded-xl focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${groot ? 'h-14 w-14' : 'h-11 w-11'}`}
      >
        <CheckCircle on={af} large={groot} />
      </button>
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label={t("Opties voor {0}", [item.name])}
          className={`${middenKlasse} focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring`}
        >
          {midden}
        </button>
      ) : (
        <div className={middenKlasse}>{midden}</div>
      )}
      {achter}
    </div>
  );
};

export default ItemRegel;
