import { getDB, deleteFromStore } from '../db/indexeddb';
import { supabase, isSupabaseConfigured } from '../supabase/client';
import { SyncQueueItem } from '../types';

export async function processSyncQueue(): Promise<{ processed: number; errors: number }> {
  if (!isSupabaseConfigured || !supabase) {
    // If Supabase credentials are not set up yet, keep queue items locally
    return { processed: 0, errors: 0 };
  }

  const db = await getDB();
  const queue: SyncQueueItem[] = await db.getAll('syncQueue');

  if (queue.length === 0) {
    return { processed: 0, errors: 0 };
  }

  let processedCount = 0;
  let errorCount = 0;

  // Sort by timestamp
  queue.sort((a, b) => a.timestamp - b.timestamp);

  for (const item of queue) {
    try {
      const { table_name, action, data } = item;

      if (action === 'INSERT') {
        const { error } = await supabase.from(table_name).insert(data);
        if (error) throw error;
      } else if (action === 'UPDATE') {
        const { error } = await supabase.from(table_name).update(data).eq('id', data.id);
        if (error) throw error;
      } else if (action === 'DELETE') {
        const { error } = await supabase.from(table_name).delete().eq('id', data.id);
        if (error) throw error;
      }

      // Remove from syncQueue on success
      await deleteFromStore('syncQueue', item.id);
      processedCount++;
    } catch (err) {
      console.error(`Error syncing item ${item.id} to Supabase:`, err);
      errorCount++;
      // Increment retries
      item.retries += 1;
      await db.put('syncQueue', item);
    }
  }

  return { processed: processedCount, errors: errorCount };
}
