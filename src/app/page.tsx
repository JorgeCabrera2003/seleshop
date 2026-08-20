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
import { AuthModule } from '../components/auth/AuthModule';
import { UserManagerModal } from '../components/auth/UserManagerModal';
import { ProfileSettingsModal } from '../components/auth/ProfileSettingsModal';
import { CloudSyncModal } from '../components/sync/CloudSyncModal';
import { Product, Client, Sale, Debt, Expense, ExchangeRate, NavigationTab, User, AuthSession } from '../lib/types';
import { seedInitialDataIfEmpty, getAllFromStore, getDB, getActiveSession, clearActiveSession } from '../lib/db/indexeddb';
import { fetchCurrentBCVRate } from '../lib/bimonetary/exchangeRate';
import { processSyncQueue, pullAllFromSupabase, subscribeToSupabaseRealtime } from '../lib/sync/syncEngine';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<NavigationTab>('pos');
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [bcvRate, setBcvRate] = useState<ExchangeRate | null>(null);
  const [syncQueueCount, setSyncQueueCount] = useState<number>(0);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Auth & Multi-User State
  const [users, setUsers] = useState<User[]>([]);
  const [currentSession, setCurrentSession] = useState<AuthSession | null>(null);
  const [showUserManager, setShowUserManager] = useState(false);
  const [showCloudSync, setShowCloudSync] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);

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
      const u = await getAllFromStore<User>('users');

      setProducts(p);
      setClients(c);
      setSales(s);
      setDebts(d);
      setExpenses(e);
      setUsers(u);

      // Check active auth session
      const sess = getActiveSession();
      if (sess && u.some((user) => user.id === sess.user.id && user.is_active)) {
        setCurrentSession(sess);
      } else {
        setCurrentSession(null);
      }

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

  // Initial Startup Effects & Realtime Multi-Device Sync
  useEffect(() => {
    // 1. Service Worker Registration for PWA
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('Service Worker registrado con éxito:', reg.scope))
        .catch((err) => console.warn('Error registrando Service Worker:', err));
    }

    // 2. Online / Offline Listener & Visibility Listener
    setIsOnline(navigator.onLine);
    const handleOnline = () => {
      setIsOnline(true);
      processSyncQueue().then(() => pullAllFromSupabase()).then(() => loadDataFromIndexedDB());
    };
    const handleOffline = () => setIsOnline(false);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        processSyncQueue().then(() => pullAllFromSupabase()).then(() => loadDataFromIndexedDB());
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 3. Load DB & Rates
    loadDataFromIndexedDB();
    updateBCVRate();

    // 4. Multi-device Realtime Subscription via Supabase
    const unsubscribeRealtime = subscribeToSupabaseRealtime((table, event) => {
      console.log(`[Realtime Sync] Cambio detectado en ${table} (${event})`);
      loadDataFromIndexedDB();
    });

    // 5. Initial Pull if online
    if (navigator.onLine) {
      pullAllFromSupabase().then((res) => {
        if (res.count > 0) loadDataFromIndexedDB();
      });
    }

    // 6. Background Heartbeat Auto-Sync Interval (runs silently every 5 seconds)
    const syncInterval = setInterval(() => {
      if (navigator.onLine) {
        processSyncQueue().then((res) => {
          if (res.processed > 0) {
            loadDataFromIndexedDB();
          }
        }).catch(() => {});
      }
    }, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(syncInterval);
      unsubscribeRealtime();
    };
  }, [loadDataFromIndexedDB, updateBCVRate]);

  // Attempt Sync when Online status is active
  const handleForceSync = async () => {
    const res = await processSyncQueue();
    await pullAllFromSupabase();
    await loadDataFromIndexedDB();
    if (res.processed > 0) {
      alert(`¡Sincronización completada! ${res.processed} cambios guardados en Supabase.`);
    }
  };

  const handleLogout = () => {
    clearActiveSession();
    setCurrentSession(null);
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

  // ── AUTH GATEWAY: If not logged in, show AuthModule ───────
  if (!currentSession) {
    return (
      <AuthModule
        users={users}
        onLoginSuccess={(session) => {
          setCurrentSession(session);
          loadDataFromIndexedDB();
        }}
        onRefreshUsers={loadDataFromIndexedDB}
      />
    );
  }

  const currentUser = currentSession.user;
  const isCashier = currentUser.role === 'CASHIER';

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
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenUserManager={() => setShowUserManager(true)}
        onOpenCloudSync={() => setShowCloudSync(true)}
        onOpenProfileSettings={() => setShowProfileSettings(true)}
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

        {activeTab === 'dashboard' && !isCashier && (
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

      {/* Fixed Ergometric Bottom Navbar with Role Filter */}
      <Navbar
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        cartCount={0}
        currentUser={currentUser}
      />

      {/* User Manager Modal (Admin Only) */}
      {showUserManager && (
        <UserManagerModal
          users={users}
          currentUserId={currentUser.id}
          isOpen={showUserManager}
          onClose={() => setShowUserManager(false)}
          onRefreshUsers={loadDataFromIndexedDB}
        />
      )}

      {/* Cloud Sync Multidispositivo Modal */}
      {showCloudSync && (
        <CloudSyncModal
          isOpen={showCloudSync}
          onClose={() => setShowCloudSync(false)}
          syncQueueCount={syncQueueCount}
          onSyncCompleted={loadDataFromIndexedDB}
        />
      )}

      {/* Profile & Security Settings Modal (Change PIN / Password) */}
      {showProfileSettings && (
        <ProfileSettingsModal
          currentUser={currentUser}
          isOpen={showProfileSettings}
          onClose={() => setShowProfileSettings(false)}
          onProfileUpdated={(updated) => {
            setCurrentSession({ user: updated, logged_at: new Date().toISOString() });
            loadDataFromIndexedDB();
          }}
        />
      )}

    </div>
  );
}
