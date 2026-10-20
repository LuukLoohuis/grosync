import { lazy, useState, type ComponentType, type ElementType } from 'react';

type Module<P> = { default: ComponentType<P> };

/**
 * React.lazy for a part of the app in its own chunk, with a preload() to fetch that chunk
 * before the part is shown (see preloadWhenIdle). Once the chunk is in, a new mount renders
 * the part straight away instead of suspending for a tick, so a tab never flashes its
 * loading state. Render it inside a LazyBoundary.
 */
export const lazyPart = <P extends object>(load: () => Promise<Module<P>>) => {
  let loaded: ComponentType<P> | undefined;
  let pending: Promise<Module<P>> | undefined;
  const preload = () => {
    pending ??= load().then(
      (module) => {
        loaded = module.default;
        return module;
      },
      (error) => {
        // No signal, or a new version replaced the chunk. A later preload may still get it
        // (then new mounts use `loaded`); the lazy below stays failed, so the LazyBoundary
        // shows it rather than React retrying forever.
        pending = undefined;
        throw error;
      },
    );
    return pending;
  };
  const Lazy = lazy(preload);

  const Part = (props: P) => {
    // Picked once per mount, so React never sees the component type change underneath it.
    const [Component] = useState<ElementType>(() => loaded ?? Lazy);
    return <Component {...props} />;
  };
  return Object.assign(Part, { preload });
};

/**
 * Fetches parts one after the other once the browser has a quiet moment, after the first
 * screen is up. They then open without waiting, and the service worker keeps their chunks
 * for the store, where there often is no signal. Returns the cleanup for useEffect.
 */
export const preloadWhenIdle = (parts: { preload: () => Promise<unknown> }[]) => {
  const run = async () => {
    for (const part of parts) await part.preload().catch(() => undefined);
  };
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(() => void run(), { timeout: 3000 });
    return () => window.cancelIdleCallback(id);
  }
  // Safari has no requestIdleCallback.
  const id = window.setTimeout(() => void run(), 1500);
  return () => window.clearTimeout(id);
};
