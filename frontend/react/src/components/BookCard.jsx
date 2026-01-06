/*
  BookCard.jsx

  Este componente representa una tarjeta de libro.

  ¿Por qué existe?
  - En la maqueta HTML (index.html) la card se repite muchas veces.
  - En React lo convertimos en componente para reutilizar la estructura y evitar duplicar JSX.
  - Aquí también centralizamos las acciones (Ver detalles, Comprar, Rentar).
*/

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api.js';
import { clearStoredUser, getStoredUser } from '../lib/auth.js';
import { createCoverDataUri, getLocalCoverUrl } from '../lib/covers.js';

export default function BookCard({ book, onOpenDetails, mode }) {
  const navigate = useNavigate();

  // buyQty:
  // - Guarda la cantidad que el usuario quiere comprar desde la tarjeta.
  // - Se usa para reemplazar el `prompt()` del navegador y mantener la interacción dentro de la UI.
  // - Se envía tal cual al backend en POST /api/carrito.
  const [buyQty, setBuyQty] = useState(1);

  // Disponibilidad:
  // - En la base de datos `disponibilidad` se maneja como 1/0.
  // - Con esto controlamos UI (badge) y deshabilitamos botones.
  const stockCompra = Number(book?.stock_compra);
  const stockRenta = Number(book?.stock_renta);
  const hasSplitStock = Number.isFinite(stockCompra) || Number.isFinite(stockRenta);

  const buyAvailable = Number.isFinite(stockCompra) ? stockCompra > 0 : Number(book?.disponibilidad) === 1;
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

  const coverSrc = getLocalCoverUrl(book?.titulo) || createCoverDataUri(book?.titulo);

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
      window.alert('Cantidad inválida');
      return;
    }

    if (Number.isFinite(stockCompra) && cantidad > stockCompra) {
      window.alert('No hay stock suficiente para esa cantidad');
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
      navigate('/carrito');
    } catch (e) {
      handleCompraError(e?.message || 'No se pudo registrar la compra');
    }
  };

  const onRent = async () => {
    if (!book?.id_libro) return;
    const user = ensureUserOrRedirect();
    if (!user) return;

    try {
      // POST /api/prestamos:
      // - Crea un préstamo y marca el libro como no disponible (backend transaccional).
      await apiFetch('/api/prestamos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_usuario: user.id_usuario,
          id_libro: book.id_libro
        })
      });
      window.alert('Préstamo registrado');
    } catch (e) {
      handleCompraError(e?.message || 'No se pudo registrar el préstamo');
    }
  };

  // showRent:
  // - En algunos modos (por ejemplo "comprar") se oculta la acción de rentar.
  // - Esto permite reutilizar la card en pantallas con objetivos distintos.
  const showRent = mode !== 'comprar';

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
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-700">Cantidad</span>
              <input
                type="number"
                min={1}
                max={Number.isFinite(stockCompra) ? stockCompra : undefined}
                className="qty-input-sm w-16"
                value={buyQty}
                onChange={(e) => setBuyQty(e.target.value)}
                disabled={!buyAvailable}
              />
            </div>
          </div>

          <div className="book-actions">
            <button type="button" className="btn-details" onClick={() => onOpenDetails?.(book)}>
              Ver detalles
            </button>

            <button
              type="button"
              className={`btn-buy ${!buyAvailable ? 'btn-disabled' : ''}`}
              disabled={!buyAvailable}
              onClick={onBuy}
            >
              Comprar
            </button>

            {showRent ? (
              <button
                type="button"
                className={`btn-secondary rent-action ${!rentAvailable ? 'btn-disabled' : ''}`}
                disabled={!rentAvailable}
                onClick={onRent}
              >
                Rentar
              </button>
            ) : (
              <span />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
