/*
  Prestamos.jsx

  Tabla de préstamos del usuario.

  ¿Por qué existe?
  - En el HTML existe prestamos.html y se llena con GET /api/prestamos?id_usuario=...
  - Aquí hacemos lo mismo, pero con React, manteniendo el mismo diseño de tabla.
*/

import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api.js';
import { getStoredUser } from '../lib/auth.js';
import { createCoverDataUri, ensureCoverMap, getLocalCoverUrl } from '../lib/covers.js';

export default function Prestamos() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  // load:
  // - Sincroniza el estado de la tabla con el backend.
  // - Trae primero el mapa de portadas (covers) para que el listado muestre imágenes.
  // - Si no hay usuario en localStorage, se muestra un mensaje y no se llama la API.
  const load = async () => {
    setError('');
    await ensureCoverMap();

    // La sesión en este proyecto es "simple":
    // se guarda un objeto de usuario en localStorage.
    const user = getStoredUser();
    if (!user?.id_usuario) {
      setRows([]);
      setError('Inicia sesión para ver tus préstamos.');
      return;
    }

    try {
      // Endpoint del backend:
      // GET /api/prestamos?id_usuario=...
      // El backend valida que el id_usuario del query pertenezca al usuario autenticado
      // (o que sea admin).
      const data = await apiFetch(`/api/prestamos?id_usuario=${encodeURIComponent(user.id_usuario)}`);
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
      setError('No se pudieron cargar los préstamos.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const formatDate = (value) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value || '');
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const onExtender = async (id_prestamo) => {
    const user = getStoredUser();
    if (!user?.id_usuario) return;

    try {
      await apiFetch(`/api/prestamos/${encodeURIComponent(id_prestamo)}/extender`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_usuario: user.id_usuario })
      });
      window.alert('Préstamo extendido (+5 días)');
      await load();
    } catch (e) {
      window.alert(e?.message || 'No se pudo extender el préstamo');
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Mis Préstamos</h1>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Libro
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Fecha de Préstamo
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Fecha de Devolución
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Estado
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {error ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-sm text-gray-500">
                  {error}
                </td>
              </tr>
            ) : null}

            {!error && rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-sm text-gray-500">
                  No tienes préstamos todavía.
                </td>
              </tr>
            ) : null}

            {rows.map((row) => {
              const estado = String(row?.estado || '').toLowerCase();
              const badgeClass = estado.includes('activo')
                ? 'bg-green-100 text-green-800'
                : estado.includes('venc')
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-800';

              const ext = Number(row?.extensiones) || 0;
              const canExtend = estado.includes('activo') && ext < 2;

              const imgSrc = getLocalCoverUrl(row?.titulo) || createCoverDataUri(row?.titulo);

              return (
                <tr key={row.id_prestamo}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <img
                          className="h-10 w-10 rounded-full"
                          alt=""
                          src={imgSrc}
                          onError={(ev) => {
                            ev.currentTarget.onerror = null;
                            ev.currentTarget.src = createCoverDataUri(row?.titulo);
                          }}
                        />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{row?.titulo || 'Sin título'}</div>
                        <div className="text-sm text-gray-500">{row?.autor || 'Autor desconocido'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(row?.fecha_prestamo)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(row?.fecha_devolucion)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${badgeClass}`}>
                      {(row?.estado || 'Desconocido') + (estado.includes('activo') ? ` (${ext}/2)` : '')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {canExtend ? (
                      <button
                        type="button"
                        className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                        onClick={() => onExtender(row.id_prestamo)}
                      >
                        Extender
                      </button>
                    ) : (
                      <span className="text-xs text-gray-500">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
