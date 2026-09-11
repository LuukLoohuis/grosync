import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type GroceryInsert = Database['public']['Tables']['grocery_items']['Insert'];
type GroceryUpdate = Database['public']['Tables']['grocery_items']['Update'];

export type GroceryChange =
  | { kind: 'insert'; rows: GroceryInsert[] }
  | { kind: 'update'; ids: string[]; patch: GroceryUpdate }
  | { kind: 'delete'; ids: string[] };

// Changes made without signal, in the order they were made. Stored so they survive closing the app.
const QUEUE_KEY = 'couplecart-offline-changes';

const readQueue = (): GroceryChange[] => {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') as GroceryChange[];
  } catch {
    return [];
  }
};

const writeQueue = (changes: GroceryChange[]) => {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(changes));
  } catch {
    // Storage full or blocked; nothing more we can keep.
  }
};

export const pendingGroceryChanges = readQueue;

// Without a connection fetch rejects, and Supabase turns that into an error without a status code.
const isNetworkError = (error: { message?: string } | null) =>
  Boolean(error) && /fetch|network|load failed/i.test(error?.message ?? '');

function send(change: GroceryChange) {
  const table = supabase.from('grocery_items');
  // Inserts ignore an existing id, so a retry after a lost response does no harm.
  if (change.kind === 'insert') return table.upsert(change.rows, { onConflict: 'id', ignoreDuplicates: true });
  if (change.kind === 'update') return table.update(change.patch).in('id', change.ids);
  return table.delete().in('id', change.ids);
}

let flushing: Promise<void> | null = null;

/** Sends the kept changes in order and stops at the first one that still cannot reach the server. */
export function flushGroceryChanges(): Promise<void> {
  flushing ??= (async () => {
    try {
      for (let next = readQueue()[0]; next; next = readQueue()[0]) {
        const { error } = await send(next);
        if (error && isNetworkError(error)) return;
        if (error) console.error('The server refused a kept change; dropping it:', error, next);
        // Re-read: new changes may have been added while this one was on its way.
        writeQueue(readQueue().slice(1));
      }
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}

/**
 * Sends a change now, or keeps it until there is a connection again. Returns false only
 * when the server refused it. While older changes are waiting, new ones queue behind
 * them, so a check-off never overtakes the add it belongs to.
 */
export async function saveGroceryChange(change: GroceryChange): Promise<boolean> {
  if (!navigator.onLine || readQueue().length > 0) {
    writeQueue([...readQueue(), change]);
    if (navigator.onLine) void flushGroceryChanges();
    return true;
  }
  const { error } = await send(change);
  if (!error) return true;
  if (isNetworkError(error)) {
    writeQueue([...readQueue(), change]);
    return true;
  }
  console.error('Saving change failed:', error);
  return false;
}
