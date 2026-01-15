/*
  BookCard.jsx

  Este componente representa una tarjeta de libro.

  ¿Por qué existe?
  - En la maqueta HTML (index.html) la card se repite muchas veces.
  - En React lo convertimos en componente para reutilizar la estructura y evitar duplicar JSX.
  - Aquí también centralizamos las acciones (Ver detalles, Comprar, Rentar).
*/

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api.js';
import { clearStoredUser, getStoredUser } from '../lib/auth.js';
import { createCoverDataUri, ensureCoverMap, getLocalCoverUrl } from '../lib/covers.js';

export default function BookCard({ book, onOpenDetails, mode }) {
  const navigate = useNavigate();

  // buyQty:
  // - Guarda la cantidad que el usuario quiere comprar desde la tarjeta.
  // - Se usa para reemplazar el `prompt()` del navegador y mantener la interacción dentro de la UI.
  // - Se envía tal cual al backend en POST /api/carrito.
  const [buyQty, setBuyQty] = useState(1);

  const [cartRev, setCartRev] = useState(0);

  const [coversRev, setCoversRev] = useState(0);

  useEffect(() => {
    const onUpdated = () => setCartRev((v) => v + 1);
    window.addEventListener('tga_cart_updated', onUpdated);
    return () => window.removeEventListener('tga_cart_updated', onUpdated);
  }, []);

  useEffect(() => {
    let cancelled = false;
    ensureCoverMap()
      .then(() => {
        if (!cancelled) setCoversRev((v) => v + 1);
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, []);

  // Disponibilidad:
  // - En la base de datos `disponibilidad` se maneja como 1/0.
  // - Con esto controlamos UI (badge) y deshabilitamos botones.
  const stockCompra = Number(book?.stock_compra);
  const stockRenta = Number(book?.stock_renta);
  const hasSplitStock = Number.isFinite(stockCompra) || Number.isFinite(stockRenta);

  const getInCartQty = () => {
    try {
      const list = typeof window !== 'undefined' ? window.__tga_cart_items : null;
      const items = Array.isArray(list) ? list : [];
      const id = Number(book?.id_libro);
      if (!Number.isFinite(id)) return 0;
      const found = items.find((it) => Number(it?.id_libro) === id);
      const n = Number(found?.cantidad);
      return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
    } catch {
      return 0;
    }
  };

  const inCartQty = cartRev >= 0 ? getInCartQty() : 0;
  const buyRemaining = Number.isFinite(stockCompra) ? Math.max(Math.trunc(stockCompra) - inCartQty, 0) : undefined;

  const buyAvailable = Number.isFinite(stockCompra) ? buyRemaining > 0 : Number(book?.disponibilidad) === 1;
  const rentAvailable = Number.isFinite(stockRenta) ? stockRenta > 0 : Number(book?.disponibilidad) === 1;
  const isAvailable = hasSplitStock ? buyAvailable || rentAvailable : Number(book?.disponibilidad) === 1;

  const statusClass = isAvailable ? 'status-instock' : 'status-rented';
  const statusText = isAvailable ? 'En stock' : 'No disponible';

  // En algunos scripts SQL existe `stock`, pero si no está, mantenemos el comportamiento original.
  const stockValue =
    hasSplitStock
      ? (Number.isFinite(stockCompra) ? stockCompra : 0) + (Number.isFinite(stockRenta) ? stockRenta : 0)
      : typeof book?.stock === 'number' || Number.isFinite(Number(book?.stock))
        ? Number(book.stock)
        : isAvailable
          ? 1
          : 0;

  const coverSrc = (coversRev >= 0 ? getLocalCoverUrl(book?.titulo) : '') || createCoverDataUri(book?.titulo);

  // ensureUserOrRedirect:
  // - Centraliza el control de sesión.
  // - Si no hay usuario (localStorage), se redirige a /login.
  // - Retorna el usuario para usar su id en llamadas de compra/préstamo.
  const ensureUserOrRedirect = () => {
    const user = getStoredUser();
    if (!user?.id_usuario) {
      navigate('/login');
      return null;
    }
    return user;
  };

  // handleCompraError:
  // - Maneja un caso frecuente: el usuario existe en localStorage pero fue borrado en BD.
  // - Si el backend responde "Usuario no encontrado", limpiamos la sesión y forzamos login.
  const handleCompraError = (msg) => {
    if (String(msg).toLowerCase().includes('usuario no encontrado')) {
      clearStoredUser();
      window.alert(msg);
      navigate('/login');
      return;
    }
    window.alert(msg);
  };

  const onBuy = async () => {
    if (!book?.id_libro) return;
    const user = ensureUserOrRedirect();
    if (!user) return;

    // Validación simple:
    // - Evita que se manden cantidades vacías/negativas.
    // - Si existe stock_compra, también se valida contra ese valor.
    const cantidad = Number(buyQty);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      window.dispatchEvent(new CustomEvent('tga_toast', { detail: { message: 'Cantidad inválida' } }));
      return;
    }

    const cartQty = getInCartQty();
    const remaining = Number.isFinite(stockCompra) ? Math.max(Math.trunc(stockCompra) - cartQty, 0) : undefined;
    if (Number.isFinite(remaining) && cantidad > remaining) {
      window.dispatchEvent(
        new CustomEvent('tga_toast', {
          detail: { message: remaining <= 0 ? 'Ya tienes el stock máximo de este libro en tu carrito.' : 'No hay stock suficiente para esa cantidad' }
        })
      );
      return;
    }

    try {
      // POST /api/carrito:
      // - Agrega el libro al carrito.
      await apiFetch('/api/carrito', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_usuario: user.id_usuario,
          id_libro: book.id_libro,
          cantidad
        })
      });
      window.dispatchEvent(new Event('tga_cart_updated'));
      window.dispatchEvent(new Event('tga_catalog_updated'));
      window.dispatchEvent(new CustomEvent('tga_toast', { detail: { message: 'Agregado al carrito' } }));
    } catch (e) {
      handleCompraError(e?.message || 'No se pudo registrar la compra');
    }
  };

  const onRent = async () => {
    if (!book?.id_libro) return;
    const user = ensureUserOrRedirect();
    if (!user) return;

    const cantidad = Number(buyQty);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      window.dispatchEvent(new CustomEvent('tga_toast', { detail: { message: 'Cantidad inválida' } }));
      return;
    }

    if (Number.isFinite(stockRenta) && cantidad > stockRenta) {
      window.dispatchEvent(new CustomEvent('tga_toast', { detail: { message: 'No hay stock suficiente para esa cantidad' } }));
      return;
    }

    try {
      // POST /api/prestamos:
      // - Crea un préstamo y marca el libro como no disponible (backend transaccional).
      await apiFetch('/api/prestamos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_usuario: user.id_usuario,
          id_libro: book.id_libro,
          cantidad
        })
      });
      window.dispatchEvent(new Event('tga_catalog_updated'));
      window.dispatchEvent(new Event('tga_loans_updated'));
      window.dispatchEvent(new CustomEvent('tga_toast', { detail: { message: 'Agregado a su lista de renta' } }));
    } catch (e) {
      handleCompraError(e?.message || 'No se pudo registrar el préstamo');
    }
  };

  // showRent:
  // - En algunos modos (por ejemplo "comprar") se oculta la acción de rentar.
  // - Esto permite reutilizar la card en pantallas con objetivos distintos.
  const showRent = mode !== 'comprar';
  const showBuy = mode !== 'rentable';
  const showQty = showBuy || showRent;

  const qtyMax =
    showBuy && !showRent && Number.isFinite(stockCompra)
      ? buyRemaining
      : showRent && !showBuy && Number.isFinite(stockRenta)
        ? stockRenta
        : undefined;

  const inputMax =
    Number.isFinite(qtyMax) && qtyMax > 0
      ? qtyMax
      : Number.isFinite(stockCompra) && Number.isFinite(stockRenta)
        ? Math.max(buyRemaining ?? 0, stockRenta)
        : Number.isFinite(stockCompra)
          ? buyRemaining ?? undefined
          : Number.isFinite(stockRenta)
            ? stockRenta
            : undefined;

  return (
    <div className="card">
      <div className="card-inner">
        <img
          src={coverSrc}
          alt={`Portada del libro ${book?.titulo || ''}`.trim()}
          className="book-cover"
          onError={(ev) => {
            ev.currentTarget.onerror = null;
            ev.currentTarget.src = createCoverDataUri(book?.titulo);
          }}
        />

        <div className="book-meta">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-gray-900">{book?.titulo || 'Sin título'}</h3>
              <p className="text-sm text-gray-600 mt-1">
                {(book?.autor || 'Autor desconocido') + (book?.nombre_categoria ? ` · ${book.nombre_categoria}` : '')}
              </p>
            </div>
            <span className={`status-badge ${statusClass}`}>{statusText}</span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            {hasSplitStock ? (
              <>
                <span>Stock compra: {Number.isFinite(stockCompra) ? stockCompra : 0}</span>
                <span>Stock préstamo: {Number.isFinite(stockRenta) ? stockRenta : 0}</span>
              </>
            ) : (
              <span>Stock: {stockValue}</span>
            )}

            {/*
              Input de cantidad (compra):
              - Se coloca junto al stock para que el usuario lo vea como parte del “control de inventario”.
              - Se deshabilita si no hay stock de compra.
              - Se limita el máximo cuando stock_compra está disponible.
            */}
            {showQty ? (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">Cantidad</span>
                <input
                  type="number"
                  min={1}
                  max={inputMax}
                  className="qty-input-sm w-16"
                  value={buyQty}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') {
                      setBuyQty('');
                      return;
                    }
                    let n = Number(raw);
                    if (!Number.isFinite(n)) return;
                    n = Math.trunc(n);
                    if (n < 1) n = 1;
                    if (Number.isFinite(inputMax) && inputMax > 0 && n > inputMax) n = inputMax;
                    setBuyQty(String(n));
                  }}
                  disabled={showBuy && !showRent ? !buyAvailable : showRent && !showBuy ? !rentAvailable : !(buyAvailable || rentAvailable)}
                />
              </div>
            ) : null}
          </div>

          <div className={`book-actions ${mode !== 'todos' ? 'book-actions-2' : ''}`}>
            <button type="button" className="btn-details" onClick={() => onOpenDetails?.(book)}>
              Ver detalles
            </button>

            {showBuy ? (
              <button
                type="button"
                className={`btn-buy ${!buyAvailable ? 'btn-disabled' : ''}`}
                disabled={!buyAvailable}
                onClick={onBuy}
              >
                Comprar
              </button>
            ) : null}

            {showRent ? (
              <button
                type="button"
                className={`btn-secondary rent-action ${!rentAvailable ? 'btn-disabled' : ''}`}
                disabled={!rentAvailable}
                onClick={onRent}
              >
                Rentar
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
