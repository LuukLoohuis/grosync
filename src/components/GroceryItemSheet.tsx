import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Camera, ChevronRight, ExternalLink, Loader2, Merge, Minus, Plus, Tag, Trash2 } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/contexts/AppContext';
import { translateForSearch } from '@/lib/groceryTranslations';
import type { GroceryItem } from '@/types';
import { t } from '@/lib/i18n';
import { MAX_COUNT, countParts, itemCount } from '@/lib/itemCount';
import { toThumbDataUrl } from '@/lib/photo';
import { itemThumb } from '@/lib/itemThumb';

interface GroceryItemSheetProps {
  item: GroceryItem | null;
  /** De afdeling waar dit item onder staat, als bijschrift. */
  department?: string;
  onClose: () => void;
  onPickProduct: (id: string) => void;
}

const zoekterm = (name: string) =>
  encodeURIComponent(translateForSearch(name.replace(/^\d+(?:[.,]\d+)?(?:\s*[×x])?\s+/, '')));

/** Alles wat je met één boodschap kunt doen, op één plek in plaats van in een menu. */
const GroceryItemSheet = ({ item, department, onClose, onPickProduct }: GroceryItemSheetProps) => {
  const { renameGroceryItem, removeGroceryItem, mergeDuplicateItems, setGroceryItemCount, setGroceryItemDetails, groceryItems } = useAppContext();
  const [shown, setShown] = useState<GroceryItem | null>(item);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [fotoBezig, setFotoBezig] = useState(false);
  const fotoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!item) return;
    setShown(item);
    setName(item.name);
  }, [item]);

  // De notitie alleen bij een ander item opnieuw vullen: anders wist een
  // realtime-update van je partner wat je net aan het typen bent.
  useEffect(() => {
    if (item) setNote(item.note ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  if (!shown) return null;

  const dubbel = groceryItems.filter((row) => (
    !row.checked && row.id !== shown.id && row.name.trim().toLowerCase() === shown.name.trim().toLowerCase()
  )).length;

  const saveName = async () => {
    const typed = name.trim();
    if (!typed || typed === shown.name) return;
    await renameGroceryItem(shown.id, typed);
  };

  const saveNote = async () => {
    const typed = note.trim();
    if (typed === (shown.note ?? '')) return;
    await setGroceryItemDetails(shown.id, { note: typed });
  };

  const kiesFoto = async (file: File | undefined) => {
    if (!file) return;
    setFotoBezig(true);
    try {
      await setGroceryItemDetails(shown.id, { photo: await toThumbDataUrl(file) });
    } catch {
      toast.error(t("Foto lezen lukte niet"));
    } finally {
      setFotoBezig(false);
      if (fotoInput.current) fotoInput.current.value = '';
    }
  };

  const thumb = itemThumb(shown);
  const count = itemCount(shown);
  const stapKnop = 'flex h-11 w-11 items-center justify-center rounded-full border border-border-strong text-foreground transition-transform duration-100 ease-smooth active:scale-90 disabled:opacity-30';

  const rij = 'flex min-h-14 w-full items-center gap-3 border-t border-border px-1 text-left text-[0.9375rem] text-foreground';

  return (
    <Sheet open={Boolean(item)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="bottom" className="mx-auto max-h-[85vh] [@supports(height:100dvh)]:max-h-[85dvh] max-w-lg overflow-y-auto rounded-t-[20px]">
        <SheetHeader className="pr-10 text-left">
          <SheetTitle className="font-display text-xl">{shown.ahProduct ? shown.name : countParts(shown.name).rest}</SheetTitle>
          <SheetDescription className="text-accent-ink">
            {[shown.fromRecipe ? t('uit {0}', [shown.fromRecipe]) : null, department].filter(Boolean).join(' · ') || t("Op je lijst")}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex min-h-[60px] items-center justify-between">
          <span className="text-[0.9375rem] text-foreground">
            {shown.ahProduct ? t('Aantal pakken') : t('Aantal')}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setGroceryItemCount(shown.id, count - 1)}
              disabled={count <= 1}
              aria-label={t('Eén minder')}
              className={stapKnop}
            >
              <Minus className="h-4 w-4" />
            </button>
            <span aria-live="polite" className="min-w-10 text-center font-display text-[1.1875rem] font-bold tabular-nums text-foreground">
              {count}
            </span>
            <button
              type="button"
              onClick={() => setGroceryItemCount(shown.id, count + 1)}
              disabled={count >= MAX_COUNT}
              aria-label={t('Eén meer')}
              className={stapKnop}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-2">
          <label htmlFor="boodschap-naam" className="mb-1 block text-sm text-muted-foreground">{t("Naam")}</label>
          <Input
            id="boodschap-naam"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          />
          {shown.ahProduct && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("Wijzig je de naam, dan vervalt het gekozen AH-product.")}
            </p>
          )}
        </div>

        <section aria-labelledby="dit-merk" className="mt-5">
          <h3 id="dit-merk" className="font-display text-[0.9375rem] font-bold text-foreground">{t("Dit merk")}</h3>
          <p className="mb-2 text-xs text-muted-foreground">{t("Zodat de ander precies weet welke je bedoelt.")}</p>
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => fotoInput.current?.click()}
              disabled={fotoBezig}
              aria-label={shown.photo ? t("Andere foto kiezen") : t("Foto toevoegen")}
              className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border-strong bg-white text-muted-foreground"
            >
              {thumb
                ? <img src={thumb} alt="" className={`h-full w-full ${shown.photo ? 'object-cover' : 'object-contain'}`} />
                : <Camera className="h-5 w-5" />}
              {fotoBezig && (
                <span className="absolute inset-0 flex items-center justify-center bg-background/70">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </span>
              )}
            </button>
            <div className="min-w-0 flex-1">
              <label htmlFor="boodschap-notitie" className="sr-only">{t("Notitie")}</label>
              <Input
                id="boodschap-notitie"
                value={note}
                maxLength={120}
                placeholder={t("Bijv. Optimel, de blauwe")}
                onChange={(e) => setNote(e.target.value)}
                onBlur={saveNote}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              />
              <div className="mt-1 flex flex-wrap gap-x-4">
                <button type="button" onClick={() => fotoInput.current?.click()} disabled={fotoBezig} className="min-h-9 text-sm font-medium text-primary">
                  {shown.photo ? t("Andere foto") : t("Foto maken")}
                </button>
                {shown.photo && (
                  <button type="button" onClick={() => setGroceryItemDetails(shown.id, { photo: null })} className="min-h-9 text-sm text-muted-foreground">
                    {t("Foto weghalen")}
                  </button>
                )}
              </div>
            </div>
          </div>
          <input
            ref={fotoInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { void kiesFoto(e.target.files?.[0]); }}
          />
        </section>

        <div className="mt-4">
          {shown.ahProduct ? (
            <button type="button" onClick={() => { onClose(); onPickProduct(shown.id); }} className={rij}>
              <Tag className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">
                {shown.ahProduct.title}
                {shown.ahProduct.isBonus && <span className="ml-2 font-semibold text-accent-ink">{t("Bonus")}</span>}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ) : (
            <button type="button" onClick={() => { onClose(); onPickProduct(shown.id); }} className={rij}>
              <Tag className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1">{t("Product bij AH kiezen")}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          )}

          {dubbel > 0 && (
            <button type="button" onClick={() => { onClose(); void mergeDuplicateItems(); }} className={rij}>
              <Merge className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1">{t("Samenvoegen met dubbel item")}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          )}

          <a href={`https://www.ah.nl/zoeken?query=${zoekterm(shown.name)}`} target="_blank" rel="noopener noreferrer" className={rij}>
            <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex-1">{t("Zoek bij Albert Heijn")}</span>
          </a>
          <a href={`https://www.jumbo.com/producten/?searchTerms=${zoekterm(shown.name)}`} target="_blank" rel="noopener noreferrer" className={rij}>
            <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex-1">{t("Zoek bij Jumbo")}</span>
          </a>

          <button
            type="button"
            onClick={() => { onClose(); removeGroceryItem(shown.id); }}
            className={`${rij} text-destructive`}
          >
            <Trash2 className="h-4 w-4 shrink-0" />
            <span className="flex-1">{t("Weggooien")}</span>
          </button>
        </div>

        <Button className="mt-5 min-h-12 w-full" onClick={onClose}>{t("Klaar")}</Button>
      </SheetContent>
    </Sheet>
  );
};

export default GroceryItemSheet;
