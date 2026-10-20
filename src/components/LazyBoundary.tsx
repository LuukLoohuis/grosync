import { Component, Suspense, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';

interface LazyBoundaryProps {
  children: ReactNode;
  /** Shown while the chunk comes in. */
  fallback?: ReactNode;
  /** Called instead of showing the message when the part could not load. */
  onError?: () => void;
}

/**
 * Suspense for parts that load on demand (see lazyPart), and what to show when such a part
 * can't load — no signal, or a new version replaced its chunk — instead of a white screen.
 */
export class LazyBoundary extends Component<LazyBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Loading part of CoupleCart failed:', error);
    this.props.onError?.();
  }

  render() {
    if (this.state.failed) {
      if (this.props.onError) return null;
      return (
        <div role="alert" className="mx-auto max-w-sm px-5 py-16 text-center">
          <p className="font-display text-lg font-semibold text-foreground">{t("Dit deel van CoupleCart laadt niet")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("Controleer je verbinding en laad de app opnieuw.")}</p>
          <Button className="mt-4" onClick={() => window.location.reload()}>{t("Opnieuw laden")}</Button>
        </div>
      );
    }
    return <Suspense fallback={this.props.fallback ?? null}>{this.props.children}</Suspense>;
  }
}

/**
 * A sheet that loads on demand: mounted the first time it opens and kept after that, so it
 * still slides away when closed. If it can't load, a toast says so and it closes again, so
 * the button keeps working.
 */
export const LazySheet = ({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) => {
  const [state, setState] = useState<'waiting' | 'mounted' | 'failed'>(open ? 'mounted' : 'waiting');
  if (open && state === 'waiting') setState('mounted');
  if (!open && state === 'failed') setState('waiting');
  if (state !== 'mounted') return null;
  return (
    <LazyBoundary
      onError={() => {
        toast.error(t("Dit kon niet openen. Controleer je verbinding en probeer het opnieuw."));
        setState('failed');
        onClose();
      }}
    >
      {children}
    </LazyBoundary>
  );
};
