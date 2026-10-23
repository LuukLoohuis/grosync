import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { minderBeweging, tik } from '@/lib/haptics';

// Zo lang staat het vinkje in beeld voordat de regel naar de kar gaat:
// het rondje vult zich, daarna klapt de regel dicht.
export const WEGVINK_MS = 420;

/** Het rondje voor afvinken: leeg, of gevuld met een vinkje dat even opveert. */
export const CheckCircle = ({ on, large = false }: { on: boolean; large?: boolean }) => {
  const size = large ? 'h-7 w-7' : 'h-6 w-6';
  return on ? (
    <span className={`flex ${size} items-center justify-center rounded-full bg-primary animate-check-pop`}>
      <Check className={large ? 'h-4 w-4 text-primary-foreground' : 'h-3.5 w-3.5 text-primary-foreground'} strokeWidth={3} />
    </span>
  ) : (
    <span className={`${size} rounded-full border-2 border-border-strong transition-colors duration-150 ease-smooth group-hover/check:border-primary group-hover/check:bg-primary-soft`} />
  );
};

/** Een regel die na het afvinken dichtklapt in plaats van ineens te verdwijnen. */
export const Wegvinken = ({ weg, children }: { weg: boolean; children: ReactNode }) => (
  <div
    className="grid transition-[grid-template-rows,opacity] duration-250 ease-smooth"
    style={{
      gridTemplateRows: weg ? '0fr' : '1fr',
      opacity: weg ? 0 : 1,
      transitionDelay: weg ? '170ms' : '0ms',
    }}
  >
    <div className="min-h-0 overflow-hidden">{children}</div>
  </div>
);

/**
 * Afvinken met een korte overgang: eerst het vinkje en een tik, dan pas echt
 * afgevinkt. Een tweede tik tijdens de overgang telt niet nog eens.
 */
export const useWegvinken = <T extends { id: string }>(commit: (item: T) => void) => {
  const [weg, setWeg] = useState<ReadonlySet<string>>(() => new Set());
  const timers = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; item: T }>());
  const commitRef = useRef(commit);
  commitRef.current = commit;

  useEffect(() => () => {
    // Weg uit beeld voor de overgang klaar is: dan alsnog afvinken.
    timers.current.forEach(({ timer, item }) => {
      clearTimeout(timer);
      commitRef.current(item);
    });
    timers.current.clear();
  }, []);

  const vink = useCallback((item: T) => {
    if (timers.current.has(item.id)) return;
    tik('vink');
    if (minderBeweging()) {
      commitRef.current(item);
      return;
    }
    setWeg((prev) => new Set(prev).add(item.id));
    const timer = setTimeout(() => {
      timers.current.delete(item.id);
      commitRef.current(item);
      setWeg((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }, WEGVINK_MS);
    timers.current.set(item.id, { timer, item });
  }, []);

  return { weg, vink };
};
