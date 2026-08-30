'use client';

import React, { useState } from 'react';
import {
  Users, UserPlus, Search, Phone, Edit2, Trash2,
  MessageSquare, AlertTriangle, ArrowUpDown, Tag, Send, Sparkles, SortAsc, SortDesc
} from 'lucide-react';
import { Client, Debt, Sale, ExchangeRate, Promotion } from '../../lib/types';
import { formatUSD, formatVES } from '../../lib/bimonetary/exchangeRate';
import { putToStore, deleteFromStore, addToSyncQueue } from '../../lib/db/indexeddb';

interface ClientsModuleProps {
  clients: Client[];
  debts: Debt[];
  sales: Sale[];
  promotions?: Promotion[];
  bcvRate: ExchangeRate | null;
  onRefreshClients: () => void;
}

type SortOption = 'ALPHA_ASC' | 'ALPHA_DESC' | 'DEBT_DESC' | 'SALES_DESC';

export const ClientsModule: React.FC<ClientsModuleProps> = ({
  clients,
  debts,
  sales,
  promotions = [],
  bcvRate,
  onRefreshClients,
}) => {
  const [searchQuery, setSearchQuery]       = useState('');
  const [sortMode, setSortMode]             = useState<SortOption>('ALPHA_ASC');
  const [showAddModal, setShowAddModal]     = useState(false);
  const [editingClient, setEditingClient]   = useState<Client | null>(null);
  const [fullName, setFullName]             = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [notes, setNotes]                   = useState('');
  const [errorMsg, setErrorMsg]             = useState<string | null>(null);

  // Modal para enviar promociones por WhatsApp
  const [promoModalClient, setPromoModalClient] = useState<Client | null>(null);
  const [selectedPromoId, setSelectedPromoId]   = useState<string>('');

  const rateVES = bcvRate ? bcvRate.rate_ves : 36.50;

  // 1. Filtrar
  const filtered = clients.filter(
    (c) =>
      c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.whatsapp_number.includes(searchQuery) ||
      (c.notes && c.notes.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Helper para calcular deuda total por cliente
  const getClientDebt = (clientId: string) => {
    return debts
      .filter((d) => d.client_id === clientId && d.status !== 'PAID')
      .reduce((sum, d) => sum + d.amount_usd, 0);
  };

  // Helper para calcular cantidad de compras por cliente
  const getClientSalesCount = (clientId: string) => {
    return sales.filter((s) => s.client_id === clientId).length;
  };

  // 2. Ordenar por modo elegido (Alfabético A-Z por defecto)
  const sortedClients = [...filtered].sort((a, b) => {
    if (sortMode === 'ALPHA_ASC') {
      return a.full_name.localeCompare(b.full_name, 'es', { sensitivity: 'base' });
    }
    if (sortMode === 'ALPHA_DESC') {
      return b.full_name.localeCompare(a.full_name, 'es', { sensitivity: 'base' });
    }
    if (sortMode === 'DEBT_DESC') {
      return getClientDebt(b.id) - getClientDebt(a.id);
    }
    if (sortMode === 'SALES_DESC') {
      return getClientSalesCount(b.id) - getClientSalesCount(a.id);
    }
    return 0;
  });

  // Agrupar por primera letra si está en orden alfabético A-Z
  const activePromos = promotions.filter((p) => p.is_active);

  const handleOpenAddModal = () => {
    setEditingClient(null);
    setFullName(''); setWhatsappNumber(''); setNotes(''); setErrorMsg(null);
    setShowAddModal(true);
  };

  const handleOpenEditModal = (client: Client) => {
    setEditingClient(client);
    setFullName(client.full_name);
    setWhatsappNumber(client.whatsapp_number);
    setNotes(client.notes || '');
    setErrorMsg(null);
    setShowAddModal(true);
  };

  const handleSaveClient = async () => {
    if (!fullName.trim() || !whatsappNumber.trim()) {
      setErrorMsg('Por favor ingresa el nombre completo y el número de WhatsApp.');
      return;
    }

    let phone = whatsappNumber.trim().replace(/\s+/g, '');
    if (!phone.startsWith('+')) {
      phone = phone.startsWith('0') ? '+58' + phone.substring(1) : '+58' + phone;
    }

    if (editingClient) {
      const updated: Client = { ...editingClient, full_name: fullName.trim(), whatsapp_number: phone, notes: notes.trim() };
      await putToStore('clients', updated);
      await addToSyncQueue({ table_name: 'clients', action: 'UPDATE', data: updated });
    } else {
      const newClient: Client = {
        id: 'client-' + Date.now(),
        full_name: fullName.trim(),
        whatsapp_number: phone,
        notes: notes.trim(),
        created_at: new Date().toISOString(),
      };
      await putToStore('clients', newClient);
      await addToSyncQueue({ table_name: 'clients', action: 'INSERT', data: newClient });
    }

    onRefreshClients();
    setShowAddModal(false);
  };

  const handleDeleteClient = async (clientId: string) => {
    if (window.confirm('¿Eliminar este cliente del directorio?')) {
      await deleteFromStore('clients', clientId);
      await addToSyncQueue({ table_name: 'clients', action: 'DELETE', data: { id: clientId } });
      onRefreshClients();
    }
  };

  const handleOpenWhatsAppChat = (client: Client, pendingDebtUSD: number) => {
    const cleanPhone = client.whatsapp_number.replace(/[^\d+]/g, '');
    const msg = pendingDebtUSD > 0
      ? `¡Hola ${client.full_name}! Espero que estés muy bien. Te escribo de SeleShop para recordarte tu saldo pendiente de ${formatUSD(pendingDebtUSD)} USD (${formatVES(pendingDebtUSD, rateVES)}). Quedo atenta a tu pago, ¡muchas gracias!`
      : `¡Hola ${client.full_name}! Te saludo de SeleShop. Quedo a tu orden para cualquier consulta.`;
    window.open(`https://wa.me/${cleanPhone.replace('+', '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleSendPromoWhatsApp = (client: Client, promoId: string) => {
    const promo = promotions.find((p) => p.id === promoId);
    if (!promo) return;

    const cleanPhone = client.whatsapp_number.replace(/[^\d+]/g, '');
    let discountStr = '';
    if (promo.discount_type === 'PERCENTAGE') {
      discountStr = `${promo.discount_value}% de Descuento`;
    } else if (promo.discount_type === 'FIXED_USD') {
      discountStr = `$${promo.discount_value} USD de Descuento`;
    } else {
      discountStr = `Precio Especial $${promo.discount_value} USD`;
    }

    const msg = `¡Hola ${client.full_name}! 🎁 Te escribo de SeleShop para compartirte una promoción especial que tengo para ti:\n\n🔥 *${promo.title.toUpperCase()}*\n✨ ${promo.description}\n🏷️ *Descuento:* ${discountStr}\n\n¡Quedo a tu orden si deseas aprovecharla hoy mismo! 🛍️`;
    window.open(`https://wa.me/${cleanPhone.replace('+', '')}?text=${encodeURIComponent(msg)}`, '_blank');
    setPromoModalClient(null);
  };

  // Obtener iniciales para las barras del directorio
  const getInitial = (name: string) => {
    const clean = name.trim().toUpperCase();
    return clean.length > 0 ? clean[0] : '#';
  };

  return (
    <div className="pb-32 max-w-7xl mx-auto px-3 sm:px-4 pt-3 sm:pt-4 space-y-4 sm:space-y-5">

      {/* ── Encabezado ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-stone-100 font-wabi flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" />
            Directorio Telefónico de Clientes
          </h2>
          <p className="text-xs sm:text-sm text-stone-400 mt-0.5">
            Ordenado alfabéticamente. Gestiona contactos, saldos y envía promociones por WhatsApp.
          </p>
        </div>

        {/* CTA principal */}
        <button
          onClick={handleOpenAddModal}
          className="w-full sm:w-auto py-3 px-5 sm:px-6 bg-amber-800 hover:bg-amber-700 border-2 border-[#D4AF37] text-stone-100 font-black rounded-2xl flex items-center justify-center gap-2 transition-all touch-target-lg shadow-lg"
        >
          <UserPlus className="w-5 h-5" /> Registrar Cliente
        </button>
      </div>

      {/* ── Controles: Búsqueda + Selector de Orden ────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="relative sm:col-span-8">
          <Search className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono o notas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-stone-900 border-2 border-stone-700 rounded-2xl pl-11 sm:pl-12 pr-4 py-3 text-stone-100 text-base font-bold focus:outline-none focus:border-amber-500 placeholder:text-stone-500 transition-colors shadow-inner"
          />
        </div>

        {/* Control de Ordenamiento */}
        <div className="sm:col-span-4 relative flex items-center">
          <ArrowUpDown className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400 pointer-events-none" />
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortOption)}
            className="w-full bg-stone-900 border-2 border-stone-700 rounded-2xl pl-10 pr-8 py-3 text-stone-200 text-xs font-extrabold focus:outline-none focus:border-amber-500 transition-colors cursor-pointer appearance-none shadow-inner"
          >
            <option value="ALPHA_ASC">🔤 Nombre (A - Z)</option>
            <option value="ALPHA_DESC">🔤 Nombre (Z - A)</option>
            <option value="DEBT_DESC">💰 Mayor Deuda Pendiente</option>
            <option value="SALES_DESC">🛒 Más Compras Realizadas</option>
          </select>
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400 text-xs">▼</div>
        </div>
      </div>

      {/* ── Badge Informativo del Orden Actual ────────────────────── */}
      <div className="flex items-center justify-between text-xs text-stone-400 bg-stone-900/60 px-4 py-2 rounded-xl border border-stone-800/80">
        <span className="flex items-center gap-1.5 font-semibold">
          {sortMode === 'ALPHA_ASC' && <SortAsc className="w-4 h-4 text-amber-400" />}
          {sortMode === 'ALPHA_DESC' && <SortDesc className="w-4 h-4 text-amber-400" />}
          {(sortMode === 'DEBT_DESC' || sortMode === 'SALES_DESC') && <ArrowUpDown className="w-4 h-4 text-amber-400" />}
          <span>
            {sortMode === 'ALPHA_ASC' && 'Orden alfabético ascendente (A-Z)'}
            {sortMode === 'ALPHA_DESC' && 'Orden alfabético descendente (Z-A)'}
            {sortMode === 'DEBT_DESC' && 'Ordenado por mayor deuda acumulada'}
            {sortMode === 'SALES_DESC' && 'Ordenado por mayor número de compras'}
          </span>
        </span>
        <span className="font-bold text-amber-300 bg-amber-950/60 border border-amber-800/40 px-2.5 py-0.5 rounded-full">
          {sortedClients.length} cliente{sortedClients.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Grid de tarjetas de clientes con separadores alfabéticos ────────────────────────── */}
      <div className="space-y-4">
        {sortedClients.length === 0 ? (
          <div className="py-12 text-center text-stone-500 bg-stone-900 wabi-card space-y-1">
            <Users className="w-8 h-8 mx-auto mb-3 text-stone-700" />
            <p className="font-bold text-stone-400">No se encontraron clientes en el directorio.</p>
            <p className="text-xs">Presiona "Registrar Cliente" para agregar al directorio.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {sortedClients.map((client, index) => {
              const pendingDebtUSD = getClientDebt(client.id);
              const clientSalesCount = getClientSalesCount(client.id);
              const hasDebt = pendingDebtUSD > 0;

              // Mostrar cabecera alfabética si el modo es A-Z y cambia la letra inicial
              const currentInitial = getInitial(client.full_name);
              const prevInitial = index > 0 ? getInitial(sortedClients[index - 1].full_name) : null;
              const showAlphabetHeader = sortMode === 'ALPHA_ASC' && currentInitial !== prevInitial;

              return (
                <React.Fragment key={client.id}>
                  {showAlphabetHeader && (
                    <div className="col-span-full pt-2 flex items-center gap-3">
                      <span className="alphabet-badge w-8 h-8 rounded-xl bg-amber-800 border border-[#D4AF37]/50 text-white font-black text-sm flex items-center justify-center shadow">
                        {currentInitial}
                      </span>
                      <div className="h-0.5 flex-1 bg-stone-800/80 rounded-full" />
                    </div>
                  )}

                  <div
                    className={`wabi-card p-4 sm:p-5 flex flex-col justify-between space-y-3 sm:space-y-4 bg-stone-900 transition-all ${
                      hasDebt ? 'border-[#D4AF37]/40 shadow-amber-950/20' : 'border-stone-800 hover:border-stone-700'
                    }`}
                  >
                    <div>
                      {/* Nombre + Avatar de Inicial + botones de acción */}
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2.5 pr-2">
                          <div className="w-9 h-9 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center text-amber-400 font-extrabold text-sm shrink-0">
                            {getInitial(client.full_name)}
                          </div>
                          <div>
                            <h3 className="text-base font-extrabold text-stone-100 leading-tight">
                              {client.full_name}
                            </h3>
                            <span className="text-[10px] text-stone-400 font-medium">
                              {clientSalesCount} compra{clientSalesCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleOpenEditModal(client)}
                            className="p-2 text-stone-400 hover:text-stone-100 hover:bg-stone-800 rounded-lg transition-colors touch-target-lg flex items-center justify-center"
                            title="Editar cliente"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClient(client.id)}
                            className="p-2 text-stone-400 hover:text-[#C0392B] hover:bg-stone-800 rounded-lg transition-colors touch-target-lg flex items-center justify-center"
                            title="Eliminar cliente"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Teléfono */}
                      <div className="flex items-center gap-2 text-stone-300 text-sm font-semibold mb-2 bg-stone-950/60 p-2 rounded-xl border border-stone-800/70">
                        <Phone className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="font-mono text-xs">{client.whatsapp_number}</span>
                      </div>

                      {client.notes && (
                        <p className="text-xs text-stone-400 bg-stone-950 p-2.5 rounded-xl border border-stone-800">
                          {client.notes}
                        </p>
                      )}
                    </div>

                    {/* Deuda pendiente */}
                    <div className="border-t border-stone-800/80 pt-2.5 space-y-1">
                      <div className="flex justify-between items-baseline">
                        <span className="text-stone-500 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                          Deuda pendiente
                        </span>
                        <span className={`text-xl font-black ${hasDebt ? 'text-stone-100' : 'text-stone-400'}`}>
                          {hasDebt ? formatUSD(pendingDebtUSD) : 'Sin deudas'}
                        </span>
                      </div>
                      {hasDebt && (
                        <div className="flex justify-between items-baseline">
                          <span className="text-stone-500 text-[11px]">VES hoy:</span>
                          <span className="text-xs font-bold text-stone-300">{formatVES(pendingDebtUSD, rateVES)}</span>
                        </div>
                      )}
                    </div>

                    {/* Botones de Acción WhatsApp */}
                    <div className="space-y-2 pt-1">
                      <button
                        onClick={() => handleOpenWhatsAppChat(client, pendingDebtUSD)}
                        className={`w-full py-2.5 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all touch-target-lg ${
                          hasDebt
                            ? 'bg-amber-800 hover:bg-amber-700 border-2 border-[#D4AF37] text-stone-100'
                            : 'bg-stone-800 hover:bg-stone-750 border border-stone-700 text-stone-200'
                        }`}
                      >
                        <MessageSquare className="w-4 h-4" />
                        {hasDebt ? 'Recordar cobro por WhatsApp' : 'Abrir chat de WhatsApp'}
                      </button>

                      {/* Botón de Promoción WhatsApp */}
                      {activePromos.length > 0 && (
                        <button
                          onClick={() => {
                            setPromoModalClient(client);
                            setSelectedPromoId(activePromos[0].id);
                          }}
                          className="w-full py-2 px-3 bg-amber-950/40 hover:bg-amber-900/40 border border-amber-800/50 text-amber-300 font-bold text-[11px] rounded-xl flex items-center justify-center gap-1.5 transition-all touch-target-lg"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          <span>Enviar Promoción por WhatsApp</span>
                        </button>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modal Agregar / Editar Cliente ──────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-stone-900 border-t-2 sm:border-2 border-[#D4AF37] rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg sm:text-xl font-bold text-stone-100 flex items-center gap-2 font-wabi">
              <UserPlus className="w-5 h-5 text-amber-400" />
              {editingClient ? 'Editar Cliente' : 'Registrar Cliente en Directorio'}
            </h3>

            {errorMsg && (
              <div
                className="border border-[#C0392B]/60 text-stone-200 p-3 rounded-xl text-xs font-bold flex items-center gap-2"
                style={{ backgroundColor: 'rgba(192,57,43,0.12)' }}
              >
                <AlertTriangle className="w-4 h-4 shrink-0 text-[#C0392B]" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-stone-400 block mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  placeholder="Ej. Sra. Ana Gómez"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl p-3 text-stone-100 font-semibold focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-400 block mb-1">Número WhatsApp (+58) *</label>
                <input
                  type="tel"
                  placeholder="Ej. 04141234567"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl p-3 text-stone-100 font-semibold focus:outline-none focus:border-amber-500 transition-colors"
                />
                <p className="text-[11px] text-stone-500 mt-1">
                  Se formateará automáticamente con prefijo +58 para WhatsApp.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-400 block mb-1">Observaciones</label>
                <textarea
                  placeholder="Ej. Vecina de la esquina, paga los días 15"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl p-3 text-stone-100 font-semibold focus:outline-none focus:border-amber-500 transition-colors resize-none"
                />
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
                onClick={handleSaveClient}
                className="px-6 py-3 bg-amber-800 hover:bg-amber-700 text-stone-100 font-black rounded-2xl text-sm border-2 border-[#D4AF37] transition-all touch-target-lg"
              >
                {editingClient ? 'Actualizar' : 'Guardar Cliente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Enviar Promoción WhatsApp ──────────────────────── */}
      {promoModalClient && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border-2 border-[#D4AF37] rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-bold text-stone-100">
                Enviar Promoción por WhatsApp
              </h3>
            </div>

            <p className="text-xs text-stone-400">
              Selecciona la promoción activa que deseas enviar a <strong className="text-stone-200">{promoModalClient.full_name}</strong> ({promoModalClient.whatsapp_number}):
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {activePromos.map((promo) => (
                <label
                  key={promo.id}
                  className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                    selectedPromoId === promo.id
                      ? 'bg-amber-950/60 border-[#D4AF37] text-stone-100'
                      : 'bg-stone-950/50 border-stone-800 hover:border-stone-700 text-stone-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="selectedPromo"
                    value={promo.id}
                    checked={selectedPromoId === promo.id}
                    onChange={() => setSelectedPromoId(promo.id)}
                    className="mt-1 accent-amber-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-stone-100">{promo.title}</span>
                      <span className="text-[10px] bg-amber-400 text-stone-950 font-black px-2 py-0.5 rounded-full">
                        {promo.badge_text || 'PROMO'}
                      </span>
                    </div>
                    <p className="text-xs text-stone-400 mt-0.5">{promo.description}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setPromoModalClient(null)}
                className="px-4 py-2.5 text-stone-400 hover:text-stone-100 font-bold text-xs border border-stone-700 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleSendPromoWhatsApp(promoModalClient, selectedPromoId)}
                disabled={!selectedPromoId}
                className="px-5 py-2.5 bg-amber-800 hover:bg-amber-700 text-stone-100 font-bold text-xs rounded-xl border border-[#D4AF37] flex items-center gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" /> Enviar por WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
