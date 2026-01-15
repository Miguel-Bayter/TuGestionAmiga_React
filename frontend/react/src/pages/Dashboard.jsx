/*
  Dashboard.jsx

  Pantalla principal: búsqueda + filtros + listado de libros.

  ¿Por qué existe?
  - En el documento MD esta pantalla corresponde al Dashboard / ListaLibros.
  - Reutiliza el diseño del index.html (input de búsqueda, filtros y cards).
  - Consume GET /api/libros y muestra los resultados.
*/

import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BookCard from '../components/BookCard.jsx';
import BookDetailsModal from '../components/BookDetailsModal.jsx';
import { apiFetch, safeJson } from '../lib/api.js';
import { getStoredUser, subscribeAuth } from '../lib/auth.js';
import { createCoverDataUri, ensureCoverMap, getLocalCoverUrl } from '../lib/covers.js';

const formatDateOnly = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value || '');
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const isBookAvailable = (b) => {
  const stockCompra = Number(b?.stock_compra);
  const stockRenta = Number(b?.stock_renta);
  const hasSplitStock = Number.isFinite(stockCompra) || Number.isFinite(stockRenta);
  if (hasSplitStock) {
    const buy = Number.isFinite(stockCompra) ? stockCompra : 0;
    const rent = Number.isFinite(stockRenta) ? stockRenta : 0;
    return buy > 0 || rent > 0;
  }
  return Number(b?.disponibilidad) === 1;
};

const isBookRentable = (b) => {
  const stockRenta = Number(b?.stock_renta);
  if (Number.isFinite(stockRenta)) return stockRenta > 0;
  return Number(b?.disponibilidad) === 1;
};

