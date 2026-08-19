'use client';

import React, { useState } from 'react';
import { Receipt, Plus, Tag, Calendar } from 'lucide-react';
import { Expense, ExchangeRate } from '../../lib/types';
import { formatUSD, formatVES } from '../../lib/bimonetary/exchangeRate';
import { putToStore, addToSyncQueue } from '../../lib/db/indexeddb';

interface ExpensesModuleProps {
  expenses: Expense[];
  bcvRate: ExchangeRate | null;
  onRefreshExpenses: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  MERCANCIA:   'Mercancía',
  SERVICIOS:   'Servicios',
  TRANSPORTE:  'Transporte',
  OTROS:       'Otros',
};

export const ExpensesModule: React.FC<ExpensesModuleProps> = ({
  expenses,
  bcvRate,
  onRefreshExpenses,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [description, setDescription]  = useState('');
  const [amountUSD, setAmountUSD]       = useState('');
  const [category, setCategory]         = useState<'MERCANCIA' | 'SERVICIOS' | 'TRANSPORTE' | 'OTROS'>('MERCANCIA');
  const [errorMsg, setErrorMsg]         = useState<string | null>(null);

  const rateVES = bcvRate ? bcvRate.rate_ves : 36.50;
  const totalExpensesUSD = expenses.reduce((sum, e) => sum + e.amount_usd, 0);

  const handleAddExpense = async () => {
    if (!description.trim() || !amountUSD) {
      setErrorMsg('Por favor completa la descripción y el monto.');
      return;
    }
    const amt = parseFloat(amountUSD);
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('El monto debe ser un número positivo.');
      return;
    }
    const newExpense: Expense = {
      id: 'exp-' + Date.now(),
      description: description.trim(),
      amount_usd: amt,
      category,
      expense_date: new Date().toISOString().split('T')[0],
    };
    await putToStore('expenses', newExpense);
    await addToSyncQueue({ table_name: 'expenses', action: 'INSERT', data: newExpense });
    onRefreshExpenses();
    setShowAddModal(false);
    setDescription('');
    setAmountUSD('');
    setErrorMsg(null);
  };

  return (
    <div className="pb-32 max-w-7xl mx-auto px-3 sm:px-4 pt-3 sm:pt-4 space-y-4 sm:space-y-5">

      {/* ── Encabezado ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-stone-100 font-wabi flex items-center gap-2">
            <Receipt className="w-5 h-5 text-stone-400" />
            Registro de Gastos
          </h2>
          <p className="text-xs sm:text-sm text-stone-400 mt-0.5">
            Compras a proveedores y servicios para deducir de la ganancia neta.
          </p>
        </div>

        {/* CTA primario */}
        <button
          onClick={() => setShowAddModal(true)}
          className="w-full sm:w-auto py-3 px-5 sm:px-6 bg-amber-800 hover:bg-amber-700 border-2 border-[#D4AF37] text-stone-100 font-black rounded-2xl flex items-center justify-center gap-2 transition-all touch-target-lg"
        >
          <Plus className="w-5 h-5" /> Registrar Gasto
        </button>
      </div>

      {/* ── Resumen total ──────────────────────────────────────── */}
      <div className="bg-stone-900 border border-stone-800 p-4 sm:p-5 rounded-2xl flex flex-row justify-between items-center">
        <div>
          <span className="text-[10px] sm:text-xs font-bold text-stone-500 uppercase tracking-wider block">
            Total Gastos Registrados
          </span>
          <span className="text-2xl sm:text-3xl font-black text-stone-100 block leading-tight">
            {formatUSD(totalExpensesUSD)}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[10px] sm:text-xs font-bold text-stone-500 uppercase tracking-wider block">
            Equivalente VES
          </span>
          <span className="text-sm sm:text-base font-bold text-stone-300">
            {formatVES(totalExpensesUSD, rateVES)}
          </span>
        </div>
      </div>

      {/* ── Lista de gastos ─────────────────────────────────────── */}
      <div className="space-y-2">
        {expenses.length === 0 ? (
          <div className="py-12 sm:py-14 text-center text-stone-500 bg-stone-900 wabi-card space-y-1">
            <Receipt className="w-8 h-8 mx-auto mb-3 text-stone-700" />
            <p className="font-bold text-stone-400">No hay gastos registrados.</p>
            <p className="text-xs sm:text-sm">Presiona el botón para ingresar una factura o compra.</p>
          </div>
        ) : (
          expenses.map((e) => (
            <div
              key={e.id}
              className="bg-stone-900 border border-stone-800 p-3.5 sm:p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 hover:border-stone-700 transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-transparent border border-stone-700 text-stone-400 flex items-center gap-1">
                    <Tag className="w-3 h-3" /> {CATEGORY_LABELS[e.category] || e.category}
                  </span>
                  <span className="text-xs text-stone-500 font-semibold flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {e.expense_date}
                  </span>
                </div>
                <h4 className="font-bold text-stone-100 text-sm">{e.description}</h4>
              </div>

              <div className="text-left sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-800 flex sm:block justify-between items-baseline">
                <span className="text-lg sm:text-xl font-black text-stone-100 block">
                  {formatUSD(e.amount_usd)}
                </span>
                <span className="text-xs font-semibold text-stone-500">
                  {formatVES(e.amount_usd, rateVES)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Modal Registrar Gasto ───────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-stone-900 border-t-2 sm:border-2 border-[#D4AF37] rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg sm:text-xl font-bold text-stone-100 flex items-center gap-2 font-wabi">
              <Receipt className="w-5 h-5 text-stone-400" /> Registrar Gasto
            </h3>

            {errorMsg && (
              <div
                className="border border-[#C0392B]/60 text-stone-200 p-3 rounded-xl text-xs font-bold"
                style={{ backgroundColor: 'rgba(192,57,43,0.12)' }}
              >
                {errorMsg}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-stone-400 block mb-1">
                  Descripción *
                </label>
                <input
                  type="text"
                  placeholder="Ej. 2 cajas de café al proveedor"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl p-3 text-stone-100 font-semibold focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-400 block mb-1">
                  Categoría
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as 'MERCANCIA' | 'SERVICIOS' | 'TRANSPORTE' | 'OTROS')}
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl p-3 text-stone-100 font-semibold focus:outline-none focus:border-amber-500 transition-colors"
                >
                  <option value="MERCANCIA">Mercancía (Inventario)</option>
                  <option value="SERVICIOS">Servicios (Luz, Agua, Internet)</option>
                  <option value="TRANSPORTE">Transporte / Flete</option>
                  <option value="OTROS">Otros Gastos</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-400 block mb-1">
                  Monto en Dólares ($ USD) *
                </label>
                <input
                  type="number" step="0.01" placeholder="25.00"
                  value={amountUSD}
                  onChange={(e) => setAmountUSD(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl p-3 text-stone-100 font-extrabold focus:outline-none focus:border-amber-500 text-xl transition-colors"
                />
                <span className="text-xs font-bold text-stone-500 block mt-1">
                  {formatVES(parseFloat(amountUSD) || 0, rateVES)}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setShowAddModal(false); setErrorMsg(null); }}
                className="px-4 py-2.5 text-stone-400 hover:text-stone-100 font-bold text-sm border border-stone-700 rounded-xl hover:bg-stone-800 transition-all touch-target-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddExpense}
                className="px-6 py-3 bg-amber-800 hover:bg-amber-700 text-stone-100 font-black rounded-2xl text-sm border-2 border-[#D4AF37] transition-all touch-target-lg"
              >
                Guardar Gasto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
