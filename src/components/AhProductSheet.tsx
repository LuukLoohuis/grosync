import { useEffect, useState } from 'react';
import { ExternalLink, Loader2, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAppContext } from '@/contexts/AppContext';
import { ahProductUrl, fetchAhAlternatives, type AhAlternative } from '@/services/ahApi';
import type { GroceryItem } from '@/types';

const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });

interface AhProductSheetProps {
  item: GroceryItem | null;
  onClose: () => void;
}

const AhProductSheet = ({ item, onClose }: AhProductSheetProps) => {
  const { applyAhMatches } = useAppContext();
  // Keep showing the last item while the sheet slides away.
  const [lastItem, setLastItem] = useState<GroceryItem | null>(item);
  const shown = item ?? lastItem;
  const [options, setOptions] = useState<AhAlternative[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [saving, setSaving] = useState(false);

  // Reset the choice when another item opens, not when this one updates.
  useEffect(() => {
    if (!item) return;
    setLastItem(item);
    setSelectedId(item.ahProduct?.id ?? null);
    setQuantity(item.ahProduct?.quantity ?? 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  useEffect(() => {
    if (!item) return;
    let cancelled = false;
    setStatus('loading');
    setOptions([]);
    fetchAhAlternatives({ id: item.id, name: item.name }, item.ahProduct?.id)
      .then((alternatives) => {
        if (cancelled) return;
        setOptions(alternatives);
        setStatus('ready');
      })
      .catch((error) => {
        console.error('AH alternatives failed:', error);
        if (!cancelled) setStatus('error');
      });
    return () => { cancelled = true; };
    // Fetch once per opened item (and on retry), not on every realtime update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, attempt]);

  const current: AhAlternative | null = shown?.ahProduct
    ? {
        productId: shown.ahProduct.id,
        title: shown.ahProduct.title,
        unitSize: shown.ahProduct.unitSize ?? '',
        price: shown.price != null ? Math.round((shown.price / shown.ahProduct.quantity) * 100) / 100 : 0,
        isBonus: shown.ahProduct.isBonus,
        bonusMechanism: null,
        imageUrl: shown.ahProduct.imageUrl,
        category: shown.ahProduct.category ?? '',
      }
    : null;
  const choices = [...(current ? [current] : []), ...options.filter((option) => option.productId !== current?.productId)];
  const selected = choices.find((choice) => choice.productId === selectedId) ?? null;

  const applyChoice = async () => {
    if (!shown || !selected) return;
    setSaving(true);
    await applyAhMatches([{
      itemId: shown.id,
      productId: selected.productId,
      title: selected.title,
      unitSize: selected.unitSize,
      unitPrice: selected.price,
      quantity,
      price: Math.round(selected.price * quantity * 100) / 100,
      isBonus: selected.isBonus,
      bonusMechanism: selected.bonusMechanism,
      imageUrl: selected.imageUrl,
      productUrl: ahProductUrl(selected.productId),
      category: selected.category,
    }]);
    setSaving(false);
    onClose();
  };

  return (
    <Sheet open={Boolean(item)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="bottom" className="mx-auto flex max-h-[90dvh] max-w-lg flex-col gap-0 rounded-t-2xl p-0">
        {shown && (
          <>
            <SheetHeader className="px-5 pb-3 pt-5 pr-14 text-left">
              <SheetTitle className="font-display text-xl">Kies een ander product</SheetTitle>
              <SheetDescription className="truncate">Voor {shown.name}</SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-5 pb-4">
              <div role="group" aria-label="Producten bij AH" className="space-y-2">
                {choices.map((choice) => {
                  const isSelected = choice.productId === selectedId;
                  return (
                    <button
                      key={choice.productId}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setSelectedId(choice.productId)}
                      className={`flex min-h-14 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                        isSelected ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted'
                      }`}
                    >
                      {choice.imageUrl
                        ? <img src={choice.imageUrl} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded bg-white object-contain" />
                        : <span className="h-10 w-10 shrink-0 rounded bg-muted" aria-hidden="true" />}
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-foreground">{choice.title}</span>
                        <span className="block text-xs text-muted-foreground tabular-nums">
                          {[choice.unitSize, euro.format(choice.price)].filter(Boolean).join(' · ')}
                          {current && choice.productId === current.productId && ' · nu gekozen'}
                        </span>
                      </span>
                      {choice.isBonus && (
                        <span className="shrink-0 rounded bg-[#ff7900]/15 px-1.5 py-0.5 text-xs font-semibold text-[#c25e00] dark:text-[#ff9d57]">Bonus</span>
                      )}
                    </button>
                  );
                })}
                {status === 'loading' && [0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
              </div>

              {status === 'error' && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Andere producten ophalen lukte niet.{' '}
                  <button type="button" onClick={() => setAttempt((n) => n + 1)} className="min-h-11 font-medium text-primary hover:underline">
                    Opnieuw proberen
                  </button>
                </p>
              )}
              {status === 'ready' && options.length === 0 && (
                <p className="mt-3 text-sm text-muted-foreground">AH heeft geen andere producten voor deze boodschap.</p>
              )}

              <div className="mt-4 flex items-center justify-between rounded-lg bg-muted pl-3">
                <span className="text-sm font-medium text-foreground tabular-nums">
                  Aantal: {quantity}{selected ? ` · ${euro.format(selected.price * quantity)}` : ''}
                </span>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setQuantity((n) => Math.max(1, n - 1))}
                    disabled={quantity <= 1}
                    aria-label="Minder"
                    className="flex h-11 w-11 items-center justify-center rounded-md hover:bg-background disabled:opacity-40"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuantity((n) => Math.min(99, n + 1))}
                    disabled={quantity >= 99}
                    aria-label="Meer"
                    className="flex h-11 w-11 items-center justify-center rounded-md hover:bg-background disabled:opacity-40"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {selected && (
                <a
                  href={ahProductUrl(selected.productId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" /> Bekijk op ah.nl
                </a>
              )}
            </div>

            <div className="border-t border-border px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <Button className="min-h-11 w-full gap-2" onClick={applyChoice} disabled={!selected || saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Gebruik dit product
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default AhProductSheet;
