import { getDB, deleteFromStore, putToStore } from '../db/indexeddb';
import { getSupabaseClient } from '../supabase/client';
import { SyncQueueItem, Product, Client, Sale, Debt, Expense, User } from '../types';

let isProcessingSync = false;

export async function processSyncQueue(): Promise<{ processed: number; errors: number }> {
  if (isProcessingSync) return { processed: 0, errors: 0 };

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { processed: 0, errors: 0 };
  }

  isProcessingSync = true;
  try {
    const db = await getDB();
    const queue: SyncQueueItem[] = await db.getAll('syncQueue');

    if (queue.length === 0) {
      isProcessingSync = false;
      return { processed: 0, errors: 0 };
    }

  let processedCount = 0;
  let errorCount = 0;

  queue.sort((a, b) => a.timestamp - b.timestamp);

  for (const item of queue) {
    try {
      const { table_name, action, data } = item;

      if (action === 'INSERT') {
        const { error } = await supabase.from(table_name).upsert(data);
        if (error) throw error;
      } else if (action === 'UPDATE') {
        const { error } = await supabase.from(table_name).update(data).eq('id', data.id);
        if (error) throw error;
      } else if (action === 'DELETE') {
        const { error } = await supabase.from(table_name).delete().eq('id', data.id);
        if (error) throw error;
      }

      await deleteFromStore('syncQueue', item.id);
      processedCount++;
    } catch (err) {
      console.error(`Error sincronizando item ${item.id} (${item.table_name}):`, err);
      errorCount++;
      item.retries = (item.retries || 0) + 1;
      await db.put('syncQueue', item);
    }
  }

  return { processed: processedCount, errors: errorCount };
  } finally {
    isProcessingSync = false;
  }
}

/**
 * Descarga todos los registros de Supabase a IndexedDB para sincronización inicial o periódica
 */
export async function pullAllFromSupabase(): Promise<{ success: boolean; count: number }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, count: 0 };

  try {
    let totalCount = 0;

    // 1. Productos
    const { data: prods } = await supabase.from('products').select('*');
    if (prods && prods.length > 0) {
      for (const p of prods) await putToStore('products', p);
      totalCount += prods.length;
    }

    // 2. Clientes
    const { data: clients } = await supabase.from('clients').select('*');
    if (clients && clients.length > 0) {
      for (const c of clients) await putToStore('clients', c);
      totalCount += clients.length;
    }

    // 3. Ventas
    const { data: sales } = await supabase.from('sales').select('*');
    if (sales && sales.length > 0) {
      for (const s of sales) await putToStore('sales', s);
      totalCount += sales.length;
    }

    // 4. Deudas / Fiados
    const { data: debts } = await supabase.from('debts').select('*');
    if (debts && debts.length > 0) {
      for (const d of debts) await putToStore('debts', d);
      totalCount += debts.length;
    }

    // 5. Gastos
    const { data: expenses } = await supabase.from('expenses').select('*');
    if (expenses && expenses.length > 0) {
      for (const e of expenses) await putToStore('expenses', e);
      totalCount += expenses.length;
    }

    // 6. Usuarios
    const { data: users } = await supabase.from('users').select('*');
    if (users && users.length > 0) {
      for (const u of users) await putToStore('users', u);
      totalCount += users.length;
    }

    return { success: true, count: totalCount };
  } catch (err) {
    console.error('Error al descargar datos desde Supabase:', err);
    return { success: false, count: 0 };
  }
}

/**
 * Suscripción en tiempo real con Supabase Realtime (canal multi-dispositivo)
 */
export function subscribeToSupabaseRealtime(onDataChanged: (table: string, eventType: string) => void) {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  const channel = supabase
    .channel('seleshop-multi-device-sync')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public' },
      async (payload) => {
        const { table, eventType, new: newRecord, old: oldRecord } = payload;
        
        try {
          if (eventType === 'INSERT' || eventType === 'UPDATE') {
            await putToStore(table as any, newRecord);
          } else if (eventType === 'DELETE' && oldRecord && oldRecord.id) {
            await deleteFromStore(table as any, oldRecord.id);
          }
          onDataChanged(table, eventType);
        } catch (err) {
          console.error(`Error procesando cambio en tiempo real (${table}):`, err);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
