'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Header } from '../components/layout/Header';
import { Navbar } from '../components/layout/Navbar';
import { POSModule } from '../components/pos/POSModule';
import { InventoryModule } from '../components/inventory/InventoryModule';
import { ClientsModule } from '../components/clients/ClientsModule';
import { DebtsModule } from '../components/debts/DebtsModule';
import { ExpensesModule } from '../components/expenses/ExpensesModule';
import { FinancialDashboard } from '../components/dashboard/FinancialDashboard';
import { DollarHistoryModule } from '../components/dolar/DollarHistoryModule';
import { Product, Client, Sale, Debt, Expense, ExchangeRate, NavigationTab } from '../lib/types';
import { seedInitialDataIfEmpty, getAllFromStore, getDB } from '../lib/db/indexeddb';
import { fetchCurrentBCVRate } from '../lib/bimonetary/exchangeRate';
import { processSyncQueue } from '../lib/sync/syncEngine';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<NavigationTab>('pos');
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [bcvRate, setBcvRate] = useState<ExchangeRate | null>(null);
  const [syncQueueCount, setSyncQueueCount] = useState<number>(0);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // App Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isInitialLoaded, setIsInitialLoaded] = useState<boolean>(false);

  // Theme Auto-Detection & Toggle Logic
  useEffect(() => {
    const savedTheme = localStorage.getItem('seleshop_theme') as 'dark' | 'light' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.className = savedTheme;
    } else {
      // Auto-detect system preference (prefers-color-scheme)
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const initialTheme = prefersDark ? 'dark' : 'light';
      setTheme(initialTheme);
      document.documentElement.className = initialTheme;
    }
  }, []);

  const handleToggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('seleshop_theme', newTheme);
    document.documentElement.className = newTheme;
  };

  // Load all local data from IndexedDB
  const loadDataFromIndexedDB = useCallback(async () => {
    try {
      await seedInitialDataIfEmpty();
      const p = await getAllFromStore<Product>('products');
      const c = await getAllFromStore<Client>('clients');
      const s = await getAllFromStore<Sale>('sales');
      const d = await getAllFromStore<Debt>('debts');
      const e = await getAllFromStore<Expense>('expenses');

      setProducts(p);
      setClients(c);
      setSales(s);
      setDebts(d);
      setExpenses(e);

      // Check sync queue count
      const db = await getDB();
      const queue = await db.getAll('syncQueue');
      setSyncQueueCount(queue.length);

      setIsInitialLoaded(true);
    } catch (err) {
      console.error('Error loading data from IndexedDB:', err);
    }
  }, []);

  // Fetch BCV Rate
  const updateBCVRate = useCallback(async () => {
    const rateObj = await fetchCurrentBCVRate();
    setBcvRate(rateObj);
  }, []);

  // Initial Startup Effects
  useEffect(() => {
    // 1. Service Worker Registration for PWA
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('Service Worker registrado con éxito:', reg.scope))
        .catch((err) => console.warn('Error registrando Service Worker:', err));
    }

    // 2. Online / Offline Listener
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 3. Load DB & Rates
    loadDataFromIndexedDB();
    updateBCVRate();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadDataFromIndexedDB, updateBCVRate]);

  // Attempt Sync when Online status is active
  const handleForceSync = async () => {
    const res = await processSyncQueue();
    await loadDataFromIndexedDB();
    if (res.processed > 0) {
      alert(`¡Sincronización completada! ${res.processed} cambios guardados en Supabase.`);
    }
  };

  if (!isInitialLoaded) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-4" style={{ backgroundColor: '#181614' }}>
        <div className="w-14 h-14 rounded-2xl bg-amber-800 border-2 border-[#D4AF37] flex items-center justify-center font-bold text-stone-100 text-2xl shadow-xl">
          S
        </div>
        <p className="text-stone-400 font-bold text-base">Cargando SeleShop...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-stone-100 flex flex-col selection:bg-amber-800 selection:text-stone-100" style={{ backgroundColor: 'var(--bg-main)' }}>
      {/* Top Header */}
      <Header
        isOnline={isOnline}
        onToggleOnline={() => setIsOnline(!isOnline)}
        bcvRate={bcvRate}
        onRateUpdate={(updated) => setBcvRate(updated)}
        syncQueueCount={syncQueueCount}
        onForceSync={handleForceSync}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onOpenDolarHistory={() => setActiveTab('dolar')}
      />

      {/* Main View Router */}
      <main className="flex-1">
        {activeTab === 'pos' && (
          <POSModule
            products={products}
            clients={clients}
            bcvRate={bcvRate}
            onSaleComplete={loadDataFromIndexedDB}
            onAddClient={(newClient) => setClients([...clients, newClient])}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryModule
            products={products}
            bcvRate={bcvRate}
            onRefreshProducts={loadDataFromIndexedDB}
          />
        )}

        {activeTab === 'clients' && (
          <ClientsModule
            clients={clients}
            debts={debts}
            sales={sales}
            bcvRate={bcvRate}
            onRefreshClients={loadDataFromIndexedDB}
          />
        )}

        {activeTab === 'debts' && (
          <DebtsModule
            debts={debts}
            clients={clients}
            bcvRate={bcvRate}
            onRefreshDebts={loadDataFromIndexedDB}
          />
        )}

        {activeTab === 'expenses' && (
          <ExpensesModule
            expenses={expenses}
            bcvRate={bcvRate}
            onRefreshExpenses={loadDataFromIndexedDB}
          />
        )}

        {activeTab === 'dashboard' && (
          <FinancialDashboard
            sales={sales}
            expenses={expenses}
            debts={debts}
            bcvRate={bcvRate}
            onResetData={loadDataFromIndexedDB}
          />
        )}

        {activeTab === 'dolar' && (
          <DollarHistoryModule currentRate={bcvRate} />
        )}
      </main>

      {/* Fixed Ergometric Bottom Navbar */}
      <Navbar
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        cartCount={0}
      />
    </div>
  );
}
