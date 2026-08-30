'use client';

import React, { useState } from 'react';
import {
  Tag, Plus, Edit2, Trash2, CheckCircle2, XCircle, Sparkles, Send, Users, AlertTriangle, Percent, DollarSign, Gift
} from 'lucide-react';
import { Promotion, Product, Client, ProductCategory, PRODUCT_CATEGORIES } from '../../lib/types';
import { putToStore, deleteFromStore, addToSyncQueue } from '../../lib/db/indexeddb';
import { formatUSD } from '../../lib/bimonetary/exchangeRate';

interface PromotionsModuleProps {
  promotions: Promotion[];
  products: Product[];
  clients: Client[];
  onRefreshPromotions: () => void;
}

export const PromotionsModule: React.FC<PromotionsModuleProps> = ({
  promotions,
  products,
  clients,
  onRefreshPromotions,
}) => {
  const [showAddModal, setShowAddModal]       = useState(false);
  const [editingPromo, setEditingPromo]     = useState<Promotion | null>(null);
  
  // Form State
  const [title, setTitle]                     = useState('');
  const [description, setDescription]         = useState('');
  const [discountType, setDiscountType]       = useState<'PERCENTAGE' | 'FIXED_USD' | 'SPECIAL_PRICE'>('PERCENTAGE');
  const [discountValue, setDiscountValue]     = useState<string>('15');
  const [targetType, setTargetType]           = useState<'ALL' | 'CATEGORY' | 'PRODUCT'>('ALL');
  const [targetId, setTargetId]               = useState<string>('');
  const [badgeText, setBadgeText]             = useState<string>('15% OFF');
  const [isActive, setIsActive]               = useState<boolean>(true);
  const [errorMsg, setErrorMsg]               = useState<string | null>(null);

  // Broadcast Modal State
  const [broadcastPromo, setBroadcastPromo]   = useState<Promotion | null>(null);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);

  const handleOpenAddModal = () => {
    setEditingPromo(null);
    setTitle('');
    setDescription('');
    setDiscountType('PERCENTAGE');
    setDiscountValue('15');
    setTargetType('ALL');
    setTargetId('');
    setBadgeText('15% OFF');
    setIsActive(true);
    setErrorMsg(null);
    setShowAddModal(true);
  };

  const handleOpenEditModal = (promo: Promotion) => {
    setEditingPromo(promo);
    setTitle(promo.title);
    setDescription(promo.description);
    setDiscountType(promo.discount_type);
    setDiscountValue(promo.discount_value.toString());
    setTargetType(promo.target_type);
    setTargetId(promo.target_id || '');
    setBadgeText(promo.badge_text || '');
    setIsActive(promo.is_active);
    setErrorMsg(null);
    setShowAddModal(true);
  };

  const handleSavePromo = async () => {
    if (!title.trim() || !description.trim()) {
      setErrorMsg('Por favor ingresa el título y la descripción de la promoción.');
      return;
    }

    const val = parseFloat(discountValue);
    if (isNaN(val) || val <= 0) {
      setErrorMsg('Ingresa un valor de descuento válido mayor a cero.');
      return;
    }

    const promoData: Promotion = {
      id: editingPromo ? editingPromo.id : 'promo-' + Date.now(),
      title: title.trim(),
      description: description.trim(),
      discount_type: discountType,
      discount_value: val,
      target_type: targetType,
      target_id: targetType !== 'ALL' ? targetId : undefined,
      badge_text: badgeText.trim() || (discountType === 'PERCENTAGE' ? `${val}% OFF` : 'OFERTA'),
      is_active: isActive,
      created_at: editingPromo ? editingPromo.created_at : new Date().toISOString(),
    };

    await putToStore('promotions', promoData);
    await addToSyncQueue({
      table_name: 'promotions',
      action: editingPromo ? 'UPDATE' : 'INSERT',
      data: promoData,
    });

    onRefreshPromotions();
    setShowAddModal(false);
  };

  const handleToggleActive = async (promo: Promotion) => {
    const updated: Promotion = { ...promo, is_active: !promo.is_active };
    await putToStore('promotions', updated);
    await addToSyncQueue({ table_name: 'promotions', action: 'UPDATE', data: updated });
    onRefreshPromotions();
  };

  const handleDeletePromo = async (promoId: string) => {
    if (window.confirm('¿Deseas eliminar esta promoción permanentemente?')) {
      await deleteFromStore('promotions', promoId);
      await addToSyncQueue({ table_name: 'promotions', action: 'DELETE', data: { id: promoId } });
      onRefreshPromotions();
    }
  };

  const handleOpenBroadcastModal = (promo: Promotion) => {
    setBroadcastPromo(promo);
    setSelectedClients(clients.map((c) => c.id)); // Seleccionar todos por defecto
  };

  const handleSendBroadcastWhatsApp = (client: Client) => {
    if (!broadcastPromo) return;
    const cleanPhone = client.whatsapp_number.replace(/[^\d+]/g, '');

    let discountStr = '';
    if (broadcastPromo.discount_type === 'PERCENTAGE') {
      discountStr = `${broadcastPromo.discount_value}% de Descuento`;
    } else if (broadcastPromo.discount_type === 'FIXED_USD') {
      discountStr = `$${broadcastPromo.discount_value} USD de Descuento`;
    } else {
      discountStr = `Precio Especial $${broadcastPromo.discount_value} USD`;
    }

    const msg = `¡Hola ${client.full_name}! 🎁 Te escribo de SeleShop para compartirte una promoción especial que tengo para ti:\n\n🔥 *${broadcastPromo.title.toUpperCase()}*\n✨ ${broadcastPromo.description}\n🏷️ *Oferta:* ${discountStr}\n\n¡Quedo a tu orden si deseas aprovecharla hoy mismo! 🛍️`;
    window.open(`https://wa.me/${cleanPhone.replace('+', '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="pb-32 max-w-7xl mx-auto px-3 sm:px-4 pt-3 sm:pt-4 space-y-4 sm:space-y-5">

      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-stone-100 font-wabi flex items-center gap-2">
            <Tag className="w-6 h-6 text-amber-400" />
            Promociones y Difusión por WhatsApp
          </h2>
          <p className="text-xs sm:text-sm text-stone-400 mt-0.5">
            Crea ofertas especiales, aplícalas al punto de venta y envíalas a tus clientes del directorio.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2">
          <button
            onClick={() => {
              setEditingPromo(null);
              setTitle('¡Llegaron Papas y Tostón!');
              setDescription('Notificación especial: Acaba de llegar mercancía fresca de Papas Fritas y Tostón crujiente a SeleShop.');
              setDiscountType('PERCENTAGE');
              setDiscountValue('10');
              setTargetType('ALL');
              setTargetId('');
              setBadgeText('RECIÉN LLEGADO 🥔');
              setIsActive(true);
              setErrorMsg(null);
              setShowAddModal(true);
            }}
            className="w-full sm:w-auto py-3 px-4 bg-amber-950/60 hover:bg-amber-900/60 border-2 border-amber-500/70 text-amber-300 font-bold rounded-2xl flex items-center justify-center gap-2 transition-all touch-target-lg shadow-md"
          >
            <Sparkles className="w-5 h-5 text-amber-400" /> 🥔 Notificar Papas y Tostón
          </button>

          <button
            onClick={handleOpenAddModal}
            className="w-full sm:w-auto py-3 px-5 sm:px-6 bg-amber-800 hover:bg-amber-700 border-2 border-[#D4AF37] text-stone-100 font-black rounded-2xl flex items-center justify-center gap-2 transition-all touch-target-lg shadow-lg"
          >
            <Plus className="w-5 h-5" /> Nueva Promoción
          </button>
        </div>
      </div>

      {/* Grid de Tarjetas de Promociones */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {promotions.length === 0 ? (
          <div className="col-span-full py-12 text-center text-stone-500 bg-stone-900 wabi-card space-y-2">
            <Gift className="w-10 h-10 mx-auto text-stone-700" />
            <p className="font-bold text-stone-400 text-base">No hay promociones registradas aún.</p>
            <p className="text-xs">Crea tu primera promoción para atraer clientes y ofrecer descuentos.</p>
          </div>
        ) : (
          promotions.map((promo) => {
            let targetLabel = 'Todo el Catálogo';
            if (promo.target_type === 'CATEGORY') {
              targetLabel = `Categoría: ${promo.target_id}`;
            } else if (promo.target_type === 'PRODUCT') {
              const matched = products.find((p) => p.id === promo.target_id);
              targetLabel = matched ? `Producto: ${matched.name}` : 'Producto Específico';
            }

            return (
              <div
                key={promo.id}
                className={`wabi-card p-5 flex flex-col justify-between space-y-4 bg-stone-900 transition-all ${
                  promo.is_active
                    ? 'border-[#D4AF37]/50 shadow-lg shadow-amber-950/20'
                    : 'border-stone-800 opacity-70'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-amber-400 text-stone-950 font-black text-xs rounded-full shadow">
                        {promo.badge_text || 'OFERTA'}
                      </span>
                      {promo.is_active ? (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-800/40">
                          <CheckCircle2 className="w-3 h-3" /> Activa
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-stone-400 bg-stone-950/60 px-2 py-0.5 rounded-md border border-stone-800">
                          <XCircle className="w-3 h-3" /> Inactiva
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditModal(promo)}
                        className="p-1.5 text-stone-400 hover:text-stone-100 hover:bg-stone-800 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeletePromo(promo.id)}
                        className="p-1.5 text-stone-400 hover:text-[#C0392B] hover:bg-stone-800 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-lg font-black text-stone-100 mt-1 leading-snug">
                    {promo.title}
                  </h3>

                  <p className="text-xs text-stone-400 mt-1 leading-relaxed">
                    {promo.description}
                  </p>

                  <div className="mt-3 pt-3 border-t border-stone-800 space-y-1 text-xs">
                    <div className="flex justify-between text-stone-300">
                      <span className="text-stone-500 font-semibold">Tipo Descuento:</span>
                      <span className="font-bold text-amber-300">
                        {promo.discount_type === 'PERCENTAGE' && `${promo.discount_value}% Descuento`}
                        {promo.discount_type === 'FIXED_USD' && `$${promo.discount_value} USD Menos`}
                        {promo.discount_type === 'SPECIAL_PRICE' && `Precio $${promo.discount_value} USD`}
                      </span>
                    </div>

                    <div className="flex justify-between text-stone-300">
                      <span className="text-stone-500 font-semibold">Aplica a:</span>
                      <span className="font-semibold text-stone-300 truncate max-w-[180px]">
                        {targetLabel}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Acciones de la Tarjeta */}
                <div className="space-y-2 pt-2 border-t border-stone-800">
                  <button
                    onClick={() => handleOpenBroadcastModal(promo)}
                    disabled={!promo.is_active}
                    className="w-full py-2.5 px-4 bg-amber-800 hover:bg-amber-700 border border-[#D4AF37] text-stone-100 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                  >
                    <Send className="w-4 h-4" /> Difundir por WhatsApp ({clients.length})
                  </button>

                  <button
                    onClick={() => handleToggleActive(promo)}
                    className={`w-full py-2 px-3 text-xs font-semibold rounded-xl border transition-colors ${
                      promo.is_active
                        ? 'border-stone-700 text-stone-400 hover:bg-stone-800'
                        : 'border-emerald-800 text-emerald-300 hover:bg-emerald-950/40'
                    }`}
                  >
                    {promo.is_active ? 'Pausar Promoción' : 'Activar Promoción'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Agregar / Editar Promoción */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-stone-900 border-2 border-[#D4AF37] rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto my-auto">
            <h3 className="text-lg font-bold text-stone-100 flex items-center gap-2 font-wabi">
              <Sparkles className="w-5 h-5 text-amber-400" />
              {editingPromo ? 'Editar Promoción' : 'Nueva Promoción'}
            </h3>

            {errorMsg && (
              <div className="border border-[#C0392B]/60 bg-[#C0392B]/10 text-stone-200 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#C0392B]" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-stone-400 block mb-1">Título de la Promoción *</label>
                <input
                  type="text"
                  placeholder="Ej. Oferta Choco-Viernes"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl p-3 text-stone-100 font-semibold focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-400 block mb-1">Descripción corta *</label>
                <textarea
                  placeholder="Ej. 20% de descuento en todos los chocolates de la tienda."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl p-3 text-stone-100 font-semibold focus:outline-none focus:border-amber-500 resize-none text-xs"
                />
              </div>

              {/* Tipo de Descuento */}
              <div>
                <label className="text-xs font-bold text-stone-400 block mb-1">Tipo de Oferta</label>
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as any)}
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl p-3 text-stone-100 font-semibold focus:outline-none focus:border-amber-500 text-xs"
                >
                  <option value="PERCENTAGE">Descuento Porcentual (%)</option>
                  <option value="FIXED_USD">Descuento en Monto Fijo ($ USD)</option>
                  <option value="SPECIAL_PRICE">Precio Especial Promocional ($ USD)</option>
                </select>
              </div>

              {/* Valor del Descuento */}
              <div>
                <label className="text-xs font-bold text-stone-400 block mb-1">
                  {discountType === 'PERCENTAGE' ? 'Porcentaje de Descuento (%)' : 'Valor en $ USD'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder={discountType === 'PERCENTAGE' ? '20' : '1.50'}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl p-3 text-stone-100 font-semibold focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Aplicar a */}
              <div>
                <label className="text-xs font-bold text-stone-400 block mb-1">Aplicar a</label>
                <select
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value as any)}
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl p-3 text-stone-100 font-semibold focus:outline-none focus:border-amber-500 text-xs"
                >
                  <option value="ALL">Todo el catálogo de productos</option>
                  <option value="CATEGORY">Una Categoría específica</option>
                  <option value="PRODUCT">Un Producto específico</option>
                </select>
              </div>

              {targetType === 'CATEGORY' && (
                <div>
                  <label className="text-xs font-bold text-stone-400 block mb-1">Seleccionar Categoría</label>
                  <select
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl p-3 text-stone-100 font-semibold focus:outline-none focus:border-amber-500 text-xs"
                  >
                    <option value="">-- Elige Categoría --</option>
                    {PRODUCT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              )}

              {targetType === 'PRODUCT' && (
                <div>
                  <label className="text-xs font-bold text-stone-400 block mb-1">Seleccionar Producto</label>
                  <select
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl p-3 text-stone-100 font-semibold focus:outline-none focus:border-amber-500 text-xs"
                  >
                    <option value="">-- Elige Producto --</option>
                    {products.map((prod) => (
                      <option key={prod.id} value={prod.id}>{prod.name} ({formatUSD(prod.price_usd)})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Etiqueta Badge */}
              <div>
                <label className="text-xs font-bold text-stone-400 block mb-1">Etiqueta de la Oferta (Badge)</label>
                <input
                  type="text"
                  placeholder="Ej. 20% OFF, 2x1, PROMO FIRESTORE"
                  value={badgeText}
                  onChange={(e) => setBadgeText(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl p-3 text-stone-100 font-semibold focus:outline-none focus:border-amber-500 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActiveCheck"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 accent-amber-500"
                />
                <label htmlFor="isActiveCheck" className="text-xs font-bold text-stone-300">
                  Activar promoción inmediatamente
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-stone-800">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2.5 text-stone-400 hover:text-stone-100 font-bold text-xs border border-stone-700 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePromo}
                className="px-6 py-2.5 bg-amber-800 hover:bg-amber-700 text-stone-100 font-bold text-xs rounded-xl border border-[#D4AF37]"
              >
                {editingPromo ? 'Guardar Cambios' : 'Crear Promoción'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Difundir por WhatsApp */}
      {broadcastPromo && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border-2 border-[#D4AF37] rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-2">
              <Send className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-bold text-stone-100">
                Difundir "{broadcastPromo.title}" por WhatsApp
              </h3>
            </div>

            <p className="text-xs text-stone-400">
              Haz clic en el botón de WhatsApp al lado de cada cliente de tu directorio para abrir el mensaje de la promoción con 1 solo toque:
            </p>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {clients.length === 0 ? (
                <p className="text-xs text-stone-500 py-4 text-center">No hay clientes registrados en el directorio.</p>
              ) : (
                clients.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-stone-950/60 rounded-xl border border-stone-800">
                    <div>
                      <span className="font-bold text-xs text-stone-100 block">{c.full_name}</span>
                      <span className="text-[11px] text-stone-400 font-mono">{c.whatsapp_number}</span>
                    </div>

                    <button
                      onClick={() => handleSendBroadcastWhatsApp(c)}
                      className="py-1.5 px-3 bg-amber-800 hover:bg-amber-700 text-stone-100 font-bold text-xs rounded-lg border border-amber-600 flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" /> Enviar
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setBroadcastPromo(null)}
                className="px-5 py-2 bg-stone-800 hover:bg-stone-750 text-stone-300 font-bold text-xs rounded-xl"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
