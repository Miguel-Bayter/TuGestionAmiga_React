/*
  Rentable.jsx

  Pantalla de libros disponibles para préstamo.

  ¿Por qué existe?
  - En la maqueta había una sección "Rentable".
  - En la versión actual, la ruta /rentable renderiza el Dashboard con el modo "rentable".
  - Este archivo se conserva como pantalla alternativa (por referencia) y consume GET /api/libros?disponible=true.
*/

import React, { useEffect, useMemo, useState } from 'react';
import BookCard from '../components/BookCard.jsx';
import BookDetailsModal from '../components/BookDetailsModal.jsx';
import { safeJson } from '../lib/api.js';
import { ensureCoverMap } from '../lib/covers.js';

export default function Rentable() {
  // Estado:
  // - books: solo libros disponibles (según backend).
  // - query: búsqueda local (no llama backend por cada letra).
  // - viewGrid: alterna layout.
  // - detailsOpen/detailsBook: controlan modal.
  const [books, setBooks] = useState([]);
  const [query, setQuery] = useState('');
  const [viewGrid, setViewGrid] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsBook, setDetailsBook] = useState(null);

  // openDetails:
  // - Abre el modal con el libro seleccionado.
  const openDetails = (book) => {
    setDetailsBook(book);
    setDetailsOpen(true);
  };

  // load:
  // - Trae solo libros disponibles desde el backend.
  // - Se usa safeJson para no romper el parseo si ocurre un error.
  const load = async () => {
    await ensureCoverMap();

    try {
      const res = await fetch('/api/libros?disponible=true');
      const data = await safeJson(res);
      if (!res.ok || !Array.isArray(data)) return;
      setBooks(data);
    } catch {
      setBooks([]);
    }
  };

  useEffect(() => {
    // Carga inicial.
    load();
  }, []);

  const filtered = useMemo(() => {
    // Filtro local por título/autor.
    // No vuelve a llamar backend; filtra el array ya cargado.
    const q = query.trim().toLowerCase();
    if (!q) return books;

    return books.filter((b) => {
      const t = String(b?.titulo || '').toLowerCase();
      const a = String(b?.autor || '').toLowerCase();
      return t.includes(q) || a.includes(q);
    });
  }, [books, query]);

  return (
    <div>
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Buscar libros disponibles"
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

        <div className="mt-4 flex flex-wrap items-center gap-2" id="filter-buttons">
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
            <div className="text-center text-gray-500 py-10">No hay libros disponibles en este momento.</div>
          ) : null}

          {filtered.map((b) => (
            <BookCard key={b.id_libro} book={b} onOpenDetails={openDetails} mode="todos" />
          ))}
        </div>
      </div>

      <BookDetailsModal
        open={detailsOpen}
        onClose={() => {
          // Al cerrar el modal recargamos:
          // - Si se compró o se prestó desde el detalle, la disponibilidad pudo cambiar.
          setDetailsOpen(false);
          load();
        }}
        book={detailsBook}
      />
    </div>
  );
}
