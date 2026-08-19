import { openDB, IDBPDatabase } from 'idb';
import { Product, Client, Sale, Debt, Expense, ExchangeRate, HistoricalRate, SyncQueueItem } from '../types';

const DB_NAME = 'seleshop-db';
const DB_VERSION = 2;

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
    },
  });
}

// Initial seed data focused on Venezuelan Snacks, Sweets & Chucherías
export async function seedInitialDataIfEmpty(forceReseed = false) {
  const db = await getDB();
  const productCount = await db.count('products');

  if (productCount === 0 || forceReseed) {
    if (forceReseed) {
      await db.clear('products');
      await db.clear('clients');
      await db.clear('debts');
      await db.clear('expenses');
      await db.clear('historical_rates');
    }

    const initialSnacks: Product[] = [
      { id: 'p1', name: 'Pepito 80g', category: 'Chucherías', price_usd: 0.85, stock_quantity: 50, is_active: true },
      { id: 'p2', name: 'Doritos Queso 150g', category: 'Chucherías', price_usd: 1.80, stock_quantity: 35, is_active: true },
      { id: 'p3', name: 'Cheese Tris 120g', category: 'Chucherías', price_usd: 1.10, stock_quantity: 30, is_active: true },
      { id: 'p4', name: 'Platanitos Natuchips 100g', category: 'Chucherías', price_usd: 1.20, stock_quantity: 25, is_active: true },
      { id: 'p5', name: 'Chupeta Bon Bon Bum (Unidad)', category: 'Dulces', price_usd: 0.25, stock_quantity: 60, is_active: true },
      { id: 'p6', name: 'Gomitas Trululu 90g', category: 'Dulces', price_usd: 0.95, stock_quantity: 40, is_active: true },
      { id: 'p7', name: 'Chocolate Savoy Leche 130g', category: 'Chocolates', price_usd: 2.50, stock_quantity: 15, is_active: true },
      { id: 'p8', name: 'Pirulin 300g (Lata)', category: 'Chocolates', price_usd: 5.20, stock_quantity: 8, is_active: true },
      { id: 'p9', name: 'Samba Fresa Savoy', category: 'Chocolates', price_usd: 0.75, stock_quantity: 30, is_active: true },
      { id: 'p10', name: 'Galleta Susy 50g', category: 'Galletas', price_usd: 0.90, stock_quantity: 40, is_active: true },
      { id: 'p11', name: 'Galleta Cocosette 50g', category: 'Galletas', price_usd: 0.90, stock_quantity: 40, is_active: true },
      { id: 'p12', name: 'Pingüinos Marinela 2u', category: 'Galletas', price_usd: 1.25, stock_quantity: 20, is_active: true },
      { id: 'p13', name: 'Perro Caliente Especial', category: 'Comida Chatarra', price_usd: 2.50, stock_quantity: 15, is_active: true },
      { id: 'p14', name: 'Hamburguesa Sencilla con Papas', category: 'Comida Chatarra', price_usd: 4.00, stock_quantity: 10, is_active: true },
      { id: 'p15', name: 'Refresco Frescolita 1.5L', category: 'Bebidas', price_usd: 1.75, stock_quantity: 20, is_active: true },
      { id: 'p16', name: 'Malta Polar 250ml', category: 'Bebidas', price_usd: 0.80, stock_quantity: 25, is_active: true },
      { id: 'p17', name: 'Encendedor Bic', category: 'Otros', price_usd: 0.70, stock_quantity: 30, is_active: true },
      { id: 'p18', name: 'Cigarrillos Consul (Cajetilla)', category: 'Otros', price_usd: 2.20, stock_quantity: 12, is_active: true },
    ];

    const txP = db.transaction('products', 'readwrite');
    for (const prod of initialSnacks) {
      await txP.store.put(prod);
    }
    await txP.done;

    const initialClients: Client[] = [
      { id: 'c1', full_name: 'María Rodríguez', whatsapp_number: '+584141234567', created_at: new Date().toISOString(), notes: 'Le gustan los chocolates Savoy' },
      { id: 'c2', full_name: 'Carlos Mendoza', whatsapp_number: '+584129876543', created_at: new Date().toISOString(), notes: 'Paga los días 15' },
      { id: 'c3', full_name: 'Sra. Carmen Benítez', whatsapp_number: '+584245558899', created_at: new Date().toISOString(), notes: 'Vecina del 3er piso' },
    ];

    const txC = db.transaction('clients', 'readwrite');
    for (const cli of initialClients) {
      await txC.store.put(cli);
    }
    await txC.done;

    const initialRate: ExchangeRate = {
      id: 'rate-1',
      rate_ves: 36.50,
      source_api: 'BCV Oficial (DolarApi.com)',
      fetched_at: new Date().toISOString(),
    };
    await db.put('exchange_rates', initialRate);

    // Initial sample debt for snacks
    const initialDebt: Debt = {
      id: 'd1',
      client_id: 'c1',
      client_name: 'María Rodríguez',
      whatsapp_number: '+584141234567',
      sale_id: 'sale-demo-1',
      amount_usd: 4.40,
      due_date: getNextPaymentDate(),
      status: 'PENDING',
      notes: 'Fiado de Pepito, Susy, Cocosette y Frescolita',
      created_at: new Date().toISOString(),
    };
    await db.put('debts', initialDebt);

    // Initial expense for demo (compra de caja de chucherías)
    const initialExpense: Expense = {
      id: 'exp-1',
      description: 'Compra de 2 cajas de Pepito y Doritos al mayorista',
      amount_usd: 28.00,
      category: 'MERCANCIA',
      expense_date: new Date().toISOString().split('T')[0],
    };
    await db.put('expenses', initialExpense);
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
}

export async function clearAllLocalData() {
  const db = await getDB();
  const stores = ['products', 'clients', 'sales', 'sale_items', 'debts', 'expenses', 'exchange_rates', 'historical_rates', 'syncQueue'];
  for (const s of stores) {
    await db.clear(s);
  }
  await seedInitialDataIfEmpty(true);
}

