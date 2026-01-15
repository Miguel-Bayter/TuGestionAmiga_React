/*
  Cuenta.jsx

  Pantalla de perfil (Mi Cuenta).

  ¿Por qué existe?
  - En el HTML existe cuenta.html.
  - Aquí mostramos datos del usuario guardado en localStorage.
  - También permitimos cambiar contraseña consumiendo POST /api/usuarios/:id/password.
*/

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api.js';
import { clearStoredUser, getStoredUser, setStoredUser } from '../lib/auth.js';

export default function Cuenta() {
  // Estado del usuario:
  // - Se inicializa desde localStorage (sesión simple).
  // - Luego se intenta refrescar desde el backend para mostrar datos actualizados.
  //
  // Nota: `apiFetch` agrega automáticamente el header `x-user-id` usando lo guardado
  // en localStorage. El backend utiliza ese header como autenticación simple.
  const [user, setUser] = useState(getStoredUser());

  const navigate = useNavigate();

  const [tab, setTab] = useState('info');

  // Tabs:
  // - info: datos del perfil + lista de libros comprados.
  // - seguridad: cambio de contraseña.
  // - notificaciones: preferencia local (maqueta).

  const [panelOpen, setPanelOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [compras, setCompras] = useState([]);
  const [prestamosActivos, setPrestamosActivos] = useState(0);

  // Edición de perfil (nombre/correo):
  // - Se edita con un formulario simple dentro del tab "Información Personal".
  // - Al guardar, se llama PATCH /api/usuarios/:id.
  // - Si el backend responde OK, actualizamos el estado local y el localStorage.
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ nombre: '', correo: '' });
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    // Intento refrescar datos del usuario desde backend.
    // Si falla, igual se muestra lo del localStorage.
    //
    // ¿Por qué refrescar?
    // - Si el usuario cambió nombre/correo desde esta pantalla, o si un admin lo modificó,
    //   aquí se reflejan los cambios sin necesidad de recargar sesión manualmente.
    const uid = Number(user?.id_usuario);
    if (!Number.isFinite(uid)) return;

    (async () => {
      try {
        // GET /api/usuarios/:id
        // El backend valida que solo se pueda consultar el propio usuario (o admin).
        const data = await apiFetch(`/api/usuarios/${uid}`);
        // Mezclamos los datos del backend con lo que ya había en memoria.
        setUser((prev) => {
          const next = { ...prev, ...data };
          setStoredUser(next);
          return next;
        });
      } catch {
      }
    })();
  }, [user?.id_usuario]);

  useEffect(() => {
    const uid = Number(user?.id_usuario);
    if (!Number.isFinite(uid)) return;

    // Lista de compras:
    // - Se usa para mostrar los libros comprados en el tab de Información Personal.
    // - También alimenta el contador "Libros comprados" del resumen de perfil.

    (async () => {
      try {
        const rows = await apiFetch(`/api/compras?id_usuario=${encodeURIComponent(uid)}`);
        setCompras(Array.isArray(rows) ? rows : []);
      } catch {
        setCompras([]);
      }
    })();
  }, [user?.id_usuario]);

  useEffect(() => {
    const uid = Number(user?.id_usuario);
    if (!Number.isFinite(uid)) return;

    // Préstamos activos:
    // - Se calcula filtrando por estado (si no contiene "devuel", se asume activo).
    // - Esto permite mostrar un indicador rápido en la tarjeta del perfil.

    (async () => {
      try {
        const rows = await apiFetch(`/api/prestamos?id_usuario=${encodeURIComponent(uid)}`);
        const list = Array.isArray(rows) ? rows : [];
        const active = list.filter((r) => {
          const st = String(r?.estado || '').toLowerCase();
          return !st.includes('devuel');
        });
        setPrestamosActivos(active.length);
      } catch {
        setPrestamosActivos(0);
      }
    })();
  }, [user?.id_usuario]);

  const formatMoney = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value ?? '');
    return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  };

  const formatCompraDate = (value) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value || '-');
    return d.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  const resetMessages = () => {
    setError('');
    setSuccess('');
  };

  const resetProfileMessages = () => {
    setProfileError('');
    setProfileSuccess('');
  };

  const openProfileEditor = () => {
    resetProfileMessages();
    setProfileForm({
      nombre: String(user?.nombre || ''),
      correo: String(user?.correo || '')
    });
    setEditingProfile(true);
  };

  const cancelProfileEditor = () => {
    resetProfileMessages();
    setEditingProfile(false);
    setProfileForm({ nombre: '', correo: '' });
  };

  const onSaveProfile = async () => {
    resetProfileMessages();

    const uid = Number(user?.id_usuario);
    if (!Number.isFinite(uid)) return;

    const payload = {
      nombre: String(profileForm.nombre || '').trim(),
      correo: String(profileForm.correo || '').trim()
    };

    if (!payload.nombre || !payload.correo) {
      setProfileError('Nombre y correo son obligatorios.');
      return;
    }

    setSavingProfile(true);
    try {
      // PATCH /api/usuarios/:id
      // - Actualiza únicamente nombre/correo.
      // - El backend valida que solo el usuario dueño (o admin) pueda hacerlo.
      const updated = await apiFetch(`/api/usuarios/${encodeURIComponent(uid)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      setUser((prev) => {
        const next = { ...prev, ...updated };
        setStoredUser(next);
        return next;
      });

      setProfileSuccess('Perfil actualizado.');
      setEditingProfile(false);
    } catch (e) {
      setProfileError(e?.message || 'No se pudo actualizar el perfil.');
    } finally {
      setSavingProfile(false);
    }
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

  const onLogout = () => {
    // Cierre de sesión:
    // - Borra el usuario del localStorage.
    // - Dispara un evento para que Navbar/Layout se actualicen.
    // - Redirige al login.
    clearStoredUser();
    navigate('/login');
  };

  const isAdmin = Number(user?.id_rol) === 1;
  const roleLabel = isAdmin ? 'Administrador' : 'Usuario';

  const initials = useMemo(() => {
    const raw = String(user?.nombre || '').trim();
    if (!raw) return 'U';
    const parts = raw.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] || 'U';
    const second = parts.length > 1 ? parts[parts.length - 1]?.[0] : '';
    return `${first}${second}`.toUpperCase();
  }, [user?.nombre]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-0">
      <div className="mb-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Mi Perfil</h1>
        <p className="text-sm text-gray-500">Gestiona tu información personal y preferencias</p>
      </div>

      {/*
        Layout:
        - En desktop: 2 columnas (perfil fijo a la izquierda + contenido a la derecha).
        - En móvil: 1 columna.
        - `items-start` evita que la tarjeta izquierda se estire cuando crece el panel derecho.
      */}
      <div className="grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-6 items-start">
        <section className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200/60 overflow-hidden self-start">
          <div className="p-5 sm:p-6">
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-full bg-blue-600 text-white flex items-center justify-center text-2xl font-extrabold ring-4 ring-blue-100">
                  {initials}
                </div>
                <div className="absolute bottom-1 right-1 h-8 w-8 rounded-full bg-white ring-1 ring-gray-200 flex items-center justify-center text-gray-600">
                  <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16.5 3.5l4 4L8 20H4v-4L16.5 3.5z" />
                  </svg>
                </div>
              </div>

              <div className="mt-4 min-w-0">
                <div className="text-base font-bold text-gray-900 truncate">{user?.nombre || 'Usuario'}</div>
                <div className="text-xs text-gray-500 truncate">{roleLabel}</div>
              </div>

              <div className="mt-5 w-full border-t border-gray-200/70 pt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between text-gray-600">
                  <span>Préstamos activos</span>
                  <span className="font-semibold text-rose-600">{prestamosActivos}</span>
                </div>
                <div className="flex items-center justify-between text-gray-600">
                  <span>Libros comprados</span>
                  <span className="font-semibold text-emerald-600">{Array.isArray(compras) ? compras.length : 0}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={onLogout}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
              >
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 16l-4-4m0 0l4-4m-4 4h12" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 19a2 2 0 002-2V7a2 2 0 00-2-2H9a2 2 0 00-2 2v2" />
                </svg>
                Cerrar Sesión
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-4 min-w-0">
          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200/60 p-2 sm:p-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTab('info')}
                className={
                  tab === 'info'
                    ? 'inline-flex items-center gap-2 rounded-xl bg-white px-2 sm:px-3 py-2 text-xs sm:text-sm font-semibold text-blue-700 ring-1 ring-inset ring-blue-200'
                    : 'inline-flex items-center gap-2 rounded-xl bg-white px-2 sm:px-3 py-2 text-xs sm:text-sm font-semibold text-gray-600 ring-1 ring-inset ring-gray-200 hover:bg-gray-50'
                }
              >
                <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20a4 4 0 00-8 0" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Información Personal
              </button>

              <button
                type="button"
                onClick={() => setTab('seguridad')}
                className={
                  tab === 'seguridad'
                    ? 'inline-flex items-center gap-2 rounded-xl bg-white px-2 sm:px-3 py-2 text-xs sm:text-sm font-semibold text-blue-700 ring-1 ring-inset ring-blue-200'
                    : 'inline-flex items-center gap-2 rounded-xl bg-white px-2 sm:px-3 py-2 text-xs sm:text-sm font-semibold text-gray-600 ring-1 ring-inset ring-gray-200 hover:bg-gray-50'
                }
              >
                <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c1.105 0 2 .895 2 2v3a2 2 0 11-4 0v-3c0-1.105.895-2 2-2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 11V8a5 5 0 0110 0v3" />
                </svg>
                Seguridad
              </button>

              <button
                type="button"
                onClick={() => setTab('notificaciones')}
                className={
                  tab === 'notificaciones'
                    ? 'inline-flex items-center gap-2 rounded-xl bg-white px-2 sm:px-3 py-2 text-xs sm:text-sm font-semibold text-blue-700 ring-1 ring-inset ring-blue-200'
                    : 'inline-flex items-center gap-2 rounded-xl bg-white px-2 sm:px-3 py-2 text-xs sm:text-sm font-semibold text-gray-600 ring-1 ring-inset ring-gray-200 hover:bg-gray-50'
                }
              >
                <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17a3 3 0 006 0" />
                </svg>
                Notificaciones
              </button>
            </div>
          </div>

          {tab === 'info' ? (
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200/60 overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-200/70">
                <h2 className="text-sm font-bold text-gray-900">Información Personal</h2>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600"
                  onClick={() => {
                    if (!editingProfile) openProfileEditor();
                  }}
                >
                  <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16.5 3.5l4 4L8 20H4v-4L16.5 3.5z" />
                  </svg>
                  Editar
                </button>
              </div>

              <div className="p-5 space-y-4">
                {editingProfile ? (
                  <div className="rounded-2xl bg-gray-50 ring-1 ring-gray-200/60 p-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Nombre Completo</label>
                      <input
                        type="text"
                        className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        value={profileForm.nombre}
                        onChange={(e) => setProfileForm((v) => ({ ...v, nombre: e.target.value }))}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Correo Electrónico</label>
                      <input
                        type="email"
                        className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        value={profileForm.correo}
                        onChange={(e) => setProfileForm((v) => ({ ...v, correo: e.target.value }))}
                      />
                    </div>

                    {profileError ? (
                      <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{profileError}</p>
                    ) : null}
                    {profileSuccess ? (
                      <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-200">{profileSuccess}</p>
                    ) : null}

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
                      <button
                        type="button"
                        className="rounded-xl bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-300 w-full sm:w-auto"
                        onClick={cancelProfileEditor}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={savingProfile}
                        className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 w-full sm:w-auto"
                        onClick={onSaveProfile}
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <div className="text-xs font-semibold text-gray-500">Nombre Completo</div>
                      <div className="mt-2 rounded-xl bg-gray-50 ring-1 ring-gray-200/60 px-3 py-2 text-sm text-gray-900">{user?.nombre || '-'}</div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-gray-500">Correo Electrónico</div>
                      <div className="mt-2 rounded-xl bg-gray-50 ring-1 ring-gray-200/60 px-3 py-2 text-sm text-gray-900">{user?.correo || '-'}</div>
                    </div>
                  </>
                )}

                <div className="pt-2">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-bold text-gray-900">Libros comprados</h3>
                    <span className="text-xs font-semibold text-gray-500">{Array.isArray(compras) ? compras.length : 0}</span>
                  </div>

                  <div className="mt-3 rounded-2xl bg-white ring-1 ring-gray-200/60 overflow-hidden">
                    <div className="lg:hidden max-h-[420px] overflow-y-auto overscroll-contain">
                      {Array.isArray(compras) && compras.length === 0 ? (
                        <p className="px-4 py-4 text-sm text-gray-500">No tienes compras todavía.</p>
                      ) : null}

                      {(compras || []).map((c) => (
                        <div key={c.id_compra} className="border-t border-gray-200 p-4">
                          <p title={String(c?.titulo || '-')} className="text-sm font-semibold text-gray-900 truncate">
                            {c?.titulo || '-'}
                          </p>
                          <p title={String(c?.autor || '-')} className="mt-1 text-xs text-gray-500 truncate">
                            {c?.autor || '-'}
                          </p>

                          <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-gray-700">
                            <p>
                              <span className="font-semibold text-gray-900">Fecha:</span> {formatCompraDate(c?.fecha_compra)}
                            </p>
                            <p>
                              <span className="font-semibold text-gray-900">Precio:</span> {formatMoney(c?.precio)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="hidden lg:block max-h-[420px] overflow-auto overscroll-contain">
                      <table className="w-full table-fixed divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                          <tr>
                            <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Libro</th>
                            <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">Fecha</th>
                            <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Precio</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {Array.isArray(compras) && compras.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="px-4 sm:px-6 py-4 text-sm text-gray-500">
                                No tienes compras todavía.
                              </td>
                            </tr>
                          ) : null}

                          {(compras || []).map((c) => (
                            <tr key={c.id_compra}>
                              <td className="px-4 sm:px-6 py-4 min-w-0">
                                <div
                                  title={String(c?.titulo || '-')}
                                  className="text-sm font-medium text-gray-900 truncate max-w-[420px]"
                                >
                                  {c?.titulo || '-'}
                                </div>
                                <div
                                  title={String(c?.autor || '-')}
                                  className="text-sm text-gray-500 truncate max-w-[420px]"
                                >
                                  {c?.autor || '-'}
                                </div>
                              </td>
                              <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatCompraDate(c?.fecha_compra)}
                              </td>
                              <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatMoney(c?.precio)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {tab === 'seguridad' ? (
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200/60 overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-200/70">
                <h2 className="text-sm font-bold text-gray-900">Seguridad</h2>
                <button
                  type="button"
                  className={
                    panelOpen
                      ? 'inline-flex h-9 items-center rounded-xl bg-gray-100 px-3 text-sm font-semibold text-gray-700 hover:bg-gray-200'
                      : 'inline-flex h-9 items-center rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700'
                  }
                  onClick={() => {
                    resetMessages();
                    setPanelOpen((v) => !v);
                  }}
                >
                  {panelOpen ? 'Cerrar' : 'Cambiar Contraseña'}
                </button>
              </div>

              <div className="p-5">
                {panelOpen ? (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-sm text-gray-600">Por seguridad, primero escribe tu contraseña actual y luego la nueva.</p>

                    <div className="mt-4 grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Contraseña actual</label>
                        <input
                          type="password"
                          className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Nueva contraseña</label>
                        <input
                          type="password"
                          className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Confirmar nueva contraseña</label>
                        <input
                          type="password"
                          className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                      </div>
                    </div>

                    {error ? <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p> : null}
                    {success ? (
                      <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-200">{success}</p>
                    ) : null}

                    <div className="mt-4 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
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
                        className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                        onClick={onSave}
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Selecciona “Cambiar Contraseña” para actualizarla.</p>
                )}
              </div>
            </div>
          ) : null}

          {tab === 'notificaciones' ? (
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200/60 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200/70">
                <h2 className="text-sm font-bold text-gray-900">Notificaciones</h2>
              </div>
              <div className="p-5">
                <div className="flex items-start rounded-2xl bg-gray-50 ring-1 ring-gray-200/60 p-4">
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
          ) : null}
        </section>
      </div>
    </div>
  );
}
