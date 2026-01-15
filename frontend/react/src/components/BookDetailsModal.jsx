/*
  BookDetailsModal.jsx

  Modal de detalle.

  ¿Por qué existe?
  - La maqueta original tenía un botón "Ver detalles".
  - En el proyecto HTML se resolvió con un modal generado por JS.
  - En React lo convertimos en componente, pero mantenemos la misma idea:
    mostrar detalle del libro + historial de préstamos + acciones (comprar / prestar).
*/

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api.js';
import { clearStoredUser, getStoredUser } from '../lib/auth.js';
import { createCoverDataUri, ensureCoverMap, getLocalCoverUrl } from '../lib/covers.js';

export default function BookDetailsModal({ open, onClose, book, mode }) {
  const navigate = useNavigate();
  const dialogRef = useRef(null);
  const scrollYRef = useRef(0);

  const [coversRev, setCoversRev] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    ensureCoverMap()
      .then(() => {
        if (!cancelled) setCoversRev((v) => v + 1);
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    if (typeof document === 'undefined') return;

    scrollYRef.current = typeof window !== 'undefined' ? window.scrollY : 0;

    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollBarWidth > 0) document.body.style.paddingRight = `${scrollBarWidth}px`;

    const t = setTimeout(() => {
      try {
        dialogRef.current?.focus?.({ preventScroll: true });
      } catch {
        dialogRef.current?.focus?.();
      }

      try {
        window.scrollTo(0, scrollYRef.current || 0);
      } catch {
      }
    }, 0);

    return () => {
      clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [open]);

  // detail:
  // - Contiene la respuesta de GET /api/libros/:id.
  // - Se guarda por separado de `book` para permitir refrescar datos desde backend.
  const [detail, setDetail] = useState(null);

  // history:
  // - Contiene el historial de préstamos del libro.
  // - Por privacidad, este historial se reserva a administradores.
  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState('');

  // buyQty:
  // - Guarda la cantidad que el usuario quiere comprar desde el modal.
  // - Existe para evitar el `prompt()` del navegador (mejor UX y estilo consistente).
  // - Se envía al backend en POST /api/carrito.
  const [buyQty, setBuyQty] = useState(1);

  const [cartRev, setCartRev] = useState(0);

  useEffect(() => {
    const onUpdated = () => setCartRev((v) => v + 1);
    window.addEventListener('tga_cart_updated', onUpdated);
    return () => window.removeEventListener('tga_cart_updated', onUpdated);
  }, []);

  // Usuario actual (sesión simple):
  // - Sirve para decidir si se muestra historial.
  // - También se usa para decidir qué ruta se redirige si falta login.
  const currentUser = getStoredUser();
  const isAdmin = Number(currentUser?.id_rol) === 1;

  // idLibro:
  // - Normalizamos el id a Number para evitar bugs por strings.
  // - Si no es un número válido, el modal no intenta llamar la API.
  const idLibro = Number(book?.id_libro);

  // Carga del detalle:
  // - Se ejecuta cuando el modal se abre.
  // - Usa una bandera `cancelled` para evitar setState después de un cierre rápido.
  useEffect(() => {
    if (!open) return;
    if (!Number.isFinite(idLibro)) return;

    let cancelled = false;

    (async () => {
      try {
        const data = await apiFetch(`/api/libros/${idLibro}`);
        if (!cancelled) setDetail(data);
      } catch {
        if (!cancelled) setDetail(book || null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, idLibro, book]);

  useEffect(() => {
    if (!open) return;
    setBuyQty(1);
  }, [open, idLibro]);

  useEffect(() => {
    if (!open) return;
    if (!Number.isFinite(idLibro)) return;

    if (!isAdmin) {
      setHistory([]);
      setHistoryError('');
      return;
    }

    let cancelled = false;

    (async () => {
      setHistoryError('');
      try {
        const rows = await apiFetch(`/api/libros/${idLibro}/historial`);
        if (!cancelled) setHistory(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cancelled) {
          setHistory([]);
          setHistoryError('No se pudo cargar el historial.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, idLibro, isAdmin]);

  // effective:
  // - Prioridad: detail (backend) -> book (props) -> null.
  // - Permite que el modal muestre algo incluso si el fetch falla.
  const effective = detail || book || null;

  // Estado del libro:
  // - Se usa para deshabilitar botones de compra/préstamo.
  const stockCompra = Number(effective?.stock_compra);
  const stockRenta = Number(effective?.stock_renta);
  const hasSplitStock = Number.isFinite(stockCompra) || Number.isFinite(stockRenta);

  const getInCartQty = () => {
    try {
      const list = typeof window !== 'undefined' ? window.__tga_cart_items : null;
      const items = Array.isArray(list) ? list : [];
      const id = Number(effective?.id_libro);
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

  const buyAvailable = Number.isFinite(stockCompra) ? buyRemaining > 0 : Number(effective?.disponibilidad) === 1;
  const rentAvailable = Number.isFinite(stockRenta) ? stockRenta > 0 : Number(effective?.disponibilidad) === 1;
  const isAvailable = hasSplitStock ? buyAvailable || rentAvailable : Number(effective?.disponibilidad) === 1;

  const formatMoney = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value ?? '');
    return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  };

  // coverSrc:
  // - Si hay portada local, la usamos.
  // - Si no, generamos un SVG por título.
  // - useMemo evita recalcular en cada render.
  const coverSrc = useMemo(() => {
    return (coversRev >= 0 ? getLocalCoverUrl(effective?.titulo) : '') || createCoverDataUri(effective?.titulo);
  }, [effective?.titulo, coversRev]);

  // ensureUserOrRedirect:
  // - Acciones como comprar y prestar requieren un usuario.
  // - Si no hay sesión, redirigimos a /login.
  const ensureUserOrRedirect = () => {
    const user = getStoredUser();
    if (!user?.id_usuario) {
      navigate('/login');
      return null;
    }
    return user;
  };

  // handleUserError:
  // - Caso común en demo: el usuario quedó en localStorage pero fue borrado de la BD.
  // - Si pasa, limpiamos la sesión y forzamos re-login.
  const handleUserError = (msg) => {
    if (String(msg).toLowerCase().includes('usuario no encontrado')) {
      clearStoredUser();
      window.alert(msg);
      navigate('/login');
      return;
    }
    window.alert(msg);
  };

  // onBuy:
  // - Registra una compra.
  // - El backend marca el libro como no disponible.
  const onBuy = async () => {
    const user = ensureUserOrRedirect();
    if (!user) return;
    if (!effective?.id_libro) return;

    // Validación simple:
    // - Evita cantidades vacías/negativas.
    // - Si stock_compra existe en la BD, se valida para no exceder el stock disponible.
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
      await apiFetch('/api/carrito', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_usuario: user.id_usuario, id_libro: effective.id_libro, cantidad })
      });
      window.dispatchEvent(new Event('tga_cart_updated'));
      window.dispatchEvent(new Event('tga_catalog_updated'));
      window.dispatchEvent(new CustomEvent('tga_toast', { detail: { message: 'Agregado al carrito' } }));
    } catch (e) {
      handleUserError(e?.message || 'No se pudo registrar la compra');
    }
  };

  // onRent:
  // - Registra un préstamo.
  // - Se calcula una fecha de devolución a 7 días.
  // - El backend valida disponibilidad y usa transacción.
  const onRent = async () => {
    const user = ensureUserOrRedirect();
    if (!user) return;
    if (!effective?.id_libro) return;

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
      await apiFetch('/api/prestamos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_usuario: user.id_usuario, id_libro: effective.id_libro, cantidad })
      });
      window.dispatchEvent(new Event('tga_catalog_updated'));
      window.dispatchEvent(new Event('tga_loans_updated'));
      window.dispatchEvent(new CustomEvent('tga_toast', { detail: { message: 'Agregado a su lista de renta' } }));
    } catch (e) {
      handleUserError(e?.message || 'No se pudo registrar el préstamo');
    }
  };

  // formatHistoryDate:
  // - Convierte fechas de MySQL (YYYY-MM-DD) a un formato legible.
  const formatHistoryDate = (value) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value || '');
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Render condicional:
  // - Si open=false, no renderizamos nada para no ocupar el DOM.
  if (!open) return null;

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

  const qtyDisabled = showBuy && !showRent ? !buyAvailable : showRent && !showBuy ? !rentAvailable : !(buyAvailable || rentAvailable);

  const portalTarget = typeof document !== 'undefined' ? document.body : null;

  const modal = (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/50 p-4 pt-6 sm:pt-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="flex flex-col w-full max-w-4xl max-h-[calc(100vh-2rem)] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="flex items-start justify-between gap-3 p-5 text-white bg-gradient-to-r from-indigo-600 to-sky-500">
          <div className="space-y-1">
            <p className="text-xs font-medium text-white/80">Libros &gt; Detalle del Libro</p>
            <h3 className="text-xl font-extrabold tracking-tight">Detalle del Libro</h3>
          </div>
          <button
            type="button"
            className="rounded-full bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-50 p-5">
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="grid grid-cols-1 gap-6 p-5 md:grid-cols-[240px_1fr]">
              <div className="flex flex-col items-center space-y-3 md:items-stretch">
                <img
                  src={coverSrc}
                  alt="Portada del libro"
                  className="w-full max-w-[260px] rounded-2xl border border-gray-100 object-cover shadow-sm md:max-w-none aspect-[3/4]"
                  onError={(ev) => {
                    ev.currentTarget.onerror = null;
                    ev.currentTarget.src = createCoverDataUri(effective?.titulo);
                  }}
                />
              </div>

              <div className="min-w-0 space-y-3">
                <h4 className="text-xl md:text-2xl font-extrabold tracking-tight text-gray-900">
                  {effective?.titulo || 'Cargando...'}
                </h4>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
                    <span className="font-semibold text-gray-900">Autor:</span>
                    <span className="text-gray-700">{effective?.autor ? String(effective.autor) : '-'}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
                    <span className="font-semibold text-gray-900">Precio:</span>
                    <span className="text-gray-700">
                      {effective?.valor != null && String(effective.valor) !== '' ? formatMoney(effective.valor) : '-'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
                    <span className="font-semibold text-gray-900">Stock compra:</span>
                    <span className="text-gray-700">{Number.isFinite(stockCompra) ? stockCompra : '-'}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
                    <span className="font-semibold text-gray-900">Stock préstamo:</span>
                    <span className="text-gray-700">{Number.isFinite(stockRenta) ? stockRenta : '-'}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
                    <span className="font-semibold text-gray-900">Cantidad:</span>
                    {showQty ? (
                      <input
                        type="number"
                        min={1}
                        max={inputMax}
                        className="qty-input w-24"
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
                        disabled={qtyDisabled}
                      />
                    ) : (
                      <span className="text-gray-700">-</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
                    <span className="font-semibold text-gray-900">Categoría:</span>
                    {effective?.nombre_categoria ? (
                      <span className="inline-flex items-center rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-200">
                        {String(effective.nombre_categoria)}
                      </span>
                    ) : (
                      <span className="text-gray-700">-</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
                    <span className="font-semibold text-gray-900">Disponibilidad:</span>
                    <span
                      className={
                        Number.isFinite(Number(effective?.disponibilidad))
                          ? isAvailable
                            ? 'inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200'
                            : 'inline-flex items-center rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200'
                          : 'inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 ring-1 ring-gray-200'
                      }
                    >
                      {Number.isFinite(Number(effective?.disponibilidad)) ? (isAvailable ? 'Disponible' : 'No disponible') : '-'}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="text-sm font-bold text-gray-900">Descripción</p>
                  <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-line">
                    {effective?.descripcion || 'Sin descripción.'}
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {showBuy ? (
                    <button
                      type="button"
                      className={`btn-indigo ${!buyAvailable ? 'btn-disabled' : ''}`}
                      disabled={!buyAvailable}
                      onClick={onBuy}
                    >
                      Comprar
                    </button>
                  ) : (
                    <span />
                  )}

                  {showRent ? (
                    <button
                      type="button"
                      className={`btn-emerald ${!rentAvailable ? 'btn-disabled' : ''}`}
                      disabled={!rentAvailable}
                      onClick={onRent}
                    >
                      Prestar
                    </button>
                  ) : (
                    <span />
                  )}

                  <button type="button" className="btn-neutral" onClick={onClose}>
                    Regresar
                  </button>
                </div>
              </div>
            </div>
          </div>

          {isAdmin ? (
            <div className="mt-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-5 py-4">
                <h5 className="text-base font-extrabold tracking-tight text-gray-900">Préstamos anteriores</h5>
              </div>
              <div className="p-5">
                {historyError ? <p className="text-sm text-rose-600">{historyError}</p> : null}

                {!historyError && (!Array.isArray(history) || history.length === 0) ? (
                  <p className="text-sm text-gray-500">Este libro todavía no tiene préstamos registrados.</p>
                ) : null}

                {Array.isArray(history) && history.length > 0 ? (
                  <div>
                    <div className="space-y-3 sm:hidden">
                      {history.map((row) => (
                        <div key={row.id_prestamo} className="rounded-xl border border-gray-200 bg-white p-4">
                          <p className="text-sm font-semibold text-gray-900">{row?.nombre || row?.correo || 'Usuario'}</p>
                          <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-gray-700">
                            <p>
                              <span className="font-semibold text-gray-900">Préstamo:</span>{' '}
                              {formatHistoryDate(row?.fecha_prestamo)}
                            </p>
                            <p>
                              <span className="font-semibold text-gray-900">Devolución:</span>{' '}
                              {formatHistoryDate(row?.fecha_devolucion)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="hidden sm:block overflow-hidden">
                      <table className="w-full table-fixed divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-600">
                              Usuario
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-600">
                              Fecha de préstamo
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-600">
                              Fecha de devolución
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {history.map((row) => (
                            <tr key={row.id_prestamo}>
                              <td
                                title={String(row?.nombre || row?.correo || 'Usuario')}
                                className="px-6 py-4 text-sm text-gray-800 truncate"
                              >
                                {row?.nombre || row?.correo || 'Usuario'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {formatHistoryDate(row?.fecha_prestamo)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {formatHistoryDate(row?.fecha_devolucion)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (!portalTarget) return modal;
  return createPortal(modal, portalTarget);
}
