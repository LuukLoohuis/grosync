import { huiskleur } from '@/lib/winkels';

/** Klein winkellabel naast een boodschap: supermarkten in hun huiskleur, de rest grijs. */
const WinkelLabel = ({ winkel, className = '' }: { winkel: string; className?: string }) => (
  <span className={`shrink-0 rounded-md px-1.5 py-px text-[0.6875rem] font-semibold ${huiskleur(winkel) ?? 'bg-muted text-muted-foreground'} ${className}`}>
    {winkel}
  </span>
);

/** Stipje in de huiskleur voor een winkelknop die niet gekozen is; niets voor een winkel zonder kleur. */
export const WinkelStip = ({ winkel }: { winkel: string | null }) => {
  const kleur = huiskleur(winkel);
  return kleur ? <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${kleur}`} /> : null;
};

export default WinkelLabel;
