'use client';

import React from 'react';
import { ShoppingCart, Package, Users, CreditCard, LayoutDashboard, Receipt, History } from 'lucide-react';
import { NavigationTab, User as UserType } from '../../lib/types';

interface NavbarProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  cartCount: number;
  currentUser?: UserType | null;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onTabChange, cartCount, currentUser }) => {
  const isCashier = currentUser?.role === 'CASHIER';

  // Orden ergonómico optimizado para móvil:
  // Vender -> Inventario -> Clientes -> Deudas -> Gastos -> Dashboard -> Tasas
  const navItems: { id: NavigationTab; label: string; icon: React.ComponentType<{ className?: string }>; adminOnly?: boolean }[] = [
    { id: 'pos',       label: 'Vender',     icon: ShoppingCart },
    { id: 'inventory', label: 'Inventario', icon: Package },
    { id: 'clients',   label: 'Clientes',   icon: Users },
    { id: 'debts',     label: 'Deudas',     icon: CreditCard },
    { id: 'expenses',  label: 'Gastos',     icon: Receipt }, // Visible en teléfono siempre
    { id: 'dashboard', label: 'Dashboard',  icon: LayoutDashboard, adminOnly: true },
    { id: 'dolar',     label: 'Tasas $',    icon: History },
  ];

  const visibleNavItems = navItems.filter((item) => !isCashier || !item.adminOnly);

  return (
    /* Navbar fija inferior con soporte de scroll horizontal suave en teléfonos pequeños */
    <nav className="fixed bottom-0 left-0 right-0 z-40 glass-panel border-t border-stone-800/90 shadow-2xl pb-safe">
      <div className="max-w-4xl mx-auto flex items-center overflow-x-auto no-scrollbar px-2 py-1.5 gap-1 sm:justify-around">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              /* touch-target-lg garantiza 56px mínimo de altura y mínimo 52px de ancho en móvil */
              className={`relative flex flex-col items-center justify-center py-2 px-2.5 sm:px-3 rounded-2xl transition-all duration-200 touch-target-lg flex-1 min-w-[54px] sm:min-w-0 shrink-0 ${
                isActive
                  ? 'bg-amber-800/95 text-stone-100 shadow-md border border-[#D4AF37]/60 scale-105'
                  : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/40'
              }`}
            >
              <Icon className={`w-5 h-5 mb-0.5 shrink-0 ${isActive ? 'text-amber-200' : 'text-stone-400'}`} />
              <span className={`text-[10px] sm:text-[11px] tracking-tight font-bold leading-none truncate w-full text-center ${isActive ? 'text-stone-100' : ''}`}>
                {item.label}
              </span>

              {/* Burbuja de carrito */}
              {item.id === 'pos' && cartCount > 0 && (
                <span className="absolute -top-1 right-1.5 bg-amber-400 text-stone-950 font-black text-[10px] rounded-full w-4 h-4 flex items-center justify-center shadow-md border border-stone-900">
                  {cartCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
