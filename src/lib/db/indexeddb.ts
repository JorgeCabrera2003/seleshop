import { openDB, IDBPDatabase } from 'idb';
import { Product, Client, Sale, Debt, Expense, ExchangeRate, HistoricalRate, SyncQueueItem, User, AuthSession } from '../types';

const DB_NAME = 'seleshop-db';
const DB_VERSION = 3;

export async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('products')) {
        db.createObjectStore('products', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('clients')) {
        db.createObjectStore('clients', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('sales')) {
        db.createObjectStore('sales', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('sale_items')) {
        db.createObjectStore('sale_items', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('debts')) {
        db.createObjectStore('debts', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('expenses')) {
        db.createObjectStore('expenses', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('exchange_rates')) {
        db.createObjectStore('exchange_rates', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('historical_rates')) {
        db.createObjectStore('historical_rates', { keyPath: 'date' });
      }
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('users')) {
        db.createObjectStore('users', { keyPath: 'id' });
      }
    },
  });
}

// Session Management Helpers in LocalStorage
const SESSION_KEY = 'seleshop_active_session';

export function getActiveSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function setActiveSession(session: AuthSession) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearActiveSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_KEY);
}

// Production Database Initializer (Clean & ready for real use)
export async function seedInitialDataIfEmpty(forceReseed = false) {
  const db = await getDB();

  if (forceReseed) {
    await db.clear('products');
    await db.clear('clients');
    await db.clear('sales');
    await db.clear('sale_items');
    await db.clear('debts');
    await db.clear('expenses');
    await db.clear('syncQueue');
  }

  // Ensure an exchange rate record exists
  const rateCount = await db.count('exchange_rates');
  if (rateCount === 0) {
    const initialRate: ExchangeRate = {
      id: 'rate-1',
      rate_ves: 36.50,
      source_api: 'BCV Oficial (DolarApi.com)',
      fetched_at: new Date().toISOString(),
    };
    await db.put('exchange_rates', initialRate);
  }

  // Seed sample historical rates for offline backup if historical_rates is empty
  const histCount = await db.count('historical_rates');
  if (histCount === 0) {
    const today = new Date();
    const sampleHistory: HistoricalRate[] = [];

    // Generate 30 days of past sample rates simulating BCV & Paralelo progression
    let baseBCV = 36.50;
    let baseParalelo = 41.20;

    for (let i = 30; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];

      // Slight progression to simulate realistic historical movement
      const factor = 1 - i * 0.0035;
      const rate_bcv = Number((baseBCV * factor).toFixed(2));
      const rate_paralelo = Number((baseParalelo * factor).toFixed(2));

      sampleHistory.push({
        date: dateStr,
        rate_bcv,
        rate_paralelo,
        source: 'BCV / DolarApi.com',
        fetched_at: new Date().toISOString(),
      });
    }

    const txH = db.transaction('historical_rates', 'readwrite');
    for (const h of sampleHistory) {
      await txH.store.put(h);
    }
    await txH.done;
  }

  // Seed default 2 users if empty: Jorge Cabrera (SUPERADMIN) & Sele (ADMIN)
  const userCount = await db.count('users');
  if (userCount === 0) {
    const defaultSuperAdmin: User = {
      id: 'usr-superadmin-jorge',
      name: 'Jorge Cabrera',
      email: 'jorge@seleshop.com',
      password: 'admin123',
      username: 'jorge',
      role: 'SUPERADMIN',
      pin: '1234',
      is_active: true,
      created_at: new Date().toISOString(),
    };

    const defaultAdminSele: User = {
      id: 'usr-admin-sele',
      name: 'Sele',
      email: 'sele@seleshop.com',
      password: 'sele123',
      username: 'sele',
      role: 'ADMIN',
      pin: '1234',
      is_active: true,
      created_at: new Date().toISOString(),
    };

    await db.put('users', defaultSuperAdmin);
    await db.put('users', defaultAdminSele);
  }
}

// Calculate 15th or 30th payment date rule
export function getNextPaymentDate(): string {
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  let targetDate: Date;
  if (currentDay < 15) {
    targetDate = new Date(currentYear, currentMonth, 15);
  } else if (currentDay < 30) {
    targetDate = new Date(currentYear, currentMonth, 30);
  } else {
    targetDate = new Date(currentYear, currentMonth + 1, 15);
  }

  return targetDate.toISOString().split('T')[0];
}

// Helper methods for IndexedDB
export async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await getDB();
  return db.getAll(storeName);
}

export async function putToStore<T>(storeName: string, item: T): Promise<void> {
  const db = await getDB();
  await db.put(storeName, item);
}

export async function deleteFromStore(storeName: string, id: string): Promise<void> {
  const db = await getDB();
  await db.delete(storeName, id);
}

export async function getHistoricalRateFromDB(dateStr: string): Promise<HistoricalRate | null> {
  const db = await getDB();
  const found = await db.get('historical_rates', dateStr);
  return found || null;
}

export async function saveHistoricalRatesToDB(rates: HistoricalRate[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('historical_rates', 'readwrite');
  for (const r of rates) {
    await tx.store.put(r);
  }
  await tx.done;
}

export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retries'>) {
  const db = await getDB();
  const syncItem: SyncQueueItem = {
    ...item,
    id: 'sync-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    timestamp: Date.now(),
    retries: 0,
  };
  await db.put('syncQueue', syncItem);

  // Auto-sincronización instantánea si hay conexión a internet
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    import('../sync/syncEngine').then(({ processSyncQueue }) => {
      processSyncQueue().catch((err) => console.warn('[AutoSync] Error:', err));
    });
  }
}

export async function clearAllLocalData() {
  const db = await getDB();
  const stores = ['products', 'clients', 'sales', 'sale_items', 'debts', 'expenses', 'exchange_rates', 'historical_rates', 'syncQueue', 'users'];
  for (const s of stores) {
    await db.clear(s);
  }
  clearActiveSession();
  await seedInitialDataIfEmpty(true);
}

