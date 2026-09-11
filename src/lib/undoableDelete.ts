import { toast } from 'sonner';

const UNDO_MS = 5000;

// Deletes still waiting out their undo window. They run when the page is hidden
// or closed, so a delete is not lost when you leave within those 5 seconds.
const pending = new Set<() => void>();

const flushPending = () => {
  for (const commit of [...pending]) commit();
};

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushPending);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPending();
  });
}

interface UndoableDelete {
  message: string;
  remove: () => void;
  restore: () => void;
  commit: () => Promise<void>;
}

/**
 * Takes something off the screen right away and only deletes it from the
 * database once the "Ongedaan maken" toast has expired.
 */
export function deleteWithUndo({ message, remove, restore, commit }: UndoableDelete) {
  let settled = false;

  const runCommit = () => {
    if (settled) return;
    settled = true;
    pending.delete(runCommit);
    clearTimeout(timer);
    commit().catch((error) => {
      console.error('Delete failed:', error);
      restore();
      toast.error('Verwijderen lukte niet. Probeer het opnieuw.');
    });
  };

  remove();
  // runCommit is only ever called after this line, so reading timer inside it is safe.
  const timer = setTimeout(runCommit, UNDO_MS);
  pending.add(runCommit);

  toast(message, {
    duration: UNDO_MS,
    action: {
      label: 'Ongedaan maken',
      onClick: () => {
        if (settled) return;
        settled = true;
        pending.delete(runCommit);
        clearTimeout(timer);
        restore();
      },
    },
  });
}