const isBookPurchasable = (b) => {
  const stockCompra = Number(b?.stock_compra);
  if (Number.isFinite(stockCompra)) return stockCompra > 0;
  return Number(b?.disponibilidad) === 1;
};

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();

  const showInicio = location.pathname === '/';
  const showBuscar = location.pathname === '/buscar' || location.pathname === '/rentable';

  const [user, setUser] = useState(() => getStoredUser());

  // Estado principal:
  // - books: catálogo traído desde el backend.
  // - query: texto de búsqueda.
  // - mode: pestaña activa (todos/comprar/rentable).
  // - viewGrid: alterna entre vista tipo lista y vista tipo grid.
  // - detailsOpen/detailsBook: controlan el modal de detalle.
  const [books, setBooks] = useState([]);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('todos');
  const [viewGrid, setViewGrid] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsBook, setDetailsBook] = useState(null);

  const isAdmin = Number(user?.id_rol) === 1;
  const [usersCount, setUsersCount] = useState(0);
  const [adminLoans, setAdminLoans] = useState([]);
  const [myLoansCount, setMyLoansCount] = useState(0);

  useEffect(() => {
    return subscribeAuth((next) => setUser(next));
  }, []);

  // Si el usuario entra por /rentable, ponemos el modo en "rentable".
  // Esto permite que exista la ruta para compatibilidad, pero la UI principal
  // queda con las pestañas (Todos / Comprar / Rentable).
  useEffect(() => {
    if (location.pathname === '/rentable') {
      setMode('rentable');
    }
  }, [location.pathname]);

  // openDetails/closeDetails:
  // - Abre/cierra el modal.
  // - Guardamos el libro seleccionado para pasarlo al modal.
  const openDetails = (book) => {
    setDetailsBook(book);
    setDetailsOpen(true);
  };

  const closeDetails = () => {
    setDetailsOpen(false);
  };

  // load:
  // - Sincroniza el catálogo desde el backend.
  // - ensureCoverMap prepara el mapa de portadas locales para que las cards tengan imagen.
  // - safeJson evita que un error HTML (por ejemplo 500) rompa la app al parsear JSON.
  const load = async () => {
    await ensureCoverMap();

    try {
      const res = await fetch('/api/libros');
      const data = await safeJson(res);
      if (!res.ok || !Array.isArray(data)) return;
      setBooks(data);
    } catch {
      setBooks([]);
    }
  };

  useEffect(() => {
    // Carga inicial del catálogo al montar la pantalla.
    load();
  }, []);

  useEffect(() => {
    const onCatalogUpdated = () => load();
    const onLoansUpdated = () => {
      const uid = user?.id_usuario;
      if (!uid) return;
      apiFetch(`/api/prestamos?id_usuario=${encodeURIComponent(uid)}`)
        .then((rows) => {
          const list = Array.isArray(rows) ? rows : [];
          const active = list.filter((r) => {
            const st = String(r?.estado || '').toLowerCase();
            return !st.includes('devuel');
          });
          setMyLoansCount(active.length);
        })
        .catch(() => setMyLoansCount(0));
    };

    window.addEventListener('tga_catalog_updated', onCatalogUpdated);
    window.addEventListener('tga_loans_updated', onLoansUpdated);
    return () => {
      window.removeEventListener('tga_catalog_updated', onCatalogUpdated);
      window.removeEventListener('tga_loans_updated', onLoansUpdated);
    };
  }, [user?.id_usuario]);

  useEffect(() => {
    if (!showBuscar) return;
    try {
      const sp = new URLSearchParams(location.search || '');
      const q = sp.get('q');
      if (q !== null) setQuery(String(q));
    } catch {
      // ignore
    }
  }, [location.search, showBuscar]);

  useEffect(() => {
    let alive = true;

    const loadAdminMetrics = async () => {
      if (!isAdmin) {
        if (alive) {
          setUsersCount(0);
          setAdminLoans([]);
        }
        return;
      }

      try {
        const users = await apiFetch('/api/admin/usuarios');
        if (alive) setUsersCount(Array.isArray(users) ? users.length : 0);
      } catch {
        if (alive) setUsersCount(0);
      }

      try {
        const loans = await apiFetch('/api/admin/prestamos');
        if (alive) setAdminLoans(Array.isArray(loans) ? loans : []);
      } catch {
        if (alive) setAdminLoans([]);
      }
    };

    loadAdminMetrics();
    return () => {
      alive = false;
    };
  }, [isAdmin]);

  useEffect(() => {
    let alive = true;

    const loadMyLoans = async () => {
      const uid = user?.id_usuario;
      if (!uid) {
        if (alive) setMyLoansCount(0);
        return;
      }

      try {
        const rows = await apiFetch(`/api/prestamos?id_usuario=${encodeURIComponent(uid)}`);
        const list = Array.isArray(rows) ? rows : [];
        const active = list.filter((r) => {
          const st = String(r?.estado || '').toLowerCase();
          return !st.includes('devuel');
        });
        if (alive) setMyLoansCount(active.length);
      } catch {
        if (alive) setMyLoansCount(0);
      }
    };

    loadMyLoans();
    return () => {
      alive = false;
    };
  }, [user?.id_usuario]);

  useEffect(() => {
    if (!detailsOpen) return;

    // Accesibilidad/UX:
    // - Permite cerrar el modal con Escape.
    const onKey = (e) => {
      if (e.key === 'Escape') closeDetails();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [detailsOpen]);

  const filtered = useMemo(() => {
    // Filtro por texto:
    // - Se filtra por título o autor.
    const q = query.trim().toLowerCase();
    const byQuery = !q
      ? books
      : books.filter((b) => {
        const t = String(b?.titulo || '').toLowerCase();
        const a = String(b?.autor || '').toLowerCase();
        return t.includes(q) || a.includes(q);
      });

    // Filtros por pestaña:
    // - todos: muestra todo
    // - comprar: se mantiene el listado, pero ocultamos el botón de "Rentar" en BookCard
    // - rentable: muestra solo los disponibles (disponibilidad === 1)
    if (mode === 'rentable') {
      return byQuery.filter((b) => isBookRentable(b));
    }

    if (mode === 'comprar') {
      return byQuery.filter((b) => isBookPurchasable(b));
    }

    return byQuery;
  }, [books, query, mode]);

  const totalBooks = books.length;
  const availableBooks = useMemo(() => books.filter((b) => isBookAvailable(b)).length, [books]);
  const rentableBooks = useMemo(() => books.filter((b) => isBookRentable(b)).length, [books]);

  const activeAdminLoans = useMemo(() => {
    if (!isAdmin) return [];
    const list = Array.isArray(adminLoans) ? adminLoans : [];
    return list.filter((r) => {
      const st = String(r?.estado || '').toLowerCase();
      return st.includes('activo') || st.includes('venc');
    });
  }, [adminLoans, isAdmin]);

  const activeAdminLoansPreview = useMemo(() => activeAdminLoans.slice(0, 5), [activeAdminLoans]);
  const latestBooks = useMemo(() => (Array.isArray(books) ? books.slice(0, 4) : []), [books]);

  return (
    <div className="space-y-6">
      {showInicio ? (
        <section className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200/60 p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Bienvenido, {user?.nombre || 'Usuario'}</h1>
          <p className="text-sm text-gray-500">Gestiona tu biblioteca de manera eficiente</p>
        </div>

        <div className="mt-5">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                id="quick-search"
                type="text"
                placeholder="Búsqueda rápida de libros..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full h-11 pl-10 pr-3 text-sm text-gray-900 border border-gray-200 rounded-xl bg-gray-50 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                const sp = new URLSearchParams();
                const q = query.trim();
                if (q) sp.set('q', q);
                navigate(`/buscar${sp.toString() ? `?${sp.toString()}` : ''}`);
              }}
              className="h-11 text-gray-700 bg-gray-100 hover:bg-gray-200 font-semibold rounded-xl text-sm px-4 w-full sm:w-auto"
            >
              Click para buscar
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-2xl bg-white ring-1 ring-gray-200/60 shadow-sm p-4 border-l-4 border-blue-600">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-gray-500">Total Libros</div>
                <div className="text-2xl font-bold text-gray-900">{totalBooks}</div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6l-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h5l2-2m0-14l2-2h5a2 2 0 012 2v14a2 2 0 01-2 2h-5l-2-2m0-14v14" />
                </svg>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white ring-1 ring-gray-200/60 shadow-sm p-4 border-l-4 border-amber-500">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-gray-500">{isAdmin ? 'Préstamos Activos' : 'Mis Préstamos'}</div>
                <div className="text-2xl font-bold text-gray-900">{isAdmin ? activeAdminLoans.length : myLoansCount}</div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V6a4 4 0 018 0v1" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 7h12l-1 14H7L6 7z" />
                </svg>
              </div>
            </div>
          </div>

          {isAdmin ? (
            <div className="rounded-2xl bg-white ring-1 ring-gray-200/60 shadow-sm p-4 border-l-4 border-emerald-500">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-gray-500">Usuarios Registrados</div>
                  <div className="text-2xl font-bold text-gray-900">{usersCount}</div>
                </div>
                <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20a4 4 0 00-8 0" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 20a4 4 0 00-6-3.5" />
                  </svg>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-white ring-1 ring-gray-200/60 shadow-sm p-4 border-l-4 border-emerald-500">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-gray-500">Libros Rentables</div>
                  <div className="text-2xl font-bold text-gray-900">{rentableBooks}</div>
                </div>
                <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.105 0-2 .895-2 2v7a2 2 0 104 0v-7c0-1.105-.895-2-2-2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 10V7a5 5 0 0110 0v3" />
                  </svg>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-white ring-1 ring-gray-200/60 shadow-sm p-4 border-l-4 border-purple-500">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-gray-500">Libros Disponibles</div>
                <div className="text-2xl font-bold text-gray-900">{availableBooks}</div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8L13 15" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 17H6a2 2 0 01-2-2V6a2 2 0 012-2h9a2 2 0 012 2v5" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {isAdmin ? (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                navigate('/admin?tab=libros');
              }}
              className="w-full rounded-2xl bg-blue-700 hover:bg-blue-800 text-white shadow-sm ring-1 ring-blue-700/30 p-4 text-left flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="text-sm font-bold">Gestionar Libros</div>
                <div className="text-xs text-blue-100">Administra el catálogo</div>
              </div>
              <svg className="h-6 w-6 text-blue-100" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6l-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h5l2-2m0-14l2-2h5a2 2 0 012 2v14a2 2 0 01-2 2h-5l-2-2m0-14v14" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => navigate('/admin?tab=usuarios')}
              className="w-full rounded-2xl bg-white hover:bg-gray-50 shadow-sm ring-1 ring-gray-200/60 p-4 text-left flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="text-sm font-bold text-gray-900">Gestionar Usuarios</div>
                <div className="text-xs text-gray-500">Administra usuarios del sistema</div>
              </div>
              <svg className="h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.5 20.25a7.5 7.5 0 0115 0" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="mt-4">
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200/60 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-gray-900">Espacio publicitario</div>
                  <div className="text-xs text-gray-500">Reservado para integrar Google AdSense</div>
                </div>
                <div className="h-10 w-10 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center">
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7h16M4 12h16M4 17h16" />
                  </svg>
                </div>
              </div>
              <div className="mt-3 h-24 sm:h-28 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50" />
            </div>
          </div>
        )}

        <div className="mt-6">
          <h2 className="text-base font-bold text-gray-900">Últimos Libros Añadidos</h2>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {latestBooks.map((b) => {
              const title = String(b?.titulo || 'Libro');
              const author = String(b?.autor || '');
              const img = getLocalCoverUrl(title) || createCoverDataUri(title);
              return (
                <button
                  key={b.id_libro}
                  type="button"
                  onClick={() => openDetails(b)}
                  className="text-left rounded-2xl bg-white shadow-sm ring-1 ring-gray-200/60 overflow-hidden hover:bg-gray-50"
                >
                  <div className="h-24 w-full bg-gray-100">
                    <img src={img} alt={title} className="h-full w-full object-cover" />
                  </div>
                  <div className="p-3">
                    <div className="text-sm font-semibold text-gray-900 truncate">{title}</div>
                    <div className="text-xs text-gray-500 truncate">{author}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      ) : null}

      {showInicio && isAdmin ? (
        <section className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200/60 p-5 sm:p-6">
          <h2 className="text-base font-bold text-gray-900">Préstamos Activos</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-2 pr-4 font-semibold">Usuario</th>
                  <th className="py-2 pr-4 font-semibold">Libro</th>
                  <th className="py-2 pr-4 font-semibold">Fecha de Vencimiento</th>
                  <th className="py-2 pr-4 font-semibold">Estado</th>
                  <th className="py-2 pr-4 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200/70">
                {activeAdminLoansPreview.length === 0 ? (
                  <tr>
                    <td className="py-4 text-gray-500" colSpan={5}>
                      No hay préstamos activos.
                    </td>
                  </tr>
                ) : null}

                {activeAdminLoansPreview.map((r, idx) => {
                  const usuario =
                    String(
                      r?.nombre_usuario ||
                        r?.usuario ||
                        r?.nombre ||
                        r?.nombreCliente ||
                        r?.cliente ||
                        ''
                    ) ||
                    `Usuario ${idx + 1}`;

                  const libro = String(r?.titulo || r?.libro || r?.nombre_libro || r?.nombreLibro || '') || 'Libro';
                  const venc =
                    r?.fecha_devolucion ||
                    r?.fechaDevolucion ||
                    r?.fecha_devolución ||
                    r?.fecha_vencimiento ||
                    r?.fechaVencimiento ||
                    r?.fecha_fin ||
                    r?.fechaFin ||
                    '';
                  const estado = String(r?.estado || '').trim() || 'Activo';
                  const estadoLower = estado.toLowerCase();
                  const isLate = estadoLower.includes('venc');

                  return (
                    <tr key={r?.id_prestamo ?? `${usuario}-${libro}-${idx}`} className="text-gray-700">
                      <td className="py-3 pr-4 whitespace-nowrap">{usuario}</td>
                      <td className="py-3 pr-4 whitespace-nowrap">{libro}</td>
                      <td className="py-3 pr-4 whitespace-nowrap">{venc ? formatDateOnly(venc) : '-'}</td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                            isLate
                              ? 'bg-rose-50 text-rose-700 ring-rose-200'
                              : 'bg-amber-50 text-amber-700 ring-amber-200'
                          }`}
                        >
                          {estado}
                        </span>
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => navigate('/admin?tab=prestamos')}
                          className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                        >
                          Ver detalles
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {showBuscar ? (
        <div className="mb-6">
        <div className="flex flex-col sm:flex-row gap-2">
          {/*
            Barra de búsqueda:
            - Cambia el estado `query`.
            - El botón "Buscar" recarga desde backend (útil si cambió disponibilidad).
          */}
          <input
            type="text"
            placeholder="Buscar libros (ej. Java)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full p-4 text-sm text-gray-900 border border-gray-300 rounded-lg bg-gray-50 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            type="button"
            onClick={() => load()}
            className="text-white bg-blue-600 hover:bg-blue-700 font-medium rounded-lg text-sm px-4 py-3 sm:py-2 w-full sm:w-auto"
          >
            Buscar
          </button>
        </div>

        {/*
          Botones de filtro:
          - Cambian el modo de renderización.
          - "Comprar" filtra libros disponibles para compra (stock_compra > 0 si existe, o disponibilidad=1 en esquemas antiguos).
          - "Rentable" filtra libros disponibles para préstamo (stock_renta > 0 si existe, o disponibilidad=1 en esquemas antiguos).
        */}
        <div className="mt-4 flex flex-wrap items-center gap-2" id="filter-buttons">
          <button
            type="button"
            className={mode === 'todos' ? 'filter-btn-active' : 'filter-btn'}
            onClick={() => setMode('todos')}
          >
            <svg
              className="w-4 h-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span>Todos</span>
          </button>

          <button
            type="button"
            className={mode === 'comprar' ? 'filter-btn-active' : 'filter-btn'}
            onClick={() => setMode('comprar')}
          >
            <svg
              className="w-4 h-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.5 7H19M7 13l-2-8m2 8h12"
              />
            </svg>
            <span>Comprar</span>
          </button>

          <button
            type="button"
            className={mode === 'rentable' ? 'filter-btn-active' : 'filter-btn'}
            onClick={() => {
              setMode('rentable');
            }}
          >
            <svg
              className="w-4 h-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 8c-1.105 0-2 .895-2 2v7a2 2 0 104 0v-7c0-1.105-.895-2-2-2z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M7 10V7a5 5 0 0110 0v3"
              />
            </svg>
            <span>Rentable</span>
          </button>

          <button
            id="view-toggle"
            type="button"
            className="w-full sm:w-auto sm:ml-auto filter-btn justify-center"
            onClick={() => setViewGrid((v) => !v)}
            aria-label="Cambiar vista"
          >
            <span id="view-toggle-label">Cambiar vista</span>
          </button>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Resultados</h2>

          <div
            id="results-container"
            className={
              viewGrid
                ? 'view-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
                : 'space-y-4'
            }
          >
            {filtered.length === 0 ? (
              <div className="text-center text-gray-500 py-10">
                No hay libros cargados todavía. Carga datos de ejemplo en MySQL y recarga.
              </div>
            ) : null}

            {filtered.map((b) => (
              <BookCard key={b.id_libro} book={b} onOpenDetails={openDetails} mode={mode} />
            ))}
          </div>
        </div>
      </div>
      ) : null}

      <BookDetailsModal
        open={detailsOpen}
        onClose={() => {
          closeDetails();
          load();
        }}
        book={detailsBook}
        mode={mode}
      />
    </div>
  );
}
