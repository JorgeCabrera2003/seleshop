import { openDB, IDBPDatabase } from 'idb';
import { Product, Client, Sale, Debt, Expense, ExchangeRate, HistoricalRate, SyncQueueItem, User, AuthSession } from '../types';

const DB_NAME = 'seleshop-db';
const DB_VERSION = 4;

export async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const stores = ['products', 'clients', 'sales', 'sale_items', 'debts', 'expenses', 'exchange_rates', 'historical_rates', 'syncQueue', 'users'];
      for (const s of stores) {
        if (!db.objectStoreNames.contains(s)) {
          db.createObjectStore(s, { keyPath: s === 'historical_rates' ? 'date' : 'id' });
        }
      }
    },
  });
}

// Session Management Helpers in LocalStorage
const SESSION_KEY = 'seleshop_active_session';
const CLEAN_KEY = 'seleshop_db_cleaned_v4';

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

  // One-time automatic cache purge for all devices to guarantee clean state
  if (typeof window !== 'undefined' && !localStorage.getItem(CLEAN_KEY)) {
    forceReseed = true;
    localStorage.setItem(CLEAN_KEY, 'true');
  }

  if (forceReseed) {
    const stores = ['products', 'clients', 'sales', 'sale_items', 'debts', 'expenses', 'syncQueue'];
    for (const s of stores) {
      await db.clear(s);
    }
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

  // Seed default 2 users: Jorge Cabrera (SUPERADMIN) & Sele (ADMIN)
  const defaultSuperAdmin: User = {
    id: 'usr-superadmin-jorge',
    name: 'Jorge Cabrera',
    email: 'jorge@seleshop.com',
    password: 'Jorge#Seleshop2026!',
    username: 'jorge',
    role: 'SUPERADMIN',
    pin: '8492',
    is_active: true,
    created_at: new Date().toISOString(),
  };

  const defaultAdminSele: User = {
    id: 'usr-admin-sele',
    name: 'Sele',
    email: 'sele@seleshop.com',
    password: 'Sele*Tienda2026$',
    username: 'sele',
    role: 'ADMIN',
    pin: '7361',
    is_active: true,
    created_at: new Date().toISOString(),
  };

  await db.put('users', defaultSuperAdmin);
  await db.put('users', defaultAdminSele);
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

export async function saveHistoricalRatesToDB(rates: HistoricalRate[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('historical_rates', 'readwrite');
  for (const r of rates) {
    await tx.store.put(r);
  }
  await tx.done;
}

export async function getHistoricalRateFromDB(date: string): Promise<HistoricalRate | undefined> {
  const db = await getDB();
  return db.get('historical_rates', date);
}

export async function clearAllLocalData() {
  const db = await getDB();
  const stores = ['products', 'clients', 'sales', 'sale_items', 'debts', 'expenses', 'exchange_rates', 'historical_rates', 'syncQueue'];
  for (const s of stores) {
    await db.clear(s);
  }
  clearActiveSession();
  await seedInitialDataIfEmpty(true);
}
