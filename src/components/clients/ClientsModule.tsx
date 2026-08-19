'use client';

import React, { useState } from 'react';
import {
  Users, UserPlus, Search, Phone, Edit2, Trash2,
  MessageSquare, AlertTriangle,
} from 'lucide-react';
import { Client, Debt, Sale, ExchangeRate } from '../../lib/types';
import { formatUSD, formatVES } from '../../lib/bimonetary/exchangeRate';
import { putToStore, deleteFromStore, addToSyncQueue } from '../../lib/db/indexeddb';

interface ClientsModuleProps {
  clients: Client[];
  debts: Debt[];
  sales: Sale[];
  bcvRate: ExchangeRate | null;
  onRefreshClients: () => void;
}

export const ClientsModule: React.FC<ClientsModuleProps> = ({
  clients,
  debts,
  sales,
  bcvRate,
  onRefreshClients,
}) => {
  const [searchQuery, setSearchQuery]       = useState('');
  const [showAddModal, setShowAddModal]     = useState(false);
  const [editingClient, setEditingClient]   = useState<Client | null>(null);
  const [fullName, setFullName]             = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [notes, setNotes]                   = useState('');
  const [errorMsg, setErrorMsg]             = useState<string | null>(null);

  const rateVES = bcvRate ? bcvRate.rate_ves : 36.50;

  const filteredClients = clients.filter(
    (c) =>
      c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.whatsapp_number.includes(searchQuery) ||
      (c.notes && c.notes.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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
      ? `Hola ${client.full_name}, espero que estés muy bien. Te escribimos de SeleShop para recordar tu saldo pendiente de ${formatUSD(pendingDebtUSD)} USD (${formatVES(pendingDebtUSD, rateVES)}). Agradecemos mucho tu pago.`
      : `Hola ${client.full_name}, te saludamos desde SeleShop.`;
    window.open(`https://wa.me/${cleanPhone.replace('+', '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="pb-32 max-w-7xl mx-auto px-3 sm:px-4 pt-3 sm:pt-4 space-y-4 sm:space-y-5">

      {/* ── Encabezado ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-stone-100 font-wabi flex items-center gap-2">
            <Users className="w-5 h-5 text-stone-400" />
            Directorio de Clientes
          </h2>
          <p className="text-xs sm:text-sm text-stone-400 mt-0.5">
            Saldos pendientes, historial y contacto directo por WhatsApp.
          </p>
        </div>

        {/* CTA principal */}
        <button
          onClick={handleOpenAddModal}
          className="w-full sm:w-auto py-3 px-5 sm:px-6 bg-amber-800 hover:bg-amber-700 border-2 border-[#D4AF37] text-stone-100 font-black rounded-2xl flex items-center justify-center gap-2 transition-all touch-target-lg"
        >
          <UserPlus className="w-5 h-5" /> Registrar Cliente
        </button>
      </div>

      {/* ── Búsqueda ────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
        <input
          type="text"
          placeholder="Buscar por nombre, teléfono o notas..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-stone-900 border-2 border-stone-700 rounded-2xl pl-11 sm:pl-12 pr-4 py-3 sm:py-3.5 text-stone-100 text-base sm:text-lg font-bold focus:outline-none focus:border-amber-500 placeholder:text-stone-500 transition-colors"
        />
      </div>

      {/* ── Grid de tarjetas de clientes ────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {filteredClients.length === 0 ? (
          <div className="col-span-full py-12 text-center text-stone-500 bg-stone-900 wabi-card space-y-1">
            <Users className="w-8 h-8 mx-auto mb-3 text-stone-700" />
            <p className="font-bold text-stone-400">No se encontraron clientes.</p>
            <p className="text-xs">Presiona el botón para agregar al directorio.</p>
          </div>
        ) : (
          filteredClients.map((client) => {
            const clientDebts    = debts.filter((d) => d.client_id === client.id && d.status !== 'PAID');
            const pendingDebtUSD = clientDebts.reduce((sum, d) => sum + d.amount_usd, 0);
            const clientSales    = sales.filter((s) => s.client_id === client.id).length;
            const hasDebt        = pendingDebtUSD > 0;

            return (
              <div
                key={client.id}
                className={`wabi-card p-4 sm:p-5 flex flex-col justify-between space-y-3 sm:space-y-4 bg-stone-900 transition-all ${
                  hasDebt ? 'border-[#D4AF37]/30' : 'border-stone-800 hover:border-stone-700'
                }`}
              >
                <div>
                  {/* Nombre + botones de acción */}
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-base font-extrabold text-stone-100 leading-tight pr-2">
                      {client.full_name}
                    </h3>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenEditModal(client)}
                        className="p-2 text-stone-500 hover:text-stone-100 hover:bg-stone-800 rounded-lg transition-colors touch-target-lg flex items-center justify-center"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClient(client.id)}
                        className="p-2 text-stone-500 hover:text-[#C0392B] hover:bg-stone-800 rounded-lg transition-colors touch-target-lg flex items-center justify-center"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Teléfono */}
                  <div className="flex items-center gap-2 text-stone-400 text-sm font-semibold mb-2">
                    <Phone className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                    <span className="font-mono text-xs">{client.whatsapp_number}</span>
                  </div>

                  {client.notes && (
                    <p className="text-xs text-stone-500 bg-stone-950 p-2.5 rounded-xl border border-stone-800">
                      {client.notes}
                    </p>
                  )}
                </div>

                {/* Deuda pendiente */}
                <div className="border-t border-stone-800 pt-2.5 space-y-1">
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
                      <span className="text-stone-600 text-[11px]">VES hoy:</span>
                      <span className="text-xs font-bold text-stone-300">{formatVES(pendingDebtUSD, rateVES)}</span>
                    </div>
                  )}
                  <p className="text-[11px] text-stone-500 pt-0.5">
                    {clientSales} compra{clientSales !== 1 ? 's' : ''} realizadas
                  </p>
                </div>

                {/* WhatsApp */}
                <button
                  onClick={() => handleOpenWhatsAppChat(client, pendingDebtUSD)}
                  className={`w-full py-3 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all touch-target-lg ${
                    hasDebt
                      ? 'bg-amber-800 hover:bg-amber-700 border-2 border-[#D4AF37] text-stone-100'
                      : 'bg-transparent hover:bg-stone-800 border border-stone-700 text-stone-300'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  {hasDebt ? 'Recordar cobro por WhatsApp' : 'Abrir chat de WhatsApp'}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* ── Modal Agregar / Editar Cliente ──────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-stone-900 border-t-2 sm:border-2 border-[#D4AF37] rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg sm:text-xl font-bold text-stone-100 flex items-center gap-2 font-wabi">
              <UserPlus className="w-5 h-5 text-stone-400" />
              {editingClient ? 'Editar Cliente' : 'Registrar Cliente'}
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
                  Se formateará automáticamente con prefijo +58.
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
    </div>
  );
};
