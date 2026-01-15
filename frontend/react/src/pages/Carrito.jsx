/*
  Carrito.jsx

  Pantalla del carrito de compras.

  ¿Por qué existe?
  - Antes la compra era directa (un clic y se insertaba en compra).
  - Con el stock dual y el historial de compras, se necesitaba una pantalla intermedia
    para que el usuario revise cantidades y el total antes de confirmar.

  ¿Para qué sirve?
  - Lista items del carrito desde GET /api/carrito?id_usuario=...
  - Permite eliminar un item (DELETE /api/carrito/:id_libro)
  - Permite finalizar compra (POST /api/carrito/checkout)
*/

import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/api.js';
import { getStoredUser } from '../lib/auth.js';

export default function Carrito() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  const resetMessages = () => {
    setError('');
    setSuccess('');
  };

  const load = async () => {
    resetMessages();
    const user = getStoredUser();
    if (!user?.id_usuario) {
      setItems([]);
      setError('Inicia sesión para ver tu carrito.');
      return;
    }

    setLoading(true);
    try {
      const data = await apiFetch(`/api/carrito?id_usuario=${encodeURIComponent(user.id_usuario)}`);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setItems([]);
      setError(e?.message || 'No se pudo cargar el carrito.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const total = useMemo(() => {
    let sum = 0;
    for (const it of items || []) {
      const qty = Number(it?.cantidad) || 0;
      const price = Number(it?.valor);
      if (qty > 0 && Number.isFinite(price)) sum += qty * price;
    }
    return sum;
  }, [items]);

  const formatMoney = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value ?? '');
    return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  };

  const onRemove = async (id_libro) => {
    resetMessages();
    const user = getStoredUser();
    if (!user?.id_usuario) return;

    try {
      await apiFetch(`/api/carrito/${encodeURIComponent(id_libro)}?id_usuario=${encodeURIComponent(user.id_usuario)}`, {
        method: 'DELETE'
      });
      setSuccess('Producto eliminado del carrito.');
      window.dispatchEvent(new Event('tga_cart_updated'));
      await load();
    } catch (e) {
      setError(e?.message || 'No se pudo eliminar.');
    }
  };

  const onCheckout = async () => {
    resetMessages();
    const user = getStoredUser();
    if (!user?.id_usuario) return;

    const totalLabel = formatMoney(total);

    setCheckingOut(true);
    try {
      await apiFetch('/api/carrito/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_usuario: user.id_usuario })
      });
      setSuccess('Compra realizada.');
      window.dispatchEvent(new Event('tga_cart_updated'));
      window.dispatchEvent(new Event('tga_catalog_updated'));
      window.dispatchEvent(
        new CustomEvent('tga_toast', {
          detail: { message: `¡Compra exitosa! Total: ${totalLabel}. Gracias por tu compra.` }
        })
      );
      await load();
    } catch (e) {
      setError(e?.message || 'No se pudo completar la compra.');
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Carrito</h1>
        <p className="text-gray-600 mt-1">Revisa tus libros antes de comprar.</p>

        {error ? <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        {success ? <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p> : null}
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Mis productos</h2>
          <button
            type="button"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 active:translate-y-px disabled:opacity-50 w-full sm:w-auto"
            disabled={checkingOut || loading || (items || []).length === 0}
            onClick={onCheckout}
          >
            Comprar ({formatMoney(total)})
          </button>
        </div>

        <div className="lg:hidden">
          {loading ? <p className="px-4 py-4 text-sm text-gray-500">Cargando...</p> : null}

          {!loading && (!items || items.length === 0) ? <p className="px-4 py-4 text-sm text-gray-500">Tu carrito está vacío.</p> : null}

          {(items || []).map((it) => {
            const qty = Number(it?.cantidad) || 0;
            const price = Number(it?.valor);
            const subtotal = Number.isFinite(price) ? qty * price : null;

            return (
              <div key={it.id_libro} className="border-t border-gray-200 p-4">
                <div className="min-w-0">
                  <p title={String(it?.titulo || '-')} className="text-sm font-semibold text-gray-900 truncate">
                    {it?.titulo || '-'}
                  </p>
                  <p title={String(it?.autor || '-')} className="mt-1 text-xs text-gray-500 truncate">
                    {it?.autor || '-'}
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <p className="text-gray-600">
                      <span className="font-semibold text-gray-900">Cantidad:</span> {qty}
                    </p>
                    <p className="text-gray-600">
                      <span className="font-semibold text-gray-900">Precio:</span> {Number.isFinite(price) ? formatMoney(price) : '-'}
                    </p>
                    <p className="col-span-2 text-gray-600">
                      <span className="font-semibold text-gray-900">Subtotal:</span> {subtotal == null ? '-' : formatMoney(subtotal)}
                    </p>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      className="rounded-lg bg-gray-200 px-3 py-2 text-xs font-semibold text-gray-800 shadow-sm hover:bg-gray-300 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-400 active:translate-y-px"
                      onClick={() => onRemove(it.id_libro)}
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="hidden lg:block overflow-hidden">
          <table className="w-full table-fixed divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Libro</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subtotal</th>
                <th className="px-4 sm:px-6 py-3" />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 sm:px-6 py-4 text-sm text-gray-500">
                    Cargando...
                  </td>
                </tr>
              ) : null}

              {!loading && (!items || items.length === 0) ? (
                <tr>
                  <td colSpan={5} className="px-4 sm:px-6 py-4 text-sm text-gray-500">
                    Tu carrito está vacío.
                  </td>
                </tr>
              ) : null}

              {(items || []).map((it) => {
                const qty = Number(it?.cantidad) || 0;
                const price = Number(it?.valor);
                const subtotal = Number.isFinite(price) ? qty * price : null;

                return (
                  <tr key={it.id_libro}>
                    <td className="px-4 sm:px-6 py-4">
                      <div title={String(it?.titulo || '-')} className="text-sm font-medium text-gray-900 truncate">
                        {it?.titulo || '-'}
                      </div>
                      <div title={String(it?.autor || '-')} className="text-sm text-gray-500 truncate">
                        {it?.autor || '-'}
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600">{qty}</td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {Number.isFinite(price) ? formatMoney(price) : '-'}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {subtotal == null ? '-' : formatMoney(subtotal)}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right">
                      <button
                        type="button"
                        className="rounded-lg bg-gray-200 px-3 py-2 text-xs font-semibold text-gray-800 shadow-sm hover:bg-gray-300 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-400 active:translate-y-px"
                        onClick={() => onRemove(it.id_libro)}
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
