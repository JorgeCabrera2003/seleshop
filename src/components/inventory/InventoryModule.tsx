'use client';

import React, { useState } from 'react';
import {
  Package, Plus, Search, AlertTriangle, Edit2, Trash2, Megaphone, Send, Sparkles, Check, ArrowUpDown, SortAsc, SortDesc
} from 'lucide-react';
import { Product, Client, ExchangeRate, PRODUCT_CATEGORIES } from '../../lib/types';
import { formatUSD, formatVES } from '../../lib/bimonetary/exchangeRate';
import { putToStore, addToSyncQueue, deleteFromStore } from '../../lib/db/indexeddb';

interface InventoryModuleProps {
  products: Product[];
  clients?: Client[];
  bcvRate: ExchangeRate | null;
  onRefreshProducts: () => void;
}

type SortOption = 'ALPHA_ASC' | 'ALPHA_DESC' | 'STOCK_ASC' | 'STOCK_DESC' | 'PRICE_DESC' | 'PRICE_ASC';

export const InventoryModule: React.FC<InventoryModuleProps> = ({
  products,
  clients = [],
  bcvRate,
  onRefreshProducts,
}) => {
  const [searchQuery, setSearchQuery]       = useState('');
  const [sortMode, setSortMode]             = useState<SortOption>('ALPHA_ASC');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('TODOS');
  const [showAddModal, setShowAddModal]     = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [name, setName]                     = useState('');
  const [category, setCategory]             = useState<string>(PRODUCT_CATEGORIES[0]);
  const [priceUSD, setPriceUSD]             = useState('');
  const [stock, setStock]                   = useState('');
  const [errorMsg, setErrorMsg]             = useState<string | null>(null);

  // Modal para Notificar Llegada de Mercancía (Papas, Tostón, etc.) por WhatsApp
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockItem, setRestockItem]           = useState<string>('Papas y Tostón');
  const [customMsg, setCustomMsg]               = useState<string>(
    '¡Hola {nombre}! 📢 Te escribo de SeleShop para avisarte que me acaba de llegar mercancía fresca: *Papas y Tostón crujientes recién surtidos*. ¡Quedo a tu orden si deseas que te aparte algo antes de que se agoten! 🛍️'
  );

  const rateVES = bcvRate ? bcvRate.rate_ves : 36.50;

  // Categorías presentes en el inventario
  const categoriesList = React.useMemo(() => {
    const existing = Array.from(new Set(products.map((p) => p.category))).filter(Boolean);
    const sorted = PRODUCT_CATEGORIES.filter((c) => existing.includes(c));
    const remaining = existing.filter((c) => !PRODUCT_CATEGORIES.includes(c as any));
    return ['TODOS', ...sorted, ...remaining];
  }, [products]);

  // 1. Filtrar por búsqueda y categoría
  const filtered = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategoryFilter === 'TODOS' || p.category === selectedCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  // 2. Ordenar por modo elegido (Alfabético A-Z por defecto)
  const sortedProducts = [...filtered].sort((a, b) => {
    if (sortMode === 'ALPHA_ASC') {
      return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
    }
    if (sortMode === 'ALPHA_DESC') {
      return b.name.localeCompare(a.name, 'es', { sensitivity: 'base' });
    }
    if (sortMode === 'STOCK_ASC') {
      return a.stock_quantity - b.stock_quantity;
    }
    if (sortMode === 'STOCK_DESC') {
      return b.stock_quantity - a.stock_quantity;
    }
    if (sortMode === 'PRICE_DESC') {
      return b.price_usd - a.price_usd;
    }
    if (sortMode === 'PRICE_ASC') {
      return a.price_usd - b.price_usd;
    }
    return 0;
  });

  const getInitial = (prodName: string) => {
    const clean = prodName.trim().toUpperCase();
    return clean.length > 0 ? clean[0] : '#';
  };

  const handleQuickReplenish = async (product: Product, addQty: number) => {
    const updated: Product = {
      ...product,
      stock_quantity: product.stock_quantity + addQty,
      updated_at: new Date().toISOString(),
    };
    await putToStore('products', updated);
    await addToSyncQueue({ table_name: 'products', action: 'UPDATE', data: updated });
    onRefreshProducts();
  };

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setName('');
    setCategory(PRODUCT_CATEGORIES[0]);
    setPriceUSD('');
    setStock('');
    setErrorMsg(null);
    setShowAddModal(true);
  };

  const handleOpenEditModal = (product: Product) => {
    setEditingProduct(product);
    setName(product.name);
    setCategory(product.category);
    setPriceUSD(product.price_usd.toString());
    setStock(product.stock_quantity.toString());
    setErrorMsg(null);
    setShowAddModal(true);
  };

  const handleDeleteProduct = async (productId: string) => {
    if (window.confirm('¿Eliminar este producto del inventario?')) {
      await deleteFromStore('products', productId);
      await addToSyncQueue({ table_name: 'products', action: 'DELETE', data: { id: productId } });
      onRefreshProducts();
    }
  };

  const handleAddProduct = async () => {
    if (!name.trim() || !priceUSD || !stock) {
      setErrorMsg('Por favor completa todos los campos del producto.');
      return;
    }

    const priceNum = parseFloat(priceUSD);
    const stockNum = parseInt(stock, 10);

    if (isNaN(priceNum) || priceNum < 0 || isNaN(stockNum) || stockNum < 0) {
      setErrorMsg('Precio e inventario deben ser números válidos.');
      return;
    }

    if (editingProduct) {
      const updated: Product = {
        ...editingProduct,
        name: name.trim(),
        category: category.trim() || 'Chucherías',
        price_usd: priceNum,
        stock_quantity: stockNum,
        updated_at: new Date().toISOString(),
      };
      await putToStore('products', updated);
      await addToSyncQueue({ table_name: 'products', action: 'UPDATE', data: updated });
    } else {
      const newProd: Product = {
        id: 'prod-' + Date.now(),
        name: name.trim(),
        category: category.trim() || 'Chucherías',
        price_usd: priceNum,
        stock_quantity: stockNum,
        is_active: true,
        updated_at: new Date().toISOString(),
      };
      await putToStore('products', newProd);
      await addToSyncQueue({ table_name: 'products', action: 'INSERT', data: newProd });
    }

    onRefreshProducts();
    setShowAddModal(false);
  };

  const handleSelectPresetMessage = (presetName: string) => {
    setRestockItem(presetName);
    if (presetName === 'Papas y Tostón') {
      setCustomMsg('¡Hola {nombre}! 📢 Te escribo de SeleShop para avisarte que me acaba de llegar mercancía fresca: *Papas y Tostón crujientes recién surtidos*. ¡Quedo a tu orden si deseas que te aparte algo antes de que se agoten! 🛍️');
    } else if (presetName === 'Papas Fritas') {
      setCustomMsg('¡Hola {nombre}! 🥔 Te escribo de SeleShop. ¡Ya me llegaron las *Papas Fritas*! Quedo a tu orden si deseas la tuya hoy mismo.');
    } else if (presetName === 'Tostón Tradicional') {
      setCustomMsg('¡Hola {nombre}! 🍌 Te escribo de SeleShop. ¡Me acaba de llegar *Tostón crujiente*! Quedo a tu orden si deseas el tuyo.');
    }
  };

  const handleSendRestockWhatsApp = (client: Client) => {
    const cleanPhone = client.whatsapp_number.replace(/[^\d+]/g, '');
    const formattedMsg = customMsg.replace('{nombre}', client.full_name);
    window.open(`https://wa.me/${cleanPhone.replace('+', '')}?text=${encodeURIComponent(formattedMsg)}`, '_blank');
  };

  return (
    <div className="pb-32 max-w-7xl mx-auto px-3 sm:px-4 pt-3 sm:pt-4 space-y-4 sm:space-y-5">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-stone-100 font-wabi flex items-center gap-2">
            <Package className="w-5 sm:w-6 h-5 sm:h-6 text-amber-400" />
            Catálogo de Inventario
          </h2>
          <p className="text-xs sm:text-sm text-stone-400 mt-0.5">
            Ordenado alfabéticamente. Snacks, golosinas y todo tu inventario en un solo lugar.
          </p>
        </div>

        {/* CTA Primario y Botón de Difusión de Mercancía */}
        <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2">
          <button
            onClick={() => setShowRestockModal(true)}
            className="w-full sm:w-auto py-3 px-4 bg-amber-950/60 hover:bg-amber-900/60 border-2 border-amber-500/70 text-amber-300 font-bold rounded-2xl flex items-center justify-center gap-2 transition-all touch-target-lg shadow-md"
          >
            <Megaphone className="w-5 h-5 text-amber-400" /> Notificar Llegada de Papas/Tostón
          </button>

          <button
            onClick={handleOpenAddModal}
            className="w-full sm:w-auto py-3 px-5 sm:px-6 bg-amber-800 hover:bg-amber-700 border-2 border-[#D4AF37] text-stone-100 font-black rounded-2xl flex items-center justify-center gap-2 transition-all touch-target-lg shadow-lg"
          >
            <Plus className="w-5 h-5" /> Nuevo Producto
          </button>
        </div>
      </div>

      {/* ── Búsqueda y Selector de Ordenamiento ──────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="relative sm:col-span-8">
          <Search className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
          <input
            type="text"
            placeholder="Buscar snacks, golosinas o cualquier producto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-stone-900 border-2 border-stone-700 rounded-2xl pl-11 sm:pl-12 pr-4 py-3 text-stone-100 text-base font-bold focus:outline-none focus:border-amber-500 placeholder:text-stone-500 transition-colors shadow-inner"
          />
        </div>

        {/* Selector de Orden Alfabético / Criterios */}
        <div className="sm:col-span-4 relative flex items-center">
          <ArrowUpDown className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400 pointer-events-none" />
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortOption)}
            className="w-full bg-stone-900 border-2 border-stone-700 rounded-2xl pl-10 pr-8 py-3 text-stone-200 text-xs font-extrabold focus:outline-none focus:border-amber-500 transition-colors cursor-pointer appearance-none shadow-inner"
          >
            <option value="ALPHA_ASC">🔤 Nombre (A - Z)</option>
            <option value="ALPHA_DESC">🔤 Nombre (Z - A)</option>
            <option value="STOCK_ASC">📦 Menor Stock (Agotados)</option>
            <option value="STOCK_DESC">📦 Mayor Stock Disponible</option>
            <option value="PRICE_DESC">💰 Mayor Precio ($ USD)</option>
            <option value="PRICE_ASC">💰 Menor Precio ($ USD)</option>
          </select>
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400 text-xs">▼</div>
        </div>
      </div>

      {/* ── Filtro por Categorías (Pills) ───────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {categoriesList.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategoryFilter(cat)}
            className={`px-3 py-1.5 rounded-xl font-extrabold text-xs whitespace-nowrap transition-all shadow-sm ${
              selectedCategoryFilter === cat
                ? 'bg-amber-800 text-stone-100 border border-[#D4AF37]/60'
                : 'bg-stone-900 border border-stone-700 text-stone-300 hover:bg-stone-800'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── Badge Informativo del Orden Actual ────────────────────── */}
      <div className="flex items-center justify-between text-xs text-stone-400 bg-stone-900/60 px-4 py-2 rounded-xl border border-stone-800/80">
        <span className="flex items-center gap-1.5 font-semibold">
          {sortMode === 'ALPHA_ASC' && <SortAsc className="w-4 h-4 text-amber-400" />}
          {sortMode === 'ALPHA_DESC' && <SortDesc className="w-4 h-4 text-amber-400" />}
          {(sortMode.startsWith('STOCK') || sortMode.startsWith('PRICE')) && <ArrowUpDown className="w-4 h-4 text-amber-400" />}
          <span>
            {sortMode === 'ALPHA_ASC' && 'Orden alfabético ascendente (A-Z)'}
            {sortMode === 'ALPHA_DESC' && 'Orden alfabético descendente (Z-A)'}
            {sortMode === 'STOCK_ASC' && 'Ordenado por menor stock (agotados primero)'}
            {sortMode === 'STOCK_DESC' && 'Ordenado por mayor stock disponible'}
            {sortMode === 'PRICE_DESC' && 'Ordenado por mayor precio en $ USD'}
            {sortMode === 'PRICE_ASC' && 'Ordenado por menor precio en $ USD'}
          </span>
        </span>
        <span className="font-bold text-amber-300 bg-amber-950/60 border border-amber-800/40 px-2.5 py-0.5 rounded-full">
          {sortedProducts.length} producto{sortedProducts.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Grid de Productos con separadores alfabéticos ───────────────────────────────────── */}
      <div className="space-y-4">
        {sortedProducts.length === 0 ? (
          <div className="py-16 text-center text-stone-500 bg-stone-900 wabi-card space-y-2">
            <Package className="w-10 h-10 mx-auto text-stone-700" />
            <p className="font-bold text-stone-400 text-base">No se encontraron productos en el inventario.</p>
            <p className="text-xs">Prueba con otro nombre o presiona "Nuevo Producto".</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {sortedProducts.map((p, index) => {
              const isLowStock = p.stock_quantity > 0 && p.stock_quantity <= 5;
              const isOut = p.stock_quantity <= 0;

              // Separadores de letras alfabéticas en modo A-Z
              const currentInitial = getInitial(p.name);
              const prevInitial = index > 0 ? getInitial(sortedProducts[index - 1].name) : null;
              const showAlphabetHeader = sortMode === 'ALPHA_ASC' && currentInitial !== prevInitial;

              return (
                <React.Fragment key={p.id}>
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
                      isOut
                        ? 'border-[#C0392B]/50'
                        : isLowStock
                        ? 'border-[#D4AF37]/50'
                        : 'border-stone-800 hover:border-stone-600'
                    }`}
                  >
                    {/* Cabecera de tarjeta */}
                    <div>
                      <div className="flex justify-between items-start mb-2 sm:mb-3">
                        <span className="text-[11px] sm:text-xs font-extrabold text-stone-400 uppercase tracking-wider bg-stone-950/60 px-2 py-0.5 rounded-md border border-stone-800">
                          {p.category}
                        </span>

                        <div className="flex items-center gap-2">
                          {/* Botones de acción */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleOpenEditModal(p)}
                              className="p-1.5 text-stone-400 hover:text-stone-100 hover:bg-stone-800 rounded-lg transition-colors touch-target-lg flex items-center justify-center"
                              title="Editar producto"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(p.id)}
                              className="p-1.5 text-stone-400 hover:text-[#C0392B] hover:bg-stone-800 rounded-lg transition-colors touch-target-lg flex items-center justify-center"
                              title="Eliminar producto"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Badge de stock */}
                          <span
                            className={`text-[11px] sm:text-xs font-black flex items-center gap-1 px-2 py-0.5 rounded-md ${
                              isOut
                                ? 'text-[#C0392B] bg-rose-950/40 border border-rose-800/40'
                                : isLowStock
                                ? 'text-amber-400 bg-amber-950/40 border border-amber-800/40'
                                : 'text-stone-300 bg-stone-950/40 border border-stone-800'
                            }`}
                          >
                            {(isOut || isLowStock) && <AlertTriangle className="w-3 h-3" />}
                            {isOut
                              ? 'Agotado'
                              : isLowStock
                              ? `Bajo (${p.stock_quantity} u)`
                              : `${p.stock_quantity} u`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center text-amber-400 font-extrabold text-xs shrink-0 mt-0.5">
                          {getInitial(p.name)}
                        </div>
                        <h3 className="text-base font-extrabold text-stone-100 leading-tight">
                          {p.name}
                        </h3>
                      </div>
                    </div>

                    {/* Precios */}
                    <div className="flex items-baseline justify-between border-t border-stone-800/80 pt-2.5 sm:pt-3">
                      <div>
                        <span className="text-[11px] sm:text-xs font-bold text-stone-400 block">Precio USD</span>
                        <span className="text-xl sm:text-2xl font-black text-amber-400">
                          {formatUSD(p.price_usd)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] sm:text-xs font-bold text-stone-400 block">Precio VES</span>
                        <span className="text-xs sm:text-sm font-bold text-stone-300">
                          {formatVES(p.price_usd, rateVES)}
                        </span>
                      </div>
                    </div>

                    {/* Botones de reabastecimiento */}
                    <div className="space-y-1 sm:space-y-1.5 pt-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] sm:text-xs font-bold text-stone-500 block">Reabastecer stock</span>
                        <button
                          onClick={() => {
                            setRestockItem(p.name);
                            setCustomMsg(`¡Hola {nombre}! 📢 Te escribo de SeleShop para avisarte que me acaba de llegar mercancía nueva: *${p.name}* (${formatUSD(p.price_usd)} / ${formatVES(p.price_usd, rateVES)}). ¡Quedo a tu orden si deseas apartar el tuyo! 🛍️`);
                            setShowRestockModal(true);
                          }}
                          className="text-[10px] text-amber-400 hover:text-amber-200 font-bold flex items-center gap-1 underline"
                        >
                          <Megaphone className="w-3 h-3" /> Avisar por WhatsApp
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                        {[5, 10, 25].map((qty) => (
                          <button
                            key={qty}
                            onClick={() => handleQuickReplenish(p, qty)}
                            className="py-2 bg-transparent hover:bg-stone-800 text-stone-300 font-bold rounded-xl text-xs sm:text-sm border border-stone-700 transition-all touch-target-lg flex items-center justify-center"
                          >
                            +{qty}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modal Añadir Producto ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-stone-900 border-t-2 sm:border-2 border-[#D4AF37] rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 w-full sm:max-w-md shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg sm:text-xl font-bold text-stone-100 flex items-center gap-2 font-wabi">
              <Package className="w-5 h-5 text-amber-400" /> {editingProduct ? 'Editar Producto' : 'Nuevo Producto en Inventario'}
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
                  Nombre del Producto *
                </label>
                <input
                  type="text"
                  placeholder="Ej. Papas Fritas Lays 100g / Tostón"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl p-3 text-stone-100 font-semibold focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-400 block mb-1">
                  Categoría
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl p-3 text-stone-100 font-semibold focus:outline-none focus:border-amber-500 transition-colors"
                >
                  {PRODUCT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-400 block mb-1">
                    Precio ($ USD) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="2.50"
                    value={priceUSD}
                    onChange={(e) => setPriceUSD(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl p-3 text-stone-100 font-extrabold focus:outline-none focus:border-amber-500 text-lg transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-400 block mb-1">
                    Cantidad Inicial *
                  </label>
                  <input
                    type="number"
                    placeholder="20"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl p-3 text-stone-100 font-extrabold focus:outline-none focus:border-amber-500 text-lg transition-colors"
                  />
                </div>
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
                onClick={handleAddProduct}
                className="px-6 py-3 bg-amber-800 hover:bg-amber-700 text-stone-100 font-black rounded-2xl text-sm border-2 border-[#D4AF37] transition-all touch-target-lg"
              >
                {editingProduct ? 'Actualizar Producto' : 'Guardar Producto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Notificar Llegada de Mercancía por WhatsApp ── */}
      {showRestockModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border-2 border-[#D4AF37] rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-bold text-stone-100">
                Informar Llegada de Mercancía por WhatsApp
              </h3>
            </div>

            <p className="text-xs text-stone-400">
              Selecciona una plantilla rápida o edita el mensaje para notificar a los contactos del directorio cuando lleguen <strong className="text-amber-300">Papas, Tostón o nuevos productos</strong>:
            </p>

            {/* Presets rápidos */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block">Plantillas Rápidas</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'Papas y Tostón', label: '🥔 Papas y Tostón' },
                  { id: 'Papas Fritas', label: '🍟 Papas Fritas' },
                  { id: 'Tostón Tradicional', label: '🍌 Tostón' },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectPresetMessage(preset.id)}
                    className={`py-2 px-2 rounded-xl text-xs font-extrabold border text-center transition-all ${
                      restockItem === preset.id
                        ? 'bg-amber-800 border-[#D4AF37] text-stone-100 shadow'
                        : 'bg-stone-950 border-stone-800 text-stone-300 hover:bg-stone-850'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Editor de mensaje */}
            <div>
              <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                Mensaje a Enviar <span className="text-stone-500 font-normal">({`usa {nombre} para personalizar`})</span>
              </label>
              <textarea
                value={customMsg}
                onChange={(e) => setCustomMsg(e.target.value)}
                rows={3}
                className="w-full bg-stone-950 border border-stone-700 rounded-xl p-3 text-stone-100 font-semibold text-xs focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>

            {/* Lista de Clientes del Directorio */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between items-baseline">
                <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                  Contactos del Directorio ({clients.length})
                </label>
                <span className="text-[10px] text-amber-400 font-bold">Haz clic en Enviar por cliente</span>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {clients.length === 0 ? (
                  <div className="p-4 text-center text-xs text-stone-500 bg-stone-950 rounded-xl border border-stone-800">
                    No hay contactos guardados en el directorio telefónico.
                  </div>
                ) : (
                  clients.map((c) => (
                    <div key={c.id} className="flex items-center justify-between p-2.5 bg-stone-950 rounded-xl border border-stone-800">
                      <div>
                        <span className="font-bold text-xs text-stone-100 block leading-tight">{c.full_name}</span>
                        <span className="text-[11px] text-stone-400 font-mono">{c.whatsapp_number}</span>
                      </div>

                      <button
                        onClick={() => handleSendRestockWhatsApp(c)}
                        className="py-1.5 px-3 bg-amber-800 hover:bg-amber-700 text-stone-100 font-bold text-xs rounded-lg border border-[#D4AF37] flex items-center gap-1.5 shadow"
                      >
                        <Send className="w-3.5 h-3.5" /> WhatsApp
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-stone-800">
              <button
                onClick={() => setShowRestockModal(false)}
                className="px-5 py-2.5 bg-stone-800 hover:bg-stone-750 text-stone-300 font-bold text-xs rounded-xl"
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
