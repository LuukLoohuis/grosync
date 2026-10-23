import { useEffect, useState } from 'react';
import { BellOff, BellRing, Loader2, SquarePlus } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useAppContext } from '@/contexts/AppContext';
import { useMeldStatus } from '@/hooks/useMeldStatus';
import {
  type MeldInstellingen, STANDAARD_INSTELLINGEN, bewaarInstellingen, leesInstellingen,
} from '@/lib/meldingen';
import { t } from '@/lib/i18n';

interface MeldingenSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Op iPhone eerst op het beginscherm; dit opent de uitleg daarvoor. */
  onBeginscherm?: () => void;
}

const SOORTEN: { key: keyof MeldInstellingen; label: string; uitleg: string }[] = [
  { key: 'toegevoegd', label: t('Iets op de lijst gezet'), uitleg: t('Als iemand anders boodschappen toevoegt') },
  { key: 'winkel', label: t('In de winkel'), uitleg: t('Als iemand boodschappen gaat doen: nog iets nodig?') },
  { key: 'klaar', label: t('Boodschappen gedaan'), uitleg: t('Als iemand klaar is in de winkel') },
  { key: 'voorraad', label: t('Voorraad op'), uitleg: t('Als iets in de voorraad op raakt') },
  { key: 'club', label: t('Nieuw in de Cart Club'), uitleg: t('Als er iemand bij jullie instapt') },
];

/** Een schakelaar zoals op je telefoon; de hele regel is de knop. */
const Schakelaar = ({ aan, label, uitleg, onChange, disabled }: {
  aan: boolean; label: string; uitleg: string; onChange: (aan: boolean) => void; disabled?: boolean;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={aan}
    disabled={disabled}
    onClick={() => onChange(!aan)}
    className="flex min-h-14 w-full items-center gap-3 rounded-[12px] px-3 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
  >
    <span className="min-w-0 flex-1">
      <span className="block text-[0.9375rem] font-medium text-foreground">{label}</span>
      <span className="block text-xs text-muted-foreground">{uitleg}</span>
    </span>
    <span
      aria-hidden="true"
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-150 ease-smooth ${aan ? 'bg-primary' : 'bg-border-strong'}`}
    >
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-150 ease-smooth ${aan ? 'translate-x-[1.375rem]' : 'translate-x-0.5'}`} />
    </span>
  </button>
);

/** Meldingen: aan of uit op dit toestel, en welke soorten je wilt (op al je toestellen). */
const MeldingenSheet = ({ open, onOpenChange, onBeginscherm }: MeldingenSheetProps) => {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const { household } = useAppContext();
  const { status, bezig, aan, uit, verfris } = useMeldStatus();
  const [instellingen, setInstellingen] = useState<MeldInstellingen>(STANDAARD_INSTELLINGEN);

  useEffect(() => {
    if (!open || !userId) return;
    void verfris();
    void leesInstellingen(userId).then(setInstellingen);
  }, [open, userId, verfris]);

  const wijzig = (key: keyof MeldInstellingen, waarde: boolean) => {
    if (!userId) return;
    const vorige = instellingen;
    const nieuw = { ...instellingen, [key]: waarde };
    setInstellingen(nieuw);
    void bewaarInstellingen(userId, nieuw).then((ok) => {
      if (ok) return;
      setInstellingen(vorige);
      toast.error(t("Bewaren lukte niet. Probeer het opnieuw."));
    });
  };

  const alleen = household.rol === 'geen';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-h-[85vh] [@supports(height:100dvh)]:max-h-[85dvh] max-w-lg overflow-y-auto rounded-t-[20px]">
        <SheetHeader className="pr-10 text-left">
          <SheetTitle className="font-display text-xl">{t("Meldingen")}</SheetTitle>
          <SheetDescription>
            {t("Een seintje als iemand anders uit je Cart Club iets doet. Nooit over wat je zelf doet.")}
          </SheetDescription>
        </SheetHeader>

        <section className="mt-5 rounded-[14px] border border-border bg-card p-4">
          {status === null && <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />}

          {status === 'aan' && (
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-primary-soft text-primary">
                <BellRing className="h-5 w-5" />
              </span>
              <p className="min-w-0 flex-1 text-sm font-medium text-foreground">{t("Aan op dit toestel")}</p>
              <Button variant="outline" className="min-h-11" disabled={bezig} onClick={() => void uit()}>
                {t("Uitzetten")}
              </Button>
            </div>
          )}

          {status === 'uit' && (
            <div>
              <p className="text-sm text-muted-foreground">{t("Op dit toestel staan meldingen uit.")}</p>
              <Button className="mt-3 min-h-12 w-full gap-2" disabled={bezig} onClick={() => void aan()}>
                {bezig ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
                {t("Meldingen aanzetten")}
              </Button>
            </div>
          )}

          {status === 'geweigerd' && (
            <div className="flex items-start gap-3">
              <BellOff aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {t("Je browser blokkeert meldingen van CoupleCart. Zet ze aan bij de site-instellingen van je browser (het slotje naast het adres) of in de instellingen van je telefoon, en kom dan terug.")}
              </p>
            </div>
          )}

          {status === 'beginscherm' && (
            <div>
              <p className="text-sm text-muted-foreground">
                {t("Op iPhone en iPad werken meldingen alleen als CoupleCart op je beginscherm staat. Open het daarvandaan en zet ze hier aan.")}
              </p>
              {onBeginscherm && (
                <Button variant="outline" className="mt-3 min-h-12 w-full gap-2" onClick={onBeginscherm}>
                  <SquarePlus className="h-4 w-4" /> {t("Laat zien hoe")}
                </Button>
              )}
            </div>
          )}

          {status === 'kan-niet' && (
            <p className="text-sm text-muted-foreground">{t("Deze browser kan geen meldingen tonen. Probeer Chrome, Edge, Firefox of Safari.")}</p>
          )}
        </section>

        {alleen && (
          <p className="mt-3 rounded-[12px] bg-accent-soft px-3 py-2.5 text-xs text-accent-ink">
            {t("Je zit nog alleen in je Cart Club. Meldingen komen zodra er iemand bij is.")}
          </p>
        )}

        <h3 className="mt-6 px-3 font-display text-[0.6875rem] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
          {t("Waarover")}
        </h3>
        <div className="mt-1 space-y-0.5">
          {SOORTEN.map(({ key, label, uitleg }) => (
            <Schakelaar key={key} aan={instellingen[key]} label={label} uitleg={uitleg} onChange={(waarde) => wijzig(key, waarde)} disabled={!userId} />
          ))}
        </div>

        <div className="mt-3 border-t border-border pt-3">
          <Schakelaar
            aan={instellingen.stille_uren}
            label={t("Stille uren")}
            uitleg={t("Geen meldingen tussen 22:00 en 8:00")}
            onChange={(waarde) => wijzig('stille_uren', waarde)}
            disabled={!userId}
          />
        </div>
        <p className="mt-2 px-3 pb-2 text-xs text-muted-foreground">
          {t("Hooguit één melding per soort per tien minuten. Deze keuzes gelden op al je toestellen.")}
        </p>
      </SheetContent>
    </Sheet>
  );
};

export default MeldingenSheet;
