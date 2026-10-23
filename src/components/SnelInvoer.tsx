import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Mic, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppContext } from '@/contexts/AppContext';
import { leesInvoer, type Ingevoerd } from '@/lib/snelInvoer';
import { VASTE_WINKELS, winkelsOpLijst, zelfdeWinkel } from '@/lib/winkels';
import { departmentLabel } from '@/lib/storeRouteSort';
import ItemThumb from '@/components/ItemThumb';
import { countParts } from '@/lib/itemCount';
import { tik } from '@/lib/haptics';
import { locale, t } from '@/lib/i18n';

// De spraakherkenning van de browser; Safari kent hem alleen als webkitSpeechRecognition.
interface Herkenning {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type HerkenningKlasse = new () => Herkenning;

const herkenningKlasse = (): HerkenningKlasse | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: HerkenningKlasse; webkitSpeechRecognition?: HerkenningKlasse };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

interface Kaartje {
  id: number;
  naam: string;
  /** Waar je het haalt; null = maakt niet uit. */
  winkel: string | null;
}

/**
 * Het invoerveld van de lijst. Eén boodschap gaat er meteen op; een zin met
 * meer ("2 melk, eieren en brood") of iets ingesprokens wordt eerst kaartjes,
 * zodat je ziet wat erop komt voordat het erop staat.
 */
