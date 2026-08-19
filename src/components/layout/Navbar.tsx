'use client';

import React, { useState } from 'react';
import { ShoppingCart, Package, Users, CreditCard, LayoutDashboard, Receipt, History } from 'lucide-react';
import { NavigationTab } from '../../lib/types';

interface NavbarProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  cartCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onTabChange, cartCount }) => {
  const navItems: { id: NavigationTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'pos',       label: 'Vender',    icon: ShoppingCart },
    { id: 'inventory', label: 'Inventario', icon: Package },
    { id: 'clients',   label: 'Clientes',  icon: Users },
    { id: 'debts',     label: 'Deudas',    icon: CreditCard },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'dolar',     label: 'Tasas $',   icon: History },
    { id: 'expenses',  label: 'Gastos',    icon: Receipt },
  ];

  return (
    /* Navbar fija en la parte inferior — safe-area para notch en iOS */
    <nav className="fixed bottom-0 left-0 right-0 z-40 glass-panel border-t border-stone-800/80 shadow-2xl pb-safe">
      <div className="max-w-3xl mx-auto flex items-center justify-around px-1 py-1.5 gap-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              /* touch-target-lg garantiza 56px mínimo */
              className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all duration-200 touch-target-lg flex-1 min-w-0 ${
                isActive
                  ? 'bg-amber-800/90 text-stone-100 shadow-md border border-[#D4AF37]/60 scale-105'
                  : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/40'
              }`}
            >
              <Icon className={`w-5 h-5 mb-0.5 shrink-0 ${isActive ? 'text-amber-200' : 'text-stone-400'}`} />
              {/* Etiqueta: visible desde sm hacia arriba; en pantallas XS se oculta */}
              <span className={`text-[10px] xs:text-[11px] tracking-tight font-bold leading-none truncate w-full text-center ${isActive ? 'text-stone-100' : ''}`}>
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
