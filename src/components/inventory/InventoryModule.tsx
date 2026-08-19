'use client';

import React, { useState } from 'react';
import { Package, Plus, Search, AlertTriangle } from 'lucide-react';
import { Product, ExchangeRate, PRODUCT_CATEGORIES } from '../../lib/types';
import { formatUSD, formatVES } from '../../lib/bimonetary/exchangeRate';
import { putToStore, addToSyncQueue } from '../../lib/db/indexeddb';

interface InventoryModuleProps {
  products: Product[];
  bcvRate: ExchangeRate | null;
  onRefreshProducts: () => void;
}

export const InventoryModule: React.FC<InventoryModuleProps> = ({
  products,
  bcvRate,
  onRefreshProducts,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>(PRODUCT_CATEGORIES[0]);
  const [priceUSD, setPriceUSD] = useState('');
  const [stock, setStock] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const rateVES = bcvRate ? bcvRate.rate_ves : 36.50;

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
    onRefreshProducts();
    setShowAddModal(false);
    setName('');
    setPriceUSD('');
    setStock('');
    setErrorMsg(null);
  };

  return (
    <div className="pb-32 max-w-7xl mx-auto px-3 sm:px-4 pt-3 sm:pt-4 space-y-4 sm:space-y-5">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-stone-100 font-wabi flex items-center gap-2">
            <Package className="w-5 sm:w-6 h-5 sm:h-6 text-stone-400" />
            Catálogo de Inventario
          </h2>
          <p className="text-xs sm:text-sm text-stone-400 mt-0.5">
            Precios en dólares, stock y reabastecimiento rápido.
          </p>
        </div>

        {/* CTA Primario */}
        <button
          onClick={() => setShowAddModal(true)}
          className="w-full sm:w-auto py-3 px-5 sm:px-6 bg-amber-800 hover:bg-amber-700 border-2 border-[#D4AF37] text-stone-100 font-black rounded-2xl flex items-center justify-center gap-2 transition-all touch-target-lg"
        >
          <Plus className="w-5 h-5" /> Nuevo Producto
        </button>
      </div>

      {/* ── Búsqueda ────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
        <input
          type="text"
          placeholder="Buscar producto por nombre..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-stone-900 border-2 border-stone-700 rounded-2xl pl-11 sm:pl-12 pr-4 py-3 sm:py-3.5 text-stone-100 text-base sm:text-lg font-bold focus:outline-none focus:border-amber-500 placeholder:text-stone-500 transition-colors"
        />
      </div>

      {/* ── Grid de Productos ───────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {filteredProducts.map((p) => {
          const isLowStock = p.stock_quantity > 0 && p.stock_quantity <= 5;
          const isOut = p.stock_quantity <= 0;

          return (
            <div
              key={p.id}
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
                  <span className="text-[11px] sm:text-xs font-bold text-stone-400 uppercase tracking-wider">
                    {p.category}
                  </span>

                  {/* Badge de stock */}
                  <span
                    className={`text-[11px] sm:text-xs font-black flex items-center gap-1 ${
                      isOut
                        ? 'text-[#C0392B]'
                        : isLowStock
                        ? 'text-amber-400'
                        : 'text-stone-300'
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

                <h3 className="text-base font-extrabold text-stone-100 leading-tight">
                  {p.name}
                </h3>
              </div>

              {/* Precios */}
              <div className="flex items-baseline justify-between border-t border-stone-800 pt-2.5 sm:pt-3">
                <div>
                  <span className="text-[11px] sm:text-xs font-bold text-stone-400 block">Precio USD</span>
                  <span className="text-xl sm:text-2xl font-black text-stone-100">
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
              <div className="space-y-1 sm:space-y-1.5">
                <span className="text-[11px] sm:text-xs font-bold text-stone-500 block">Reabastecer</span>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  {[5, 10, 25].map((qty) => (
                    <button
                      key={qty}
                      onClick={() => handleQuickReplenish(p, qty)}
                      className="py-2.5 bg-transparent hover:bg-stone-800 text-stone-300 font-bold rounded-xl text-xs sm:text-sm border border-stone-700 transition-all touch-target-lg flex items-center justify-center"
                    >
                      +{qty}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}

        {filteredProducts.length === 0 && (
          <div className="col-span-full py-16 text-center text-stone-500 bg-stone-900 wabi-card">
            <Package className="w-10 h-10 mx-auto mb-3 text-stone-700" />
            <p className="font-bold text-stone-400">No se encontraron productos.</p>
            <p className="text-xs sm:text-sm mt-1">Prueba otro nombre o añade un producto nuevo.</p>
          </div>
        )}
      </div>

      {/* ── Modal Añadir Producto (Bottom-sheet en móvil, centrado en desktop) ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-stone-900 border-t-2 sm:border-2 border-[#D4AF37] rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 w-full sm:max-w-md shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg sm:text-xl font-bold text-stone-100 flex items-center gap-2 font-wabi">
              <Package className="w-5 h-5 text-stone-400" /> Nuevo Producto
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
                  placeholder="Ej. Galleta Susy 50g"
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
                Guardar Producto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
