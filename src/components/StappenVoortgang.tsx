import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { stapStand, type Stap } from '@/lib/stappen';

interface StappenVoortgangProps {
  /** Wat de server achter elkaar doet, met hoe lang elke stap meestal duurt. */
  stappen: Stap[];
  /** Het antwoord is binnen: alle stappen afgevinkt. */
  klaar?: boolean;
  className?: string;
}

/**
 * Voor AI-taken die seconden duren: in plaats van een draaiend rondje zie je
 * wat er gebeurt, stap voor stap. Het tempo is een schatting; de laatste stap
 * blijft lopen tot het antwoord er is, dus hij is nooit eerder "af" dan de server.
 */
const StappenVoortgang = ({ stappen, klaar = false, className = '' }: StappenVoortgangProps) => {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    const begin = performance.now();
    const klok = window.setInterval(() => setMs(performance.now() - begin), 150);
    return () => window.clearInterval(klok);
  }, []);

  const { index, deel } = stapStand(stappen, ms, klaar);
  const nu = stappen[Math.min(index, stappen.length - 1)];

  return (
    <div className={`rounded-[14px] border border-border bg-card px-4 py-3 ${className}`}>
      <p role="status" className="sr-only">{klaar ? '' : nu?.label}</p>
      <ol aria-hidden="true" className="space-y-2.5">
        {stappen.map((stap, i) => {
          const af = i < index;
          const bezig = i === index;
          return (
            <li key={stap.label} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                {af ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-soft text-primary">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                ) : bezig ? (
                  <span className="h-2.5 w-2.5 rounded-full bg-primary motion-safe:animate-pulse" />
                ) : (
                  <span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-border-strong" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${bezig ? 'font-semibold text-foreground' : af ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {stap.label}
                </p>
                {bezig && (
                  <span className="mt-1.5 block h-0.5 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full origin-left bg-primary transition-transform duration-150 ease-linear"
                      style={{ transform: `scaleX(${deel})` }}
                    />
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default StappenVoortgang;
