'use client';

import React from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  DollarSign,
  CreditCard,
  RotateCcw,
  Clock,
  ShoppingBag,
} from 'lucide-react';
import { Sale, Expense, Debt, ExchangeRate } from '../../lib/types';
import { formatUSD, formatVES } from '../../lib/bimonetary/exchangeRate';
import { clearAllLocalData } from '../../lib/db/indexeddb';
import { pullAllFromSupabase } from '../../lib/sync/syncEngine';

interface FinancialDashboardProps {
  sales: Sale[];
  expenses: Expense[];
  debts: Debt[];
  bcvRate: ExchangeRate | null;
  onResetData: () => void;
}

// ── Componente de tarjeta de métrica ──────────────────────────────
interface MetricCardProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  amountUSD: number;
  amountVES: string;
  sublabel: string;
  isAlert?: boolean;
  isDynamic?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({
  label,
  icon: Icon,
  amountUSD,
  amountVES,
  sublabel,
  isAlert = false,
  isDynamic = false,
}) => {
  const amountClass =
    isAlert
      ? 'text-[#C0392B]'
      : isDynamic && amountUSD < 0
      ? 'text-[#C0392B]'
      : 'text-stone-100 font-black';

  return (
    <div className="wabi-card bg-stone-900 p-4 sm:p-5 flex flex-col justify-between space-y-2.5 sm:space-y-3">
      {/* Encabezado de tarjeta */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] sm:text-xs font-bold text-stone-400 uppercase tracking-wider">
          {label}
        </span>
        <div className="w-8 sm:w-9 h-8 sm:h-9 rounded-xl bg-stone-800 border border-stone-700 text-stone-400 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4" />
        </div>
      </div>

      {/* Monto principal */}
      <div>
        <span className={`text-2xl sm:text-3xl font-black block leading-tight truncate ${amountClass}`}>
          {formatUSD(amountUSD)}
        </span>
        <span className="text-xs font-bold text-stone-400 block mt-0.5 truncate">{amountVES}</span>
      </div>

      <span className="text-[10px] sm:text-[11px] text-stone-500 font-semibold truncate">{sublabel}</span>
    </div>
  );
};

// ── Componente principal ──────────────────────────────────────────
export const FinancialDashboard: React.FC<FinancialDashboardProps> = ({
  sales,
  expenses,
  debts,
  bcvRate,
  onResetData,
}) => {
  const rateVES = bcvRate ? bcvRate.rate_ves : 36.50;

  const grossSalesUSD       = sales.reduce((sum, s) => sum + s.total_usd, 0);
  const totalExpensesUSD    = expenses.reduce((sum, e) => sum + e.amount_usd, 0);
  const netProfitUSD        = grossSalesUSD - totalExpensesUSD;
  const totalDebtsPendingUSD = debts
    .filter((d) => d.status !== 'PAID')
    .reduce((sum, d) => sum + d.amount_usd, 0);

  const handleReset = async () => {
    if (window.confirm('¿Deseas limpiar todos los datos locales obsoletos y resincronizar exactamente con la nube?')) {
      await clearAllLocalData();
      await pullAllFromSupabase();
      onResetData();
      alert('¡Datos locales limpiados y resincronizados con la nube con éxito!');
    }
  };

  return (
    <div className="pb-32 max-w-7xl mx-auto px-3 sm:px-4 pt-3 sm:pt-4 space-y-4 sm:space-y-6">

      {/* ── Encabezado ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-stone-100 font-wabi flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-stone-400" />
            Dashboard Financiero
          </h2>
          <p className="text-xs sm:text-sm text-stone-400 mt-0.5">
            Ingresos, ganancia neta y capital fiado en USD y VES.
          </p>
        </div>

        {/* Botón Secundario / Outline */}
        <button
          onClick={handleReset}
          className="w-full sm:w-auto px-4 py-2.5 bg-transparent hover:bg-stone-800 border border-stone-700 text-stone-400 hover:text-stone-100 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all touch-target-lg"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Limpiar Base de Datos
        </button>
      </div>

      {/* ── Tarjetas de métricas ──────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <MetricCard
          label="Ingresos Brutos"
          icon={DollarSign}
          amountUSD={grossSalesUSD}
          amountVES={formatVES(grossSalesUSD, rateVES)}
          sublabel={`${sales.length} venta${sales.length !== 1 ? 's' : ''}`}
        />
        <MetricCard
          label="Gastos"
          icon={TrendingDown}
          amountUSD={totalExpensesUSD}
          amountVES={formatVES(totalExpensesUSD, rateVES)}
          sublabel={`${expenses.length} gasto${expenses.length !== 1 ? 's' : ''}`}
          isAlert={totalExpensesUSD > grossSalesUSD}
        />
        <MetricCard
          label="Ganancia Neta"
          icon={TrendingUp}
          amountUSD={netProfitUSD}
          amountVES={formatVES(netProfitUSD, rateVES)}
          sublabel="Margen libre"
          isDynamic
        />
        <MetricCard
          label="Capital Fiado"
          icon={CreditCard}
          amountUSD={totalDebtsPendingUSD}
          amountVES={formatVES(totalDebtsPendingUSD, rateVES)}
          sublabel="Por cobrar"
          isAlert={totalDebtsPendingUSD > 0}
        />
      </div>

      {/* ── Historial reciente de ventas ────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-base font-bold text-stone-300 flex items-center gap-2">
          <Clock className="w-4 h-4 text-stone-500" />
          Historial Reciente
        </h3>

        {sales.length === 0 ? (
          <div className="py-12 sm:py-14 text-center text-stone-500 wabi-card bg-stone-900">
            <ShoppingBag className="w-8 h-8 mx-auto mb-3 text-stone-700" />
            <p className="font-bold text-stone-400 text-sm">No hay ventas registradas aún.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sales
              .slice()
              .reverse()
              .map((sale) => {
                const isFiado = sale.payment_type === 'FIADO';
                return (
                  <div
                    key={sale.id}
                    className="bg-stone-900 border border-stone-800 p-3.5 sm:p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 hover:border-stone-700 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span
                          className={`text-[10px] sm:text-[11px] font-black px-2 py-0.5 rounded-md border ${
                            isFiado
                              ? 'border-[#D4AF37]/40 text-amber-400 bg-amber-900/20'
                              : 'border-stone-700 text-stone-400 bg-stone-800'
                          }`}
                        >
                          {sale.payment_type}
                        </span>
                        <span className="text-[11px] sm:text-xs text-stone-500 font-medium">
                          {new Date(sale.sale_timestamp).toLocaleString('es-VE', {
                            day: '2-digit',
                            month: '2-digit',
                            year: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <h4 className="font-bold text-stone-100 text-sm leading-tight truncate">
                        {sale.client_name || 'Venta de Contado'}
                      </h4>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        Tasa: 1 $ = {sale.rate_at_time.toFixed(2)} Bs
                      </p>
                    </div>

                    {/* Monto */}
                    <div className="text-left sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-800/80 flex sm:block justify-between items-baseline">
                      <span className="text-lg sm:text-xl font-black text-stone-100 block leading-tight">
                        {formatUSD(sale.total_usd)}
                      </span>
                      <span className="text-xs font-semibold text-stone-400 block">
                        {formatVES(sale.total_usd, sale.rate_at_time)}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
};
