'use client';

import React, { useState, useEffect } from 'react';
import { History, Calendar, TrendingUp, TrendingDown, DollarSign, RefreshCw, Calculator, ArrowRight, ShieldCheck, Search, Info } from 'lucide-react';
import { HistoricalRate, ExchangeRate } from '../../lib/types';
import { fetchHistoricalRatesFromAPI, getRateForDate, calcDevaluation, formatUSD, formatVES } from '../../lib/bimonetary/exchangeRate';

interface DollarHistoryModuleProps {
  currentRate: ExchangeRate | null;
}

export const DollarHistoryModule: React.FC<DollarHistoryModuleProps> = ({ currentRate }) => {
  const currentVES = currentRate ? currentRate.rate_ves : 36.50;

  const [historyList, setHistoryList] = useState<HistoricalRate[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Calculator State
  const [calcUSD, setCalcUSD] = useState<string>('10');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [historicalRateForSelectedDate, setHistoricalRateForSelectedDate] = useState<HistoricalRate | null>(null);
  const [isSearchingDate, setIsSearchingDate] = useState<boolean>(false);

  // Load Full History from API / IndexedDB
  const loadHistory = async () => {
    setIsLoading(true);
    const data = await fetchHistoricalRatesFromAPI();
    setHistoryList(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // Update calculation whenever selected date changes
  useEffect(() => {
    let isMounted = true;
    const lookupDate = async () => {
      setIsSearchingDate(true);
      const rateObj = await getRateForDate(selectedDate);
      if (isMounted) {
        setHistoricalRateForSelectedDate(rateObj);
        setIsSearchingDate(false);
      }
    };
    lookupDate();
    return () => {
      isMounted = false;
    };
  }, [selectedDate]);

  // Preset Date Selection helpers
  const handleSetPresetDate = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const filteredHistory = historyList.filter(
    (h) => h.date.includes(searchQuery) || h.rate_bcv.toString().includes(searchQuery)
  );

  const calcUsdNum = parseFloat(calcUSD) || 0;
  const pastRateVES = historicalRateForSelectedDate ? historicalRateForSelectedDate.rate_bcv : currentVES * 0.9;
  const pastTotalVES = calcUsdNum * pastRateVES;
  const currentTotalVES = calcUsdNum * currentVES;
  const diffVES = currentTotalVES - pastTotalVES;

  const devaluation = calcDevaluation(pastRateVES, currentVES);

  return (
    <div className="pb-32 max-w-7xl mx-auto px-3 sm:px-4 pt-3 sm:pt-4 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-stone-100 flex items-center gap-2 font-wabi">
            <History className="w-5 h-5 text-stone-400" /> Histórico del Dólar
          </h2>
          <p className="text-xs text-stone-400 font-semibold mt-0.5">
            Tasa BCV oficial y paralela. Evita la distorsión del valor temporal.
          </p>
        </div>

        <button
          onClick={loadHistory}
          disabled={isLoading}
          className="w-full sm:w-auto px-4 py-2.5 bg-amber-800 hover:bg-amber-700 border border-[#D4AF37]/50 text-stone-100 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all touch-target-lg"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Sincronizar API
        </button>
      </div>

      {/* Calculadora — stack en móvil, grid en md+ */}
      <div className="bg-stone-900 border border-[#D4AF37]/40 p-4 sm:p-6 rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-800 pb-3">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-stone-400" />
            <h3 className="text-base sm:text-lg font-bold text-stone-100 font-wabi">Calculadora Temporal</h3>
          </div>
          <span className="text-[10px] bg-amber-900/30 text-amber-300 font-bold px-2.5 py-1 rounded-full border border-[#D4AF37]/30 self-start">
            Anti-Distorsión
          </span>
        </div>

        {/* Inputs: stack en móvil */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-400 uppercase tracking-wide block">Monto en USD</label>
              <div className="relative">
                <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input type="number" step="0.01" value={calcUSD}
                  onChange={(e) => setCalcUSD(e.target.value)}
                  className="w-full bg-stone-950 border-2 border-stone-700 rounded-xl pl-10 pr-4 py-3 text-stone-100 font-black text-lg focus:outline-none focus:border-amber-500" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-400 uppercase tracking-wide block">Fecha a comparar</label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input type="date" value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full bg-stone-950 border-2 border-stone-700 rounded-xl pl-10 pr-4 py-3 text-stone-100 font-bold text-sm focus:outline-none focus:border-amber-400" />
              </div>
            </div>
          </div>

          {/* Presets: scroll horizontal en móvil */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {[{label: '7 días', d: 7}, {label: '15 días', d: 15}, {label: '1 mes', d: 30}, {label: '3 meses', d: 90}].map(({ label, d }) => (
              <button key={d} onClick={() => handleSetPresetDate(d)}
                className="flex-shrink-0 px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs rounded-xl transition-all">
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Resultados — 1 col en móvil, 3 en md */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-stone-950 border border-stone-800 p-4 rounded-xl space-y-2">
            <span className="text-xs font-bold text-stone-400 uppercase tracking-wide block">Tasa {selectedDate}</span>
            <span className="text-xl font-black text-stone-100 block">1 $ = {pastRateVES.toFixed(2)} Bs</span>
            <div className="pt-2 border-t border-stone-900">
              <span className="text-xs text-stone-500 block">Equivalente en esa fecha:</span>
              <span className="text-lg font-black text-stone-100">Bs {pastTotalVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="bg-stone-950 border border-[#D4AF37]/30 p-4 rounded-xl space-y-2">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wide block">Tasa BCV Hoy</span>
            <span className="text-xl font-black text-stone-100 block">1 $ = {currentVES.toFixed(2)} Bs</span>
            <div className="pt-2 border-t border-stone-900">
              <span className="text-xs text-stone-500 block">Equivalente hoy:</span>
              <span className="text-lg font-black text-stone-100">Bs {currentTotalVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="bg-stone-950 border border-stone-800 p-4 rounded-xl space-y-2">
            <span className="text-xs font-bold text-stone-400 uppercase tracking-wide block">Variacion</span>
            <span className="text-xl font-black text-stone-100 block">+Bs {diffVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
            <div className="pt-2 border-t border-stone-900">
              <span className="text-xs text-stone-500 block">Cambio en valor:</span>
              <span className="text-xs font-bold text-stone-300">{devaluation.text}</span>
            </div>
          </div>
        </div>

        {/* Callout */}
        <div className="bg-stone-950 border border-stone-800 p-3 sm:p-4 rounded-xl flex items-start gap-3 text-xs text-stone-400">
          <Info className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-stone-200">{formatUSD(calcUsdNum)}</strong> el {selectedDate} eran
            {' '}<strong className="text-stone-200">Bs {pastTotalVES.toLocaleString('es-VE', {minimumFractionDigits:2})}</strong>.
            Hoy son <strong className="text-stone-200">Bs {currentTotalVES.toLocaleString('es-VE', {minimumFractionDigits:2})}</strong>
            {' '}(diferencia: <strong className="text-stone-200">Bs {diffVES.toLocaleString('es-VE', {minimumFractionDigits:2})}</strong>).
          </p>
        </div>
      </div>

      {/* Historical Rates Table */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-stone-100 flex items-center gap-2 font-wabi">
            <Calendar className="w-5 h-5 text-amber-400" /> Registro Histórico Diario de Tasas (BCV & Paralelo)
          </h3>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              placeholder="Buscar por fecha (YYYY-MM-DD)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-stone-900 border border-stone-700 rounded-xl pl-9 pr-3 py-2 text-stone-100 text-xs font-semibold focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="py-10 text-center text-stone-400 bg-stone-900 rounded-2xl text-sm font-bold">
            Cargando historial...
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="py-10 text-center text-stone-500 bg-stone-900 rounded-2xl text-sm">
            No se encontraron registros.
          </div>
        ) : (
          <>
            {/* Tabla — visible en sm+ con scroll horizontal */}
            <div className="hidden sm:block bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-950 border-b border-stone-800 text-stone-400 text-xs font-bold uppercase tracking-wider">
                      <th className="py-3 px-4">Fecha</th>
                      <th className="py-3 px-4">Tasa BCV</th>
                      <th className="py-3 px-4">Paralelo</th>
                      <th className="py-3 px-4">Brecha</th>
                      <th className="py-3 px-4 text-right">Accion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800/60 text-sm">
                    {filteredHistory.slice(0, 30).map((item) => {
                      const bcv = item.rate_bcv;
                      const par = item.rate_paralelo || bcv;
                      const gap = par > 0 && bcv > 0 ? ((par - bcv) / bcv) * 100 : 0;
                      return (
                        <tr key={item.date} className="hover:bg-stone-800/40 transition-colors">
                          <td className="py-3 px-4 font-bold text-stone-100 text-xs">{item.date}</td>
                          <td className="py-3 px-4 font-black text-stone-100 text-xs">1 $ = {bcv.toFixed(2)} Bs</td>
                          <td className="py-3 px-4 font-bold text-stone-300 text-xs">{item.rate_paralelo ? `1 $ = ${item.rate_paralelo.toFixed(2)} Bs` : 'N/D'}</td>
                          <td className="py-3 px-4">
                            {gap > 0 ? (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 border border-stone-700">+{gap.toFixed(1)}%</span>
                            ) : <span className="text-xs text-stone-600">0%</span>}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button onClick={() => setSelectedDate(item.date)}
                              className="px-3 py-1.5 bg-stone-800 hover:bg-amber-800 text-stone-300 hover:text-stone-100 font-bold text-xs rounded-lg transition-colors border border-stone-700 inline-flex items-center gap-1">
                              Comparar <ArrowRight className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cards — visible solo en móvil */}
            <div className="sm:hidden space-y-2">
              {filteredHistory.slice(0, 20).map((item) => {
                const gap = item.rate_paralelo && item.rate_bcv
                  ? (((item.rate_paralelo - item.rate_bcv) / item.rate_bcv) * 100).toFixed(1)
                  : null;
                return (
                  <div key={item.date} className="bg-stone-900 border border-stone-800 p-3 rounded-xl">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-stone-100 text-sm">{item.date}</span>
                      {gap && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 border border-stone-700">+{gap}%</span>}
                    </div>
                    <div className="flex justify-between text-xs">
                      <div>
                        <span className="text-stone-500 block">BCV</span>
                        <span className="font-black text-stone-100">1$ = {item.rate_bcv.toFixed(2)} Bs</span>
                      </div>
                      <div className="text-right">
                        <span className="text-stone-500 block">Paralelo</span>
                        <span className="font-bold text-stone-300">{item.rate_paralelo ? `1$ = ${item.rate_paralelo.toFixed(2)} Bs` : 'N/D'}</span>
                      </div>
                    </div>
                    <button onClick={() => setSelectedDate(item.date)}
                      className="mt-2 w-full py-1.5 bg-stone-800 hover:bg-amber-800 text-stone-300 hover:text-stone-100 font-bold text-xs rounded-lg transition-colors border border-stone-700 flex items-center justify-center gap-1">
                      Usar en calculadora <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
