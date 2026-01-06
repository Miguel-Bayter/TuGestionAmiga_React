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
import { safeJson } from '../lib/api.js';
import { ensureCoverMap } from '../lib/covers.js';

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();

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
      return byQuery.filter((b) => Number(b?.disponibilidad) === 1);
    }

    return byQuery;
  }, [books, query, mode]);

  return (
    <div>
      <div className="mb-6">
        <div className="relative">
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
            className="w-full p-4 pl-10 text-sm text-gray-900 border border-gray-300 rounded-lg bg-gray-50 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            type="button"
            onClick={() => load()}
            className="text-white absolute right-2.5 bottom-2.5 bg-blue-600 hover:bg-blue-700 font-medium rounded-lg text-sm px-4 py-2"
          >
            Buscar
          </button>
        </div>

        {/*
          Botones de filtro:
          - Cambian el modo de renderización.
          - "Comprar" no filtra, solo oculta el botón de rentar en BookCard.
          - "Rentable" filtra solo disponibilidad=1.
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
              // Si estás en otra ruta, dejo la navegación en Inicio para mantener el flujo.
              // (la pantalla sigue siendo la misma).
              if (location.pathname !== '/') navigate('/');
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

      <BookDetailsModal
        open={detailsOpen}
        onClose={() => {
          closeDetails();
          load();
        }}
        book={detailsBook}
      />
    </div>
  );
}
