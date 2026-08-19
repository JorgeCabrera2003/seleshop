'use client';

import React, { useState } from 'react';
import { Wifi, WifiOff, RefreshCw, DollarSign, Database, Edit2, Check, Sun, Moon, History, Settings, X } from 'lucide-react';
import { ExchangeRate } from '../../lib/types';
import { putToStore } from '../../lib/db/indexeddb';

interface HeaderProps {
  isOnline: boolean;
  onToggleOnline: () => void;
  bcvRate: ExchangeRate | null;
  onRateUpdate: (newRate: ExchangeRate) => void;
  syncQueueCount: number;
  onForceSync: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenDolarHistory?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isOnline,
  onToggleOnline,
  bcvRate,
  onRateUpdate,
  syncQueueCount,
  onForceSync,
  theme,
  onToggleTheme,
  onOpenDolarHistory,
}) => {
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [tempRate, setTempRate] = useState('');

  const handleSaveRate = async () => {
    const num = parseFloat(tempRate);
    if (!isNaN(num) && num > 0) {
      const updated: ExchangeRate = {
        id: 'rate-' + Date.now(),
        rate_ves: num,
        source_api: 'Manual (Ajustado por usuario)',
        fetched_at: new Date().toISOString(),
      };
      await putToStore('exchange_rates', updated);
      onRateUpdate(updated);
      setIsEditingRate(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 w-full glass-panel border-b border-stone-800/80 px-4 py-3 shadow-xl">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Clean Brand Logo & Title (Ultra Minimalist) */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-800 text-stone-100 flex items-center justify-center font-bold text-2xl shadow-md border-2 border-[#D4AF37] shrink-0">
            S
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-100 font-wabi">
            SeleShop
          </h1>
        </div>

        {/* Right: Clean Settings Icon Button */}
        <div className="relative flex items-center gap-2">
          <button
            onClick={() => setShowSettingsMenu(!showSettingsMenu)}
            title="Ajustes del Sistema (Tasa BCV, Tema, Sincronización, Red)"
            className={`p-2.5 rounded-2xl border-2 transition-all shadow-md flex items-center justify-center ${
              showSettingsMenu
                ? 'bg-amber-800 border-[#D4AF37] text-stone-100'
                : 'bg-stone-900 border-stone-700 text-stone-300 hover:bg-stone-800 hover:text-stone-100'
            }`}
          >
            <Settings className={`w-6 h-6 ${showSettingsMenu ? 'rotate-90 transition-transform duration-300' : ''}`} />
          </button>

          {/* Floating Settings & BCV Rate Popover Menu */}
          {showSettingsMenu && (
            <div className="absolute right-0 top-14 w-[calc(100vw-2rem)] sm:w-80 max-w-sm bg-stone-900 border-2 border-[#D4AF37] rounded-3xl p-4 shadow-2xl z-50 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between border-b border-stone-800 pb-2">
                <span className="text-sm font-bold text-stone-200 font-wabi">Menú & Configuración</span>
                <button
                  onClick={() => setShowSettingsMenu(false)}
                  className="p-1 text-stone-400 hover:text-stone-100 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 1. Tasa BCV del Día Control Inside Menu */}
              <div className="bg-stone-950 border-2 border-[#D4AF37]/60 p-3.5 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-400 uppercase tracking-wider flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-amber-400" /> Tasa BCV del Día
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setTempRate(bcvRate ? bcvRate.rate_ves.toString() : '36.50');
                        setIsEditingRate(true);
                      }}
                      title="Editar Tasa BCV"
                      className="p-1 hover:bg-stone-800 text-stone-300 hover:text-amber-400 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {onOpenDolarHistory && (
                      <button
                        onClick={() => {
                          onOpenDolarHistory();
                          setShowSettingsMenu(false);
                        }}
                        title="Ver Histórico de Tasas del Dólar"
                        className="p-1 hover:bg-stone-800 text-amber-400 rounded-lg transition-colors"
                      >
                        <History className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="text-xl font-black text-stone-100">
                  1 USD = {bcvRate ? `${bcvRate.rate_ves.toFixed(2)} VES` : 'Cargando...'}
                </div>
                <p className="text-[11px] text-stone-400">Tasa oficial utilizada en todos los cálculos del comercio.</p>
              </div>

              {/* 2. Theme Toggle Option */}
              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-stone-950 border border-stone-800">
                <span className="text-xs font-bold text-stone-300">Modo de Pantalla</span>
                <button
                  onClick={onToggleTheme}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-700 bg-stone-900 text-stone-200 text-xs font-bold hover:bg-stone-800"
                >
                  {theme === 'dark' ? (
                    <>
                      <Sun className="w-4 h-4 text-amber-400" />
                      <span>Claro</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-4 h-4 text-stone-400" />
                      <span>Oscuro</span>
                    </>
                  )}
                </button>
              </div>

              {/* 3. Sync Queue Option */}
              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-stone-950 border border-stone-800">
                <div>
                  <span className="text-xs font-bold text-stone-300 block">Sincronización</span>
                  <span className="text-[10px] text-stone-400">{syncQueueCount} pendientes</span>
                </div>
                <button
                  onClick={() => {
                    onForceSync();
                    setShowSettingsMenu(false);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-600 text-stone-100 text-xs font-bold border border-[#D4AF37]/50"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Sincronizar</span>
                </button>
              </div>

              {/* 4. Network Status Toggle */}
              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-stone-950 border border-stone-800">
                <span className="text-xs font-bold text-stone-300">Conexión a Red</span>
                <button
                  onClick={onToggleOnline}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                    isOnline
                      ? 'bg-amber-900/40 border-amber-600/60 text-amber-200'
                      : 'bg-rose-900/40 border-rose-600/60 text-rose-200'
                  }`}
                >
                  {isOnline ? (
                    <>
                      <Wifi className="w-3.5 h-3.5 text-amber-400" />
                      <span>EN LÍNEA</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                      <span>OFFLINE</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Manual Rate Adjustment Modal */}
      {isEditingRate && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border-2 border-[#D4AF37] rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <h3 className="text-xl font-extrabold text-stone-100 flex items-center gap-2 font-wabi">
              <DollarSign className="w-6 h-6 text-amber-400" /> Ajustar Tasa BCV (VES)
            </h3>
            <p className="text-xs text-stone-400">
              Modifica la tasa oficial en bolívares por cada dólar para las conversiones del comercio.
            </p>
            <div>
              <label className="text-xs font-bold text-stone-300 block mb-1">Tasa en Bolívares (VES)</label>
              <input
                type="number"
                step="0.01"
                value={tempRate}
                onChange={(e) => setTempRate(e.target.value)}
                className="w-full bg-stone-950 border-2 border-stone-700 rounded-2xl px-4 py-3 text-stone-100 text-2xl font-black focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setIsEditingRate(false)}
                className="px-4 py-2 text-stone-400 hover:text-stone-100 text-sm font-bold rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveRate}
                className="px-5 py-2.5 bg-amber-700 hover:bg-amber-600 text-stone-100 font-bold rounded-2xl flex items-center gap-2 text-sm shadow-lg border border-[#D4AF37]/50"
              >
                <Check className="w-4 h-4" /> Guardar Tasa
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