const SnelInvoer = () => {
  const { addGroceryItems, groceryItems, herinnering } = useAppContext();
  const bekend = winkelsOpLijst(groceryItems);
  const winkelKeuzes = [...VASTE_WINKELS, ...bekend].filter((w, i, alle) => alle.findIndex((x) => zelfdeWinkel(x, w)) === i);
  // Genoemd in de zin wint; anders wat er de vorige keer bij hoorde.
  const maakKaartjes = (ingevoerd: Ingevoerd[]): Kaartje[] => ingevoerd.map(({ naam, winkel }) => ({
    id: ++volgnummer.current,
    naam,
    winkel: winkel ?? herinnering(naam)?.store ?? null,
  }));
  const kaal = (naam: string) => countParts(naam).rest.trim().toLocaleLowerCase('nl');
  const alOpLijst = (naam: string) => groceryItems.some((i) => !i.checked && kaal(i.name) === kaal(naam));
  const [tekst, setTekst] = useState('');
  const [kaartjes, setKaartjes] = useState<Kaartje[] | null>(null);
  const [bewerkt, setBewerkt] = useState<number | null>(null);
  const [luistert, setLuistert] = useState(false);
  const herkenning = useRef<Herkenning | null>(null);
  const volgnummer = useRef(0);
  const Klasse = herkenningKlasse();

  useEffect(() => () => herkenning.current?.abort(), []);

  const verstuur = () => {
    const ingevoerd = leesInvoer(tekst, bekend);
    if (ingevoerd.length === 0) return;
    setTekst('');
    if (ingevoerd.length === 1 && !kaartjes) {
      // Eén boodschap gaat er meteen op; met een genoemde winkel, anders wat onthouden is.
      const [{ naam, winkel }] = ingevoerd;
      void addGroceryItems([winkel ? { name: naam, store: winkel } : { name: naam }]);
      return;
    }
    setKaartjes((huidige) => [...(huidige ?? []), ...maakKaartjes(ingevoerd)]);
    setBewerkt(null);
  };

  const zetErop = async () => {
    const klaar = (kaartjes ?? []).map((k) => ({ ...k, naam: k.naam.trim() })).filter((k) => k.naam);
    if (klaar.length === 0) { setKaartjes(null); return; }
    setKaartjes(null);
    if (await addGroceryItems(klaar.map((k) => ({ name: k.naam, store: k.winkel })))) {
      tik('licht');
      toast.success(klaar.length === 1 ? t('“{0}” staat op je lijst', [klaar[0].naam]) : t('{0} boodschappen op je lijst', [klaar.length]));
    } else {
      setKaartjes(klaar);
    }
  };

  const luister = () => {
    if (!Klasse) return;
    if (luistert) { herkenning.current?.stop(); return; }
    const rec = new Klasse();
    rec.lang = locale();
    rec.interimResults = true;
    rec.continuous = false;
    let gehoord = '';
    rec.onresult = (event) => {
      gehoord = Array.from(event.results).map((r) => r[0]?.transcript ?? '').join(' ').trim();
      setTekst(gehoord);
    };
    rec.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        toast.error(t("Geef CoupleCart toegang tot je microfoon om in te spreken."));
      } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
        toast.error(t("Inspreken lukte niet. Typ het maar even."));
      }
    };
    rec.onend = () => {
      setLuistert(false);
      herkenning.current = null;
      // Ingesproken gaat altijd langs de kaartjes: spraak verstaat weleens wat anders.
      const ingevoerd = leesInvoer(gehoord, bekend);
      if (ingevoerd.length > 0) {
        setKaartjes((huidige) => [...(huidige ?? []), ...maakKaartjes(ingevoerd)]);
        setTekst('');
      }
    };
    herkenning.current = rec;
    try {
      rec.start();
      setLuistert(true);
      tik('licht');
    } catch {
      herkenning.current = null;
      toast.error(t("Inspreken lukte niet. Typ het maar even."));
    }
  };

  const pasAan = (id: number, wijziging: Partial<Kaartje>) =>
    setKaartjes((huidige) => huidige?.map((k) => (k.id === id ? { ...k, ...wijziging } : k)) ?? null);
  const haalWeg = (id: number) =>
    setKaartjes((huidige) => {
      const over = huidige?.filter((k) => k.id !== id) ?? [];
      return over.length > 0 ? over : null;
    });

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Input
            placeholder={luistert ? t("Zeg maar wat je nodig hebt…") : t("Wat moet je halen?")}
            aria-label={t("Wat moet je halen?")}
            value={tekst}
            onChange={(e) => setTekst(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && verstuur()}
            className={`bg-card border-border font-body ${Klasse ? 'pr-12' : ''}`}
          />
          {Klasse && (
            <button
              type="button"
              onClick={luister}
              aria-label={luistert ? t("Stop met luisteren") : t("Inspreken")}
              aria-pressed={luistert}
              className={`absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full transition-colors ${
                luistert ? 'text-destructive' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {luistert && <span aria-hidden="true" className="absolute h-8 w-8 animate-ping rounded-full bg-destructive/20" />}
              <Mic className="relative h-4 w-4" />
            </button>
          )}
        </div>
        <Button onClick={verstuur} size="icon" className="shrink-0 h-11 w-11" aria-label={t("Toevoegen")}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {kaartjes && (
        <section aria-label={t("Controleer wat erop komt")} className="rounded-[14px] border border-primary/30 bg-card p-3">
          <p className="px-1 text-xs font-medium text-muted-foreground">{t("Klopt dit? Tik om aan te passen.")}</p>
          <ul className="mt-2 space-y-1.5">
            {kaartjes.map((k) => (
              <li key={k.id} className="flex min-h-12 items-center gap-2.5 rounded-lg bg-muted/60 pl-2.5 pr-1">
                <ItemThumb item={{ id: String(k.id), name: k.naam, checked: false }} label={k.naam} vergroot={false} className="h-8 w-8 text-sm" />
                {bewerkt === k.id ? (
                  <Input
                    autoFocus
                    value={k.naam}
                    maxLength={80}
                    aria-label={t("Naam")}
                    onChange={(e) => pasAan(k.id, { naam: e.target.value })}
                    onBlur={() => { setBewerkt(null); if (!k.naam.trim()) haalWeg(k.id); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    className="h-9 flex-1 bg-card"
                  />
                ) : (
                  <button type="button" onClick={() => setBewerkt(k.id)} className="min-w-0 flex-1 py-1.5 text-left">
                    <span className="block truncate text-[0.9375rem] font-medium text-foreground">{k.naam}</span>
                    <span className="block text-xs text-muted-foreground">
                      {departmentLabel(k.naam)}
                      {alOpLijst(k.naam) && <span className="font-medium text-accent-ink"> · {t("staat al op je lijst")}</span>}
                    </span>
                  </button>
                )}
                <label className="relative shrink-0">
                  <span className="sr-only">{t("Winkel voor {0}", [k.naam])}</span>
                  <select
                    value={k.winkel ?? ''}
                    onChange={(e) => pasAan(k.id, { winkel: e.target.value || null })}
                    className={`h-8 max-w-[7.5rem] appearance-none truncate rounded-full border px-2.5 text-xs font-semibold ${
                      k.winkel ? 'border-primary/40 bg-primary-soft text-primary' : 'border-dashed border-border-strong bg-transparent text-muted-foreground'
                    }`}
                  >
                    <option value="">{t("+ winkel")}</option>
                    {winkelKeuzes.map((w) => <option key={w} value={w}>{w}</option>)}
                    {k.winkel && !winkelKeuzes.some((w) => zelfdeWinkel(w, k.winkel)) && <option value={k.winkel}>{k.winkel}</option>}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => haalWeg(k.id)}
                  aria-label={t("Haal {0} weg", [k.naam])}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <Button variant="ghost" className="min-h-11" onClick={() => setKaartjes(null)}>{t("Annuleren")}</Button>
            <Button className="min-h-11 flex-1" onClick={() => { void zetErop(); }}>
              {kaartjes.length === 1 ? t("Zet 1 op je lijst") : t("Zet {0} op je lijst", [kaartjes.length])}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
};

export default SnelInvoer;
