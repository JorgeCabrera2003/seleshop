'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Minus, Trash2, CheckCircle2, User, UserPlus, CreditCard, DollarSign, AlertTriangle, Check, X, ShoppingBag } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Product, Client, Sale, SaleItem, Debt, ExchangeRate, PRODUCT_CATEGORIES } from '../../lib/types';
import { formatUSD, formatVES } from '../../lib/bimonetary/exchangeRate';
import { putToStore, addToSyncQueue, getNextPaymentDate } from '../../lib/db/indexeddb';

interface POSModuleProps {
  products: Product[];
  clients: Client[];
  bcvRate: ExchangeRate | null;
  onSaleComplete: () => void;
  onAddClient: (newClient: Client) => void;
}

export const POSModule: React.FC<POSModuleProps> = ({
  products, clients, bcvRate, onSaleComplete, onAddClient,
}) => {
  const [searchQuery, setSearchQuery]         = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('TODOS');
  const [cart, setCart]                       = useState<{ product: Product; quantity: number }[]>([]);
  const [paymentType, setPaymentType]         = useState<'CONTADO' | 'FIADO'>('CONTADO');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [newClientName, setNewClientName]     = useState('');
  const [newClientPhone, setNewClientPhone]   = useState('');
  const [newClientNotes, setNewClientNotes]   = useState('');
  const [errorMsg, setErrorMsg]               = useState<string | null>(null);
  const [isProcessing, setIsProcessing]       = useState(false);
  const [successAnimation, setSuccessAnimation] = useState(false);
  // Muestra/oculta el panel del carrito en móvil
  const [showCartPanel, setShowCartPanel]     = useState(false);

  const rateVES = bcvRate ? bcvRate.rate_ves : 36.50;

  const categories = React.useMemo(() => {
    const existing = Array.from(new Set(products.map((p) => p.category))).filter(Boolean);
    const sorted = PRODUCT_CATEGORIES.filter((c) => existing.includes(c));
    const remaining = existing.filter((c) => !PRODUCT_CATEGORIES.includes(c as any));
    return ['TODOS', ...sorted, ...remaining];
  }, [products]);

  const filteredProducts = products.filter((p) => {
    const matchesSearch   = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'TODOS' || p.category === selectedCategory;
    return matchesSearch && matchesCategory && p.is_active;
  });

  const filteredClients = clients.filter(
    (c) =>
      c.full_name.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
      c.whatsapp_number.includes(clientSearchQuery)
  );

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const totalUSD       = cart.reduce((sum, item) => sum + item.product.price_usd * item.quantity, 0);
  const totalItems     = cart.reduce((s, i) => s + i.quantity, 0);

  const addToCart = (product: Product) => {
    const existing    = cart.find((item) => item.product.id === product.id);
    const currentQty  = existing ? existing.quantity : 0;
    if (currentQty + 1 > product.stock_quantity) {
      setErrorMsg(`Sin stock suficiente para ${product.name} (${product.stock_quantity} disp.)`);
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }
    if (existing) {
      setCart(cart.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id !== productId) return item;
        const newQty = item.quantity + delta;
        if (newQty > item.product.stock_quantity) {
          setErrorMsg(`Stock máximo: ${item.product.stock_quantity}`);
          setTimeout(() => setErrorMsg(null), 2500);
          return item;
        }
        return newQty > 0 ? { ...item, quantity: newQty } : null;
      }).filter(Boolean) as { product: Product; quantity: number }[]
    );
  };

  const removeFromCart = (productId: string) =>
    setCart(cart.filter((item) => item.product.id !== productId));

  const handleCreateClient = async () => {
    if (!newClientName.trim() || !newClientPhone.trim()) {
      setErrorMsg('Nombre y teléfono son obligatorios.');
      return;
    }
    let phone = newClientPhone.trim().replace(/\s+/g, '');
    if (!phone.startsWith('+')) phone = phone.startsWith('0') ? '+58' + phone.substring(1) : '+58' + phone;

    const createdClient: Client = {
      id: 'client-' + Date.now(),
      full_name: newClientName.trim(),
      whatsapp_number: phone,
      notes: newClientNotes.trim(),
      created_at: new Date().toISOString(),
    };
    await putToStore('clients', createdClient);
    await addToSyncQueue({ table_name: 'clients', action: 'INSERT', data: createdClient });
    onAddClient(createdClient);
    setSelectedClientId(createdClient.id);
    setShowAddClientModal(false);
    setNewClientName(''); setNewClientPhone(''); setNewClientNotes('');
  };

  const handleCompleteSale = async () => {
    if (cart.length === 0) { setErrorMsg('El carrito está vacío.'); return; }
    if (paymentType === 'FIADO' && !selectedClientId) {
      setErrorMsg('Selecciona un cliente para venta fiada.');
      return;
    }
    setIsProcessing(true); setErrorMsg(null);
    try {
      const saleId    = 'sale-' + Date.now();
      const timestamp = new Date().toISOString();
      const saleRecord: Sale = {
        id: saleId,
        client_id: paymentType === 'FIADO' ? selectedClientId : null,
        client_name: paymentType === 'FIADO' ? selectedClient?.full_name : 'Venta de Contado',
        total_usd: totalUSD,
        rate_at_time: rateVES,
        sale_timestamp: timestamp,
        payment_type: paymentType,
      };
      await putToStore('sales', saleRecord);
      await addToSyncQueue({ table_name: 'sales', action: 'INSERT', data: saleRecord });

      for (const item of cart) {
        const saleItem: SaleItem = {
          id: 'item-' + Date.now() + '-' + item.product.id,
          sale_id: saleId, product_id: item.product.id,
          product_name: item.product.name, quantity: item.quantity,
          unit_price_usd: item.product.price_usd,
        };
        await putToStore('sale_items', saleItem);
        const updProd: Product = { ...item.product, stock_quantity: Math.max(0, item.product.stock_quantity - item.quantity), updated_at: timestamp };
        await putToStore('products', updProd);
        await addToSyncQueue({ table_name: 'products', action: 'UPDATE', data: updProd });
      }

      if (paymentType === 'FIADO' && selectedClientId) {
        const debtRecord: Debt = {
          id: 'debt-' + Date.now(),
          client_id: selectedClientId,
          client_name: selectedClient?.full_name || 'Cliente',
          whatsapp_number: selectedClient?.whatsapp_number,
          sale_id: saleId, amount_usd: totalUSD,
          due_date: getNextPaymentDate(), status: 'PENDING',
          notes: cart.map((i) => i.product.name).join(', '),
          created_at: timestamp,
        };
        await putToStore('debts', debtRecord);
        await addToSyncQueue({ table_name: 'debts', action: 'INSERT', data: debtRecord });
      }

      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      setSuccessAnimation(true);
      setTimeout(() => {
        setCart([]); setPaymentType('CONTADO'); setSelectedClientId('');
        setClientSearchQuery(''); setSuccessAnimation(false);
        setIsProcessing(false); setShowCartPanel(false);
        onSaleComplete();
      }, 1500);
    } catch (err) {
      console.error(err);
      setErrorMsg('Error al registrar la venta.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="pb-32 max-w-7xl mx-auto px-3 sm:px-4 pt-3 sm:pt-4 space-y-3 sm:space-y-4">

      {errorMsg && (
        <div className="bg-rose-900/60 border-2 border-rose-500 text-rose-100 p-3 rounded-2xl flex items-center gap-3 font-bold text-sm shadow-xl">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ── Búsqueda + Categorías ───────────────────────────────── */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
          <input
            type="text"
            placeholder="Buscar producto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-stone-900 border-2 border-stone-700 rounded-2xl pl-11 pr-4 py-3 text-stone-100 text-base font-bold focus:outline-none focus:border-amber-500 placeholder:text-stone-400 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-amber-800 text-stone-100 border border-[#D4AF37]/60 shadow-sm'
                  : 'bg-stone-900 border border-stone-700 text-stone-300 hover:bg-stone-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── Layout principal: catálogo izquierda / carrito derecha ─ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* ── Catálogo de productos ─────────────────────────────── */}
        <div className="lg:col-span-7 space-y-3">

          {/* Grid de productos: 2 columnas en móvil, 3 en md, 3 en lg */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            {filteredProducts.map((product) => {
              const inCart = cart.find((item) => item.product.id === product.id);
              const isOut  = product.stock_quantity <= 0;
              return (
                <div
                  key={product.id}
                  onClick={() => !isOut && addToCart(product)}
                  className={`relative wabi-card p-3 sm:p-4 flex flex-col justify-between cursor-pointer select-none ${
                    isOut
                      ? 'opacity-50 cursor-not-allowed border-stone-800'
                      : inCart
                      ? 'bg-stone-900 border-2 border-[#D4AF37] shadow-md ring-1 ring-[#D4AF37]/30'
                      : 'bg-stone-900 border border-stone-700 hover:border-stone-500'
                  }`}
                >
                  {inCart && (
                    <span className="absolute -top-2 -right-2 bg-amber-500 text-stone-950 font-black text-[10px] px-2 py-0.5 rounded-full shadow-md border border-stone-900">
                      x{inCart.quantity}
                    </span>
                  )}
                  <div>
                    <div className="flex justify-between items-start mb-1.5 gap-1">
                      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide leading-tight">{product.category}</span>
                      <span className={`text-[10px] font-black shrink-0 ${
                        isOut ? 'text-[#C0392B]' : product.stock_quantity <= 5 ? 'text-amber-400' : 'text-stone-400'
                      }`}>
                        {isOut ? 'Agotado' : `${product.stock_quantity}u`}
                      </span>
                    </div>
                    <h3 className="font-extrabold text-stone-100 text-sm leading-tight line-clamp-2 mb-2">{product.name}</h3>
                  </div>
                  <div className="pt-2 border-t border-stone-800 flex items-baseline justify-between gap-1">
                    <div>
                      <span className="text-base font-black text-amber-400 block leading-none">{formatUSD(product.price_usd)}</span>
                      <span className="text-[10px] font-bold text-stone-400">{formatVES(product.price_usd, rateVES)}</span>
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-amber-800/30 border border-[#D4AF37]/30 flex items-center justify-center shrink-0">
                      <Plus className="w-4 h-4 text-amber-300" />
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredProducts.length === 0 && (
              <div className="col-span-full py-10 text-center text-stone-500">
                <p className="font-bold text-stone-400 text-sm">Sin productos.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Carrito lateral (solo visible en lg+) ──────────────── */}
        <div className="hidden lg:block lg:col-span-5">
          <CartPanel
            cart={cart}
            rateVES={rateVES}
            totalUSD={totalUSD}
            paymentType={paymentType}
            setPaymentType={setPaymentType}
            selectedClient={selectedClient}
            selectedClientId={selectedClientId}
            setSelectedClientId={setSelectedClientId}
            clientSearchQuery={clientSearchQuery}
            setClientSearchQuery={setClientSearchQuery}
            filteredClients={filteredClients}
            updateQuantity={updateQuantity}
            removeFromCart={removeFromCart}
            setCart={setCart}
            handleCompleteSale={handleCompleteSale}
            isProcessing={isProcessing}
            successAnimation={successAnimation}
            setShowAddClientModal={setShowAddClientModal}
          />
        </div>
      </div>

      {/* ── FAB flotante del carrito (solo móvil / tablet) ─────── */}
      {cart.length > 0 && (
        <button
          onClick={() => setShowCartPanel(true)}
          className="lg:hidden fixed bottom-20 right-4 z-40 bg-amber-800 border-2 border-[#D4AF37] text-stone-100 font-black rounded-2xl px-5 py-3.5 shadow-2xl flex items-center gap-2 touch-target-lg transition-all"
        >
          <ShoppingBag className="w-5 h-5" />
          <span>{totalItems} items</span>
          <span className="font-black text-amber-200">{formatUSD(totalUSD)}</span>
        </button>
      )}

      {/* ── Bottom Sheet del carrito (móvil / tablet) ──────────── */}
      {showCartPanel && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowCartPanel(false)} />
          {/* Sheet */}
          <div className="relative bg-stone-900 border-t-2 border-[#D4AF37] rounded-t-3xl max-h-[90vh] overflow-y-auto z-10">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-stone-700 rounded-full" />
            </div>
            <div className="px-4 pb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-stone-100 font-wabi flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-amber-400" /> Carrito
                </h3>
                <button onClick={() => setShowCartPanel(false)} className="p-2 text-stone-400 hover:text-stone-100">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <CartPanel
                cart={cart}
                rateVES={rateVES}
                totalUSD={totalUSD}
                paymentType={paymentType}
                setPaymentType={setPaymentType}
                selectedClient={selectedClient}
                selectedClientId={selectedClientId}
                setSelectedClientId={setSelectedClientId}
                clientSearchQuery={clientSearchQuery}
                setClientSearchQuery={setClientSearchQuery}
                filteredClients={filteredClients}
                updateQuantity={updateQuantity}
                removeFromCart={removeFromCart}
                setCart={setCart}
                handleCompleteSale={handleCompleteSale}
                isProcessing={isProcessing}
                successAnimation={successAnimation}
                setShowAddClientModal={setShowAddClientModal}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Nuevo Cliente ─────────────────────────────────── */}
      {showAddClientModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-stone-900 border-2 border-[#D4AF37] rounded-t-3xl sm:rounded-3xl p-5 w-full sm:max-w-md shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-stone-100 flex items-center gap-2 font-wabi">
              <UserPlus className="w-5 h-5 text-stone-400" /> Registrar Cliente
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-stone-400 block mb-1">Nombre Completo *</label>
                <input type="text" placeholder="Ej. Sra. Ana Gómez" value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl p-3 text-stone-100 font-semibold focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-stone-400 block mb-1">WhatsApp (+58) *</label>
                <input type="tel" placeholder="04141234567" value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl p-3 text-stone-100 font-semibold focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-stone-400 block mb-1">Notas</label>
                <input type="text" placeholder="Ej. Vecina del piso 2" value={newClientNotes}
                  onChange={(e) => setNewClientNotes(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl p-3 text-stone-100 font-semibold focus:outline-none focus:border-amber-500" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowAddClientModal(false)}
                className="px-4 py-2.5 text-stone-400 hover:text-stone-100 font-bold text-sm border border-stone-700 rounded-xl hover:bg-stone-800 transition-all">
                Cancelar
              </button>
              <button onClick={handleCreateClient}
                className="px-6 py-3 bg-amber-800 hover:bg-amber-700 text-stone-100 font-black rounded-2xl text-sm border-2 border-[#D4AF37] transition-all">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Componente CartPanel reutilizado en sidebar (lg) y bottom-sheet (móvil) ──
interface CartPanelProps {
  cart: { product: Product; quantity: number }[];
  rateVES: number;
  totalUSD: number;
  paymentType: 'CONTADO' | 'FIADO';
  setPaymentType: (v: 'CONTADO' | 'FIADO') => void;
  selectedClient: Client | undefined;
  selectedClientId: string;
  setSelectedClientId: (v: string) => void;
  clientSearchQuery: string;
  setClientSearchQuery: (v: string) => void;
  filteredClients: Client[];
  updateQuantity: (id: string, d: number) => void;
  removeFromCart: (id: string) => void;
  setCart: (v: any) => void;
  handleCompleteSale: () => void;
  isProcessing: boolean;
  successAnimation: boolean;
  setShowAddClientModal: (v: boolean) => void;
}

const CartPanel: React.FC<CartPanelProps> = ({
  cart, rateVES, totalUSD, paymentType, setPaymentType,
  selectedClient, selectedClientId, setSelectedClientId,
  clientSearchQuery, setClientSearchQuery, filteredClients,
  updateQuantity, removeFromCart, setCart,
  handleCompleteSale, isProcessing, successAnimation, setShowAddClientModal,
}) => (
  <div className="space-y-4">
    {/* Ítems del carrito */}
    {cart.length === 0 ? (
      <div className="py-8 text-center text-stone-500">
        <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-stone-700" />
        <p className="text-sm font-bold text-stone-400">Carrito vacío</p>
        <p className="text-xs">Toca un producto para agregarlo</p>
      </div>
    ) : (
      <div className="space-y-2 max-h-52 overflow-y-auto pr-0.5">
        {cart.map(({ product, quantity }) => (
          <div key={product.id} className="bg-stone-950 border border-stone-800 p-2.5 rounded-xl flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-extrabold text-stone-100 text-sm truncate leading-tight">{product.name}</h4>
              <p className="text-xs text-amber-400 font-bold">{formatUSD(product.price_usd)} c/u</p>
            </div>
            <div className="flex items-center gap-1 bg-stone-900 p-1 rounded-lg border border-stone-800 shrink-0">
              <button onClick={() => updateQuantity(product.id, -1)}
                className="w-7 h-7 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-100 flex items-center justify-center">
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-6 text-center font-black text-stone-100 text-sm">{quantity}</span>
              <button onClick={() => updateQuantity(product.id, 1)}
                className="w-7 h-7 rounded-lg bg-amber-700 hover:bg-amber-600 text-stone-100 flex items-center justify-center">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <button onClick={() => removeFromCart(product.id)} className="p-1.5 text-stone-500 hover:text-rose-400 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    )}

    {/* Tipo de pago */}
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-stone-400 uppercase tracking-wide block">Tipo de Pago</label>
      <div className="grid grid-cols-2 gap-2">
        {(['CONTADO', 'FIADO'] as const).map((type) => (
          <button key={type} type="button" onClick={() => setPaymentType(type)}
            className={`py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 border-2 transition-all touch-target-lg ${
              paymentType === type
                ? 'bg-amber-800 border-[#D4AF37] text-stone-100'
                : 'bg-stone-900 border-stone-800 text-stone-400 hover:bg-stone-800'
            }`}>
            {type === 'CONTADO' ? <DollarSign className="w-4 h-4 text-amber-400" /> : <CreditCard className="w-4 h-4 text-amber-300" />}
            {type}
          </button>
        ))}
      </div>
    </div>

    {/* Selector de cliente para FIADO */}
    {paymentType === 'FIADO' && (
      <div className="bg-stone-950 border border-[#D4AF37]/30 p-3 rounded-xl space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-xs font-bold text-amber-300 uppercase tracking-wide flex items-center gap-1">
            <User className="w-3.5 h-3.5" /> Cliente *
          </label>
          <button onClick={() => setShowAddClientModal(true)}
            className="text-xs text-amber-400 hover:text-amber-200 font-bold flex items-center gap-0.5 underline">
            <UserPlus className="w-3 h-3" /> Nuevo
          </button>
        </div>

        {selectedClient ? (
          <div className="bg-stone-900 border border-amber-500/50 p-2.5 rounded-xl flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Check className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <span className="font-bold text-stone-100 text-sm block leading-tight">{selectedClient.full_name}</span>
                <span className="text-[10px] text-stone-400 font-mono">{selectedClient.whatsapp_number}</span>
              </div>
            </div>
            <button onClick={() => setSelectedClientId('')}
              className="px-2 py-1 bg-stone-800 text-stone-400 hover:text-rose-400 font-bold text-xs rounded-lg">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400" />
              <input type="text" placeholder="Buscar cliente..." value={clientSearchQuery}
                onChange={(e) => setClientSearchQuery(e.target.value)}
                className="w-full bg-stone-900 border border-amber-500/40 rounded-lg pl-9 pr-3 py-2 text-stone-100 font-bold text-xs focus:outline-none focus:border-amber-400" />
            </div>
            <div className="max-h-36 overflow-y-auto space-y-1 bg-stone-950 border border-stone-800 rounded-lg p-1">
              {filteredClients.length === 0 ? (
                <p className="p-2 text-center text-xs text-stone-500">Sin resultados. Crea un cliente.</p>
              ) : filteredClients.map((cli) => (
                <div key={cli.id} onClick={() => { setSelectedClientId(cli.id); setClientSearchQuery(''); }}
                  className="p-2 rounded-lg bg-stone-900 hover:bg-amber-700 cursor-pointer transition-all flex justify-between items-center">
                  <span className="font-bold text-sm text-stone-200">{cli.full_name}</span>
                  <span className="text-[10px] text-stone-400 font-mono">{cli.whatsapp_number}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )}

    {/* Total */}
    <div className="bg-stone-950 border border-stone-800 p-3 rounded-xl">
      <div className="flex justify-between items-baseline">
        <span className="text-stone-400 text-xs font-bold">Total USD:</span>
        <span className="text-2xl font-black text-amber-400">{formatUSD(totalUSD)}</span>
      </div>
      <div className="flex justify-between items-baseline">
        <span className="text-stone-400 text-xs font-bold">Total VES:</span>
        <span className="text-sm font-bold text-stone-100">{formatVES(totalUSD, rateVES)}</span>
      </div>
    </div>

    {/* Botón vender */}
    <button
      onClick={handleCompleteSale}
      disabled={cart.length === 0 || isProcessing}
      className={`w-full py-4 px-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 transition-all shadow-lg border-2 touch-target-lg ${
        successAnimation
          ? 'bg-amber-400 border-stone-900 text-stone-950 scale-105'
          : cart.length === 0
          ? 'bg-stone-800 text-stone-500 cursor-not-allowed border-stone-700'
          : 'bg-amber-800 hover:bg-amber-700 text-stone-100 border-[#D4AF37]'
      }`}
    >
      {successAnimation ? (
        <><CheckCircle2 className="w-6 h-6 animate-bounce" /> VENTA REGISTRADA</>
      ) : isProcessing ? (
        'Procesando...'
      ) : (
        `REGISTRAR VENTA (${formatUSD(totalUSD)})`
      )}
    </button>
  </div>
);
