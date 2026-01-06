/*
  Cuenta.jsx

  Pantalla de perfil (Mi Cuenta).

  ¿Por qué existe?
  - En el HTML existe cuenta.html.
  - Aquí mostramos datos del usuario guardado en localStorage.
  - También permitimos cambiar contraseña consumiendo POST /api/usuarios/:id/password.
*/

import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api.js';
import { getStoredUser } from '../lib/auth.js';

export default function Cuenta() {
  // Estado del usuario:
  // - Se inicializa desde localStorage (sesión simple).
  // - Luego se intenta refrescar desde el backend para mostrar datos actualizados.
  const [user, setUser] = useState(getStoredUser());

  const [panelOpen, setPanelOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [compras, setCompras] = useState([]);

  useEffect(() => {
    // Intento refrescar datos del usuario desde backend.
    // Si falla, igual se muestra lo del localStorage.
    const uid = Number(user?.id_usuario);
    if (!Number.isFinite(uid)) return;

    (async () => {
      try {
        // GET /api/usuarios/:id
        // El backend valida que solo se pueda consultar el propio usuario (o admin).
        const data = await apiFetch(`/api/usuarios/${uid}`);
        // Mezclamos los datos del backend con lo que ya había en memoria.
        setUser((prev) => ({ ...prev, ...data }));
      } catch {
      }
    })();
  }, [user?.id_usuario]);

  useEffect(() => {
    const uid = Number(user?.id_usuario);
    if (!Number.isFinite(uid)) return;

    (async () => {
      try {
        const rows = await apiFetch(`/api/compras?id_usuario=${encodeURIComponent(uid)}`);
        setCompras(Array.isArray(rows) ? rows : []);
      } catch {
        setCompras([]);
      }
    })();
  }, [user?.id_usuario]);

  const formatMoney = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value ?? '');
    return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  };

  const resetMessages = () => {
    setError('');
    setSuccess('');
  };

  const onSave = async () => {
    resetMessages();

    const uid = Number(user?.id_usuario);
    if (!Number.isFinite(uid)) return;

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Completa todos los campos');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('La confirmación no coincide');
      return;
    }

    try {
      // Cambio de contraseña:
      // - Se envía la contraseña actual para validar.
      // - La nueva contraseña se guarda como hash bcrypt en el backend.
      await apiFetch(`/api/usuarios/${uid}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_usuario: uid,
          current_password: currentPassword,
          new_password: newPassword
        })
      });

      setSuccess('Contraseña actualizada');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPanelOpen(false);
    } catch (e) {
      setError(e?.message || 'No se pudo cambiar la contraseña');
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Mi Perfil</h1>
      <p className="text-gray-600 mb-6">Administra tu información personal y configuración de la cuenta.</p>

      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">Información Personal</h2>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nombre</label>
              <p className="mt-1 text-lg text-gray-900">{user?.nombre || ''}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Correo Electrónico</label>
              <p className="mt-1 text-lg text-gray-900">{user?.correo || ''}</p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">Mis Compras</h2>
          <div className="mt-4 bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Libro</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Array.isArray(compras) && compras.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-sm text-gray-500">
                      No tienes compras todavía.
                    </td>
                  </tr>
                ) : null}

                {(compras || []).map((c) => (
                  <tr key={c.id_compra}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{c?.titulo || '-'}</div>
                      <div className="text-sm text-gray-500">{c?.autor || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{c?.fecha_compra || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatMoney(c?.precio)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">Seguridad</h2>
          <div className="mt-4">
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              onClick={() => {
                resetMessages();
                setPanelOpen((v) => !v);
              }}
            >
              Cambiar Contraseña
            </button>
          </div>

          {panelOpen ? (
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm text-gray-600">
                Por seguridad, primero escribe tu contraseña actual y luego la nueva.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Contraseña actual</label>
                  <input
                    type="password"
                    className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Nueva contraseña</label>
                  <input
                    type="password"
                    className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Confirmar nueva contraseña</label>
                  <input
                    type="password"
                    className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>

              {error ? <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
              {success ? (
                <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>
              ) : null}

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                  onClick={() => {
                    setPanelOpen(false);
                    resetMessages();
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                  onClick={onSave}
                >
                  Guardar
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">Preferencias</h2>
          <div className="mt-4 space-y-4">
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="notifications"
                  name="notifications"
                  type="checkbox"
                  defaultChecked
                  className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="notifications" className="font-medium text-gray-700">
                  Recibir notificaciones por correo
                </label>
                <p className="text-gray-500">Recibe un correo cuando un libro esté disponible.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
