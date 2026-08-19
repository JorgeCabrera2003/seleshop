'use client';

import React, { useState } from 'react';
import {
  CreditCard, MessageSquare, CheckCircle, Calendar, DollarSign,
  User, ChevronDown, ChevronUp, Layers, ListFilter, CheckCheck,
} from 'lucide-react';
import { Debt, Client, ExchangeRate } from '../../lib/types';
import { formatUSD, formatVES } from '../../lib/bimonetary/exchangeRate';
import { putToStore, addToSyncQueue } from '../../lib/db/indexeddb';

interface DebtsModuleProps {
  debts: Debt[];
  clients: Client[];
  bcvRate: ExchangeRate | null;
  onRefreshDebts: () => void;
}

interface GroupedClientDebt {
  client_id: string;
  client_name: string;
  whatsapp_number: string;
  total_usd: number;
  pending_count: number;
  debts: Debt[];
  earliest_due_date: string;
  is_all_paid: boolean;
}

// ── Badge de estado tipográfico ──────────────────────────────────
const StatusBadge: React.FC<{ status: 'PAID' | 'PARTIAL' | 'PENDING' }> = ({ status }) => {
  const map = {
    PAID:    { label: 'Pagado',   cls: 'text-stone-400 border-stone-700' },
    PARTIAL: { label: 'Abonado',  cls: 'text-amber-400 border-[#D4AF37]/40' },
    PENDING: { label: 'Pendiente', cls: 'text-stone-300 border-stone-700' },
  };
  const { label, cls } = map[status];
  return (
    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border bg-transparent ${cls}`}>
      {label}
    </span>
  );
};

export const DebtsModule: React.FC<DebtsModuleProps> = ({
  debts, clients, bcvRate, onRefreshDebts,
}) => {
  const [viewMode, setViewMode]         = useState<'GROUPED' | 'INDIVIDUAL'>('GROUPED');
  const [filterStatus, setFilterStatus] = useState<'PENDING' | 'PAID' | 'ALL'>('PENDING');
  const [expandedClientIds, setExpandedClientIds] = useState<string[]>([]);
  const [selectedDebtForPayment, setSelectedDebtForPayment] = useState<Debt | null>(null);
  const [selectedGroupedForPayment, setSelectedGroupedForPayment] = useState<GroupedClientDebt | null>(null);
  const [paymentAmountUSD, setPaymentAmountUSD] = useState('');

  const rateVES = bcvRate ? bcvRate.rate_ves : 36.50;

  const filteredDebts = debts.filter((d) => {
    if (filterStatus === 'PENDING') return d.status !== 'PAID';
    if (filterStatus === 'PAID')    return d.status === 'PAID';
    return true;
  });

  const totalPendingUSD = debts
    .filter((d) => d.status !== 'PAID')
    .reduce((sum, d) => sum + d.amount_usd, 0);

  const groupedClients: GroupedClientDebt[] = React.useMemo(() => {
    const groups: Record<string, Debt[]> = {};
    filteredDebts.forEach((debt) => {
      const key = debt.client_id || debt.client_name || 'anonimo';
      if (!groups[key]) groups[key] = [];
      groups[key].push(debt);
    });

    const result = Object.entries(groups).map(([key, clientDebts]) => {
      const firstDebt  = clientDebts[0];
      const client     = clients.find((c) => c.id === firstDebt.client_id);
      const name       = client?.full_name || firstDebt.client_name || 'Cliente';
      const phone      = client?.whatsapp_number || firstDebt.whatsapp_number || '';
      const pending    = clientDebts.filter((d) => d.status !== 'PAID');
      const total_usd  = pending.reduce((s, d) => s + d.amount_usd, 0);
      const is_all_paid = pending.length === 0;
      const dueDates   = clientDebts.map((d) => d.due_date).filter(Boolean).sort();

      return {
        client_id: key,
        client_name: name,
        whatsapp_number: phone,
        total_usd: is_all_paid ? clientDebts.reduce((s, d) => s + d.amount_usd, 0) : total_usd,
        pending_count: pending.length,
        debts: clientDebts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
        earliest_due_date: dueDates[0] || '—',
        is_all_paid,
      };
    });
    result.sort((a, b) => b.total_usd - a.total_usd);
    return result;
  }, [filteredDebts, clients]);

  const toggleExpandClient = (id: string) =>
    setExpandedClientIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const handleOpenGroupedWhatsAppReminder = (grouped: GroupedClientDebt) => {
    const cleanPhone  = (grouped.whatsapp_number || '').replace(/[^\d+]/g, '');
    const pendingD    = grouped.debts.filter((d) => d.status !== 'PAID');
    const totalUSD    = grouped.total_usd;
    const totalVES    = formatVES(totalUSD, rateVES);
    const itemsSummary = pendingD
      .map((d) => {
        const fecha = new Date(d.created_at).toLocaleDateString('es-VE');
        let desc = (d.notes ? d.notes.split('|')[0].trim() : 'Compra fiada')
          .replace(/^Fiado\s+(del\s+\d{1,2}\/\d{1,2}\/\d{4}:?|de\s+|del\s+)/i, '').trim() || 'Compra fiada';
        return `• ${fecha}: ${desc} (${formatUSD(d.amount_usd)})`;
      })
      .join('\n');

    const msg = `Hola ${grouped.client_name}, te saludamos de SeleShop. Resumen de tus ${pendingD.length} compras fiadas pendientes:\n\n${itemsSummary}\n\nTotal a pagar: ${formatUSD(totalUSD)} USD (${totalVES})\n(Tasa BCV Oficial: 1 USD = ${rateVES.toFixed(2)} VES)\n\nQuedamos atentos a tu pago. Muchas gracias.`;
    window.open(`https://wa.me/${cleanPhone.replace('+', '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleOpenWhatsAppReminder = (debt: Debt) => {
    const client     = clients.find((c) => c.id === debt.client_id);
    const cleanPhone = (client?.whatsapp_number || debt.whatsapp_number || '').replace(/[^\d+]/g, '');
    const clientName = client?.full_name || debt.client_name || 'Cliente';
    const msg = `Hola ${clientName}, te escribimos de SeleShop para recordarte tu saldo pendiente de ${formatUSD(debt.amount_usd)} USD (${formatVES(debt.amount_usd, rateVES)}). Quedamos atentos a tu pago. Muchas gracias.`;
    window.open(`https://wa.me/${cleanPhone.replace('+', '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleRegisterSinglePayment = async () => {
    if (!selectedDebtForPayment) return;
    const payNum = parseFloat(paymentAmountUSD);
    if (isNaN(payNum) || payNum <= 0) return;
    const remaining  = selectedDebtForPayment.amount_usd - payNum;
    const newStatus  = remaining <= 0.01 ? 'PAID' : 'PARTIAL';
    const updated: Debt = {
      ...selectedDebtForPayment,
      amount_usd: Math.max(0, remaining),
      status: newStatus,
      notes: `${selectedDebtForPayment.notes || ''} | Abono de ${formatUSD(payNum)} el ${new Date().toLocaleDateString('es-VE')}`,
    };
    await putToStore('debts', updated);
    await addToSyncQueue({ table_name: 'debts', action: 'UPDATE', data: updated });
    onRefreshDebts();
    setSelectedDebtForPayment(null);
    setPaymentAmountUSD('');
  };

  const handlePayAllForGroupedClient = async (grouped: GroupedClientDebt) => {
    if (!window.confirm(`¿Liquidar TODA la deuda de ${grouped.client_name} por ${formatUSD(grouped.total_usd)} USD?`)) return;
    for (const debt of grouped.debts.filter((d) => d.status !== 'PAID')) {
      const updated: Debt = {
        ...debt, amount_usd: 0, status: 'PAID',
        notes: `${debt.notes || ''} | Pagado totalmente el ${new Date().toLocaleDateString('es-VE')}`,
      };
      await putToStore('debts', updated);
      await addToSyncQueue({ table_name: 'debts', action: 'UPDATE', data: updated });
    }
    onRefreshDebts();
  };

  const handleRegisterGroupedAbono = async () => {
    if (!selectedGroupedForPayment) return;
    let remaining = parseFloat(paymentAmountUSD);
    if (isNaN(remaining) || remaining <= 0) return;
    const pendingDebts = selectedGroupedForPayment.debts
      .filter((d) => d.status !== 'PAID')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    for (const debt of pendingDebts) {
      if (remaining <= 0) break;
      if (remaining >= debt.amount_usd) {
        remaining -= debt.amount_usd;
        await putToStore('debts', { ...debt, amount_usd: 0, status: 'PAID', notes: `${debt.notes || ''} | Liquidado por abono consolidado el ${new Date().toLocaleDateString('es-VE')}` });
        await addToSyncQueue({ table_name: 'debts', action: 'UPDATE', data: { ...debt, amount_usd: 0, status: 'PAID' } });
      } else {
        const newBalance = debt.amount_usd - remaining;
        await putToStore('debts', { ...debt, amount_usd: newBalance, status: 'PARTIAL', notes: `${debt.notes || ''} | Abono de ${formatUSD(remaining)} el ${new Date().toLocaleDateString('es-VE')}` });
        await addToSyncQueue({ table_name: 'debts', action: 'UPDATE', data: { ...debt, amount_usd: newBalance, status: 'PARTIAL' } });
        remaining = 0;
      }
    }
    onRefreshDebts();
    setSelectedGroupedForPayment(null);
    setPaymentAmountUSD('');
  };

  const filterTabs: { key: 'PENDING' | 'PAID' | 'ALL'; label: string; count: number }[] = [
    { key: 'PENDING', label: 'Pendientes', count: debts.filter((d) => d.status !== 'PAID').length },
    { key: 'PAID',    label: 'Pagadas',    count: debts.filter((d) => d.status === 'PAID').length },
    { key: 'ALL',     label: 'Todas',      count: debts.length },
  ];

  return (
    <div className="pb-32 max-w-7xl mx-auto px-3 sm:px-4 pt-3 sm:pt-4 space-y-4 sm:space-y-5">

      {/* ── Encabezado ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-stone-100 font-wabi flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-stone-400" />
            Libro Mayor de Fiados
          </h2>
          <p className="text-xs sm:text-sm text-stone-400 mt-0.5">
            Control bimonetario de deudas y cobranza en 1 clic.
          </p>
        </div>

        {/* Resumen capital pendiente */}
        <div className="w-full sm:w-auto bg-stone-900 border border-stone-700 p-3 sm:p-4 rounded-2xl text-left sm:text-right min-w-[180px] flex sm:block justify-between items-center">
          <div>
            <span className="text-[10px] sm:text-xs font-bold text-stone-400 uppercase tracking-wider block">
              Capital Pendiente
            </span>
            <span className={`text-2xl sm:text-3xl font-black block leading-tight ${totalPendingUSD > 0 ? 'text-stone-100' : 'text-stone-500'}`}>
              {formatUSD(totalPendingUSD)}
            </span>
          </div>
          <span className="text-xs font-bold text-stone-500 block">
            {formatVES(totalPendingUSD, rateVES)}
          </span>
        </div>
      </div>

      {/* ── Filtros + Vista ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 border-b border-stone-800 pb-3">
        {/* Status filter tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {filterTabs.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              className={`px-3 sm:px-4 py-2 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all ${
                filterStatus === key
                  ? 'bg-stone-700 text-stone-100 border border-stone-600'
                  : 'bg-transparent text-stone-400 hover:text-stone-100 border border-transparent'
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>

        {/* View mode switcher */}
        <div className="flex items-center gap-1 bg-stone-900 p-1 rounded-xl border border-stone-800 self-start sm:self-auto">
          {(['GROUPED', 'INDIVIDUAL'] as const).map((mode) => {
            const Icon  = mode === 'GROUPED' ? Layers : ListFilter;
            const label = mode === 'GROUPED' ? 'Por cliente' : 'Individual';
            return (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all ${
                  viewMode === mode
                    ? 'bg-stone-700 text-stone-100 border border-stone-600'
                    : 'text-stone-400 hover:text-stone-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════ */}
      {/* MODO AGRUPADO                                           */}
      {/* ════════════════════════════════════════════════════════ */}
      {viewMode === 'GROUPED' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {groupedClients.length === 0 ? (
            <div className="col-span-full py-12 text-center text-stone-500 bg-stone-900 wabi-card space-y-1">
              <p className="font-bold text-stone-400">No hay registros en este filtro.</p>
              <p className="text-xs text-stone-600">Las ventas fiadas aparecerán aquí automáticamente.</p>
            </div>
          ) : (
            groupedClients.map((grouped) => {
              const isExpanded = expandedClientIds.includes(grouped.client_id);
              const isPaid     = grouped.is_all_paid;

              return (
                <div
                  key={grouped.client_id}
                  className={`wabi-card p-4 sm:p-5 flex flex-col space-y-3 sm:space-y-4 bg-stone-900 transition-all ${
                    isPaid ? 'opacity-60 border-stone-800' : 'border-[#D4AF37]/30 hover:border-[#D4AF37]/60'
                  }`}
                >
                  {/* Cabecera: nombre + badge estado */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-stone-800 border border-stone-700 text-stone-400 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-extrabold text-stone-100 text-base leading-tight truncate">
                          {grouped.client_name}
                        </h3>
                        <span className="text-xs text-stone-500 font-mono block truncate">
                          {grouped.whatsapp_number || 'Sin teléfono'}
                        </span>
                      </div>
                    </div>

                    <span className={`text-[10px] sm:text-[11px] font-black px-2.5 py-1 rounded-lg border shrink-0 ${
                      isPaid
                        ? 'text-stone-400 border-stone-700'
                        : 'text-stone-200 border-[#D4AF37]/40 font-black'
                    }`}>
                      {isPaid ? 'Al día' : `${grouped.pending_count} pend.`}
                    </span>
                  </div>

                  {/* Fecha de cobro */}
                  {!isPaid && (
                    <div className="flex items-center gap-1.5 text-xs text-stone-400 font-semibold">
                      <Calendar className="w-3.5 h-3.5 text-stone-500" />
                      Cobro asignado: <strong className="text-stone-200">{grouped.earliest_due_date}</strong>
                    </div>
                  )}

                  {/* Caja de monto consolidado */}
                  <div className="bg-stone-950 p-3.5 sm:p-4 rounded-xl border border-stone-800 space-y-2">
                    <div className="flex items-baseline justify-between">
                      <div>
                        <span className="text-[10px] sm:text-xs font-bold text-stone-500 uppercase tracking-wider block">
                          Deuda Total
                        </span>
                        <span className={`text-2xl sm:text-3xl font-black ${isPaid ? 'text-stone-500 line-through' : 'text-stone-100'}`}>
                          {formatUSD(grouped.total_usd)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] sm:text-xs font-bold text-stone-500 uppercase tracking-wider block">
                          Cobro Hoy (VES)
                        </span>
                        <span className="text-sm sm:text-base font-bold text-stone-300">
                          {formatVES(grouped.total_usd, rateVES)}
                        </span>
                      </div>
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-stone-500 flex justify-between pt-2 border-t border-stone-900">
                      <span>{grouped.debts.length} compra{grouped.debts.length !== 1 ? 's' : ''}</span>
                      <span>1 $ = {rateVES.toFixed(2)} Bs</span>
                    </div>
                  </div>

                  {/* Acciones */}
                  {!isPaid && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          onClick={() => handleOpenGroupedWhatsAppReminder(grouped)}
                          className="py-3 px-3 bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-100 font-black rounded-2xl text-xs flex items-center justify-center gap-1.5 transition-all touch-target-lg"
                        >
                          <MessageSquare className="w-4 h-4" /> Por WhatsApp
                        </button>

                        <button
                          onClick={() => {
                            setSelectedGroupedForPayment(grouped);
                            setPaymentAmountUSD(grouped.total_usd.toString());
                          }}
                          className="py-3 px-3 bg-amber-800 hover:bg-amber-700 border-2 border-[#D4AF37] text-stone-100 font-black rounded-2xl text-xs flex items-center justify-center gap-1.5 transition-all touch-target-lg"
                        >
                          <CheckCircle className="w-4 h-4" /> Cobrar / Abono
                        </button>
                      </div>

                      <button
                        onClick={() => handlePayAllForGroupedClient(grouped)}
                        className="w-full py-2.5 bg-transparent hover:bg-stone-800 border border-stone-700 text-stone-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all touch-target-lg"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Liquidar todo ({formatUSD(grouped.total_usd)}) en 1 clic
                      </button>
                    </div>
                  )}

                  {/* Acordeón desglose */}
                  <button
                    onClick={() => toggleExpandClient(grouped.client_id)}
                    className="w-full py-2 px-3 bg-stone-950 hover:bg-stone-800 text-stone-400 font-bold text-xs rounded-xl flex items-center justify-between border border-stone-800 transition-colors"
                  >
                    <span>{isExpanded ? 'Ocultar desglose' : `Ver ${grouped.debts.length} compras en detalle`}</span>
                    {isExpanded
                      ? <ChevronUp className="w-4 h-4" />
                      : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {isExpanded && (
                    <div className="space-y-2 border-t border-stone-800 pt-3">
                      {grouped.debts.map((itemDebt) => (
                        <div
                          key={itemDebt.id}
                          className="bg-stone-950 p-3 rounded-xl border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                        >
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[11px] font-mono text-stone-500">
                                {new Date(itemDebt.created_at).toLocaleDateString('es-VE')}
                              </span>
                              <StatusBadge status={itemDebt.status as 'PAID' | 'PARTIAL' | 'PENDING'} />
                            </div>
                            <p className="text-xs font-semibold text-stone-200 leading-tight">
                              {itemDebt.notes || 'Compra fiada'}
                            </p>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-stone-900">
                            <div className="text-left sm:text-right">
                              <span className={`text-sm font-black ${itemDebt.status === 'PAID' ? 'text-stone-500 line-through' : 'text-stone-100'}`}>
                                {formatUSD(itemDebt.amount_usd)}
                              </span>
                              <span className="text-[10px] text-stone-500 block">
                                {formatVES(itemDebt.amount_usd, rateVES)}
                              </span>
                            </div>
                            {itemDebt.status !== 'PAID' && (
                              <button
                                onClick={() => { setSelectedDebtForPayment(itemDebt); setPaymentAmountUSD(itemDebt.amount_usd.toString()); }}
                                className="px-3 py-1.5 bg-transparent hover:bg-stone-800 text-stone-300 font-bold text-xs rounded-lg border border-stone-700 transition-colors"
                              >
                                Cobrar
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════ */}
      {/* MODO INDIVIDUAL                                         */}
      {/* ════════════════════════════════════════════════════════ */}
      {viewMode === 'INDIVIDUAL' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filteredDebts.length === 0 ? (
            <div className="col-span-full py-12 text-center text-stone-500 bg-stone-900 wabi-card">
              <p className="font-bold text-stone-400">No hay registros en este filtro.</p>
            </div>
          ) : (
            filteredDebts.map((d) => {
              const isPaid = d.status === 'PAID';
              const client = clients.find((c) => c.id === d.client_id);
              return (
                <div
                  key={d.id}
                  className={`wabi-card p-4 sm:p-5 flex flex-col space-y-3 sm:space-y-4 bg-stone-900 transition-all ${
                    isPaid ? 'opacity-60 border-stone-800' : 'border-[#D4AF37]/30 hover:border-[#D4AF37]/60'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-xs font-bold text-stone-400 flex items-center gap-1 truncate">
                      <User className="w-3.5 h-3.5 shrink-0" /> {client?.full_name || d.client_name || 'Cliente'}
                    </span>
                    <StatusBadge status={d.status as 'PAID' | 'PARTIAL' | 'PENDING'} />
                  </div>

                  <div className="flex items-center justify-between text-xs text-stone-400 font-semibold">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-stone-500" />
                      Cobrar: <strong className="text-stone-200">{d.due_date}</strong>
                    </span>
                    <span className="text-stone-500 font-mono text-[11px]">
                      {new Date(d.created_at).toLocaleDateString('es-VE')}
                    </span>
                  </div>

                  <p className="text-xs text-stone-400 line-clamp-2 bg-stone-950 p-2 rounded-lg border border-stone-800">
                    {d.notes || 'Sin observaciones'}
                  </p>

                  <div className="border-t border-stone-800 pt-2.5 flex items-baseline justify-between">
                    <div>
                      <span className="text-[10px] sm:text-xs font-bold text-stone-500 block">Saldo USD</span>
                      <span className={`text-xl sm:text-2xl font-black ${isPaid ? 'text-stone-500 line-through' : 'text-stone-100'}`}>
                        {formatUSD(d.amount_usd)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] sm:text-xs font-bold text-stone-500 block">Cobro Hoy (VES)</span>
                      <span className="text-xs sm:text-sm font-bold text-stone-300">{formatVES(d.amount_usd, rateVES)}</span>
                    </div>
                  </div>

                  {!isPaid && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        onClick={() => handleOpenWhatsAppReminder(d)}
                        className="py-3 px-3 bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 font-bold rounded-2xl text-xs flex items-center justify-center gap-1.5 transition-all touch-target-lg"
                      >
                        <MessageSquare className="w-4 h-4" /> WhatsApp
                      </button>
                      <button
                        onClick={() => { setSelectedDebtForPayment(d); setPaymentAmountUSD(d.amount_usd.toString()); }}
                        className="py-3 px-3 bg-amber-800 hover:bg-amber-700 border-2 border-[#D4AF37] text-stone-100 font-black rounded-2xl text-xs flex items-center justify-center gap-1.5 transition-all touch-target-lg"
                      >
                        <CheckCircle className="w-4 h-4" /> Cobrar
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════ */}
      {/* MODAL 1: Pago Individual                               */}
      {/* ════════════════════════════════════════════════════════ */}
      {selectedDebtForPayment && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-stone-900 border-t-2 sm:border-2 border-[#D4AF37] rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg sm:text-xl font-bold text-stone-100 flex items-center gap-2 font-wabi">
              <DollarSign className="w-5 h-5 text-stone-400" /> Registrar Abono
            </h3>
            <p className="text-xs text-stone-400">
              Cliente: <strong className="text-stone-100">{selectedDebtForPayment.client_name}</strong>
              {' · '}Saldo: <strong>{formatUSD(selectedDebtForPayment.amount_usd)}</strong>
            </p>
            <div>
              <label className="text-xs font-bold text-stone-400 block mb-1">Monto a cobrar ($ USD)</label>
              <input
                type="number" step="0.01" max={selectedDebtForPayment.amount_usd}
                value={paymentAmountUSD}
                onChange={(e) => setPaymentAmountUSD(e.target.value)}
                className="w-full bg-stone-950 border border-stone-700 rounded-xl p-3.5 text-stone-100 font-black text-2xl focus:outline-none focus:border-amber-500 transition-colors"
              />
              <span className="text-xs font-bold text-stone-500 block mt-1">
                {formatVES(parseFloat(paymentAmountUSD) || 0, rateVES)}
              </span>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setSelectedDebtForPayment(null)}
                className="px-4 py-2.5 text-stone-400 hover:text-stone-100 font-bold text-sm border border-stone-700 rounded-xl hover:bg-stone-800 transition-all touch-target-lg">
                Cancelar
              </button>
              <button onClick={handleRegisterSinglePayment}
                className="px-6 py-3 bg-amber-800 hover:bg-amber-700 text-stone-100 font-black rounded-2xl text-sm border-2 border-[#D4AF37] transition-all touch-target-lg">
                Confirmar Pago
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════ */}
      {/* MODAL 2: Cobro Consolidado                             */}
      {/* ════════════════════════════════════════════════════════ */}
      {selectedGroupedForPayment && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-stone-900 border-t-2 sm:border-2 border-[#D4AF37] rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg sm:text-xl font-bold text-stone-100 flex items-center gap-2 font-wabi">
              <CheckCircle className="w-5 h-5 text-stone-400" /> Cobro Consolidado
            </h3>
            <p className="text-xs text-stone-400">
              <strong className="text-stone-100">{selectedGroupedForPayment.client_name}</strong>
              {' — '}{selectedGroupedForPayment.pending_count} compras {' · '}
              Total: <strong className="text-stone-100">{formatUSD(selectedGroupedForPayment.total_usd)}</strong>
            </p>
            <div>
              <label className="text-xs font-bold text-stone-400 block mb-1">Monto del abono ($ USD)</label>
              <input
                type="number" step="0.01" max={selectedGroupedForPayment.total_usd}
                value={paymentAmountUSD}
                onChange={(e) => setPaymentAmountUSD(e.target.value)}
                className="w-full bg-stone-950 border border-stone-700 rounded-xl p-3.5 text-stone-100 font-black text-2xl focus:outline-none focus:border-amber-500 transition-colors"
              />
              <span className="text-xs font-bold text-stone-500 block mt-1">
                {formatVES(parseFloat(paymentAmountUSD) || 0, rateVES)}
              </span>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => { handlePayAllForGroupedClient(selectedGroupedForPayment); setSelectedGroupedForPayment(null); }}
                className="w-full py-3.5 bg-amber-800 hover:bg-amber-700 border-2 border-[#D4AF37] text-stone-100 font-black rounded-2xl text-sm flex items-center justify-center gap-2 transition-all touch-target-lg"
              >
                <CheckCheck className="w-5 h-5" />
                Liquidar todo ({formatUSD(selectedGroupedForPayment.total_usd)}) en 1 clic
              </button>

              <button
                onClick={handleRegisterGroupedAbono}
                className="w-full py-3 bg-transparent hover:bg-stone-800 border border-stone-700 text-stone-200 font-bold rounded-xl text-sm transition-all touch-target-lg"
              >
                Confirmar Abono Parcial ({formatUSD(parseFloat(paymentAmountUSD) || 0)})
              </button>

              <button
                onClick={() => setSelectedGroupedForPayment(null)}
                className="w-full py-2.5 text-stone-500 hover:text-stone-300 font-bold text-xs transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
