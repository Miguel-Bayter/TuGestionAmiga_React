/*
  Admin.jsx

  Panel de administración del sistema.

  ¿Por qué existe?
  - Se necesita una interfaz para que un ADMIN gestione el catálogo y usuarios sin tocar la BD a mano.
  - Centraliza en una sola pantalla tareas típicas: libros, usuarios y préstamos.

  ¿Para qué sirve?
  - Consume endpoints /api/admin/* (protegidos en backend).
  - Permite:
    - Crear/editar libros.
    - Cambiar roles de usuarios.
    - Ver préstamos registrados.
*/

import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/api.js';

const emptyBook = {
  id_libro: null,
  titulo: '',
  autor: '',
  descripcion: '',
  stock: 0,
  stock_compra: 0,
  stock_renta: 0,
  valor: 0,
  disponibilidad: 1,
  id_categoria: ''
};

export default function Admin() {
  // tab:
  // - Controla qué sección del panel se ve (libros/usuarios/préstamos).
  const [tab, setTab] = useState('libros');

  const [books, setBooks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loans, setLoans] = useState([]);
  const [categories, setCategories] = useState([]);

  const [bookForm, setBookForm] = useState(emptyBook);
  const [saving, setSaving] = useState(false);

  const [loanQuery, setLoanQuery] = useState('');

  const [newUserForm, setNewUserForm] = useState({ nombre: '', correo: '', password: '', id_rol: 2 });
  const [creatingUser, setCreatingUser] = useState(false);

  const [editUserForm, setEditUserForm] = useState({ id_usuario: null, nombre: '', correo: '', password: '' });
  const [savingUser, setSavingUser] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState(null);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const resetMessages = () => {
    setError('');
    setSuccess('');
  };

  const onCreateUser = async () => {
    resetMessages();
    const payload = {
      nombre: String(newUserForm.nombre || '').trim(),
      correo: String(newUserForm.correo || '').trim(),
      password: String(newUserForm.password || ''),
      id_rol: Number(newUserForm.id_rol)
    };

    if (!payload.nombre || !payload.correo || !payload.password) {
      setError('Nombre, correo y contraseña son obligatorios.');
      return;
    }

    if (payload.id_rol !== 1 && payload.id_rol !== 2) {
      setError('Rol inválido.');
      return;
    }

    setCreatingUser(true);
    try {
      await apiFetch('/api/admin/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      setSuccess('Usuario creado.');
      setNewUserForm({ nombre: '', correo: '', password: '', id_rol: 2 });
      await loadAll(loanQuery);
    } catch (e) {
      setError(e?.message || 'No se pudo crear el usuario.');
    } finally {
      setCreatingUser(false);
    }
  };

  const onEditUser = (u) => {
    resetMessages();
    setTab('usuarios');
    setEditUserForm({
      id_usuario: u?.id_usuario ?? null,
      nombre: String(u?.nombre || ''),
      correo: String(u?.correo || ''),
      password: ''
    });
  };

  const onCancelEditUser = () => {
    resetMessages();
    setEditUserForm({ id_usuario: null, nombre: '', correo: '', password: '' });
  };

  const onSaveUser = async () => {
    resetMessages();
    const id = Number(editUserForm.id_usuario);
    if (!Number.isFinite(id)) return;

    const payload = {
      nombre: String(editUserForm.nombre || '').trim(),
      correo: String(editUserForm.correo || '').trim()
    };

    const pwd = String(editUserForm.password || '');
    if (pwd) payload.password = pwd;

    if (!payload.nombre || !payload.correo) {
      setError('Nombre y correo son obligatorios.');
      return;
    }

    setSavingUser(true);
    try {
      await apiFetch(`/api/admin/usuarios/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      setSuccess('Usuario actualizado.');
      setEditUserForm({ id_usuario: null, nombre: '', correo: '', password: '' });
      await loadAll(loanQuery);
    } catch (e) {
      setError(e?.message || 'No se pudo actualizar el usuario.');
    } finally {
      setSavingUser(false);
    }
  };

  const onDeleteUser = async (u) => {
    resetMessages();
    const id = Number(u?.id_usuario);
    if (!Number.isFinite(id)) return;

    const ok = window.confirm(`¿Eliminar el usuario "${String(u?.nombre || '').trim() || 'sin nombre'}"?`);
    if (!ok) return;

    setDeletingUserId(id);
    try {
      await apiFetch(`/api/admin/usuarios/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      setSuccess('Usuario eliminado.');
      if (Number(editUserForm.id_usuario) === id) {
        setEditUserForm({ id_usuario: null, nombre: '', correo: '', password: '' });
      }
      await loadAll(loanQuery);
    } catch (e) {
      setError(e?.message || 'No se pudo eliminar el usuario.');
    } finally {
      setDeletingUserId(null);
    }
  };

  const loadAll = async (q) => {
    resetMessages();
    try {
      // Carga paralela:
      // - El panel necesita varias fuentes (libros, categorías, usuarios, préstamos).
      // - Promise.all reduce tiempos de espera.
      const query = typeof q === 'string' ? q : '';
      const qs = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';

      const [libros, categorias, usuarios, prestamos] = await Promise.all([
        apiFetch('/api/admin/libros'),
        apiFetch('/api/admin/categorias'),
        apiFetch('/api/admin/usuarios'),
        apiFetch(`/api/admin/prestamos${qs}`)
      ]);

      setBooks(Array.isArray(libros) ? libros : []);
      setCategories(Array.isArray(categorias) ? categorias : []);
      setUsers(Array.isArray(usuarios) ? usuarios : []);
      setLoans(Array.isArray(prestamos) ? prestamos : []);
    } catch (e) {
      setError(e?.message || 'No se pudo cargar el panel de administración.');
      setBooks([]);
      setCategories([]);
      setUsers([]);
      setLoans([]);
    }
  };

  useEffect(() => {
    // Al entrar al panel, cargamos todo.
    loadAll('');
  }, []);

  const categoryNameById = useMemo(() => {
    // Mapa auxiliar para mostrar nombre de categoría en la tabla de libros.
    // Evita hacer búsquedas O(n) dentro del render de cada fila.
    const map = new Map();
    for (const c of categories || []) {
      map.set(String(c.id_categoria), c.nombre_categoria);
    }
    return map;
  }, [categories]);

  const onEditBook = (row) => {
    resetMessages();
    setTab('libros');

    // Se carga el libro seleccionado al formulario.
    // Esto permite reutilizar el mismo formulario para crear/editar.
    setBookForm({
      id_libro: row?.id_libro ?? null,
      titulo: String(row?.titulo ?? ''),
      autor: String(row?.autor ?? ''),
      descripcion: String(row?.descripcion ?? ''),
      stock: Number(row?.stock ?? 0),
      stock_compra: Number(row?.stock_compra ?? row?.stock ?? 0),
      stock_renta: Number(row?.stock_renta ?? row?.stock ?? 0),
      valor: Number(row?.valor ?? 0),
      disponibilidad: Number(row?.disponibilidad ?? 0),
      id_categoria: row?.id_categoria == null ? '' : String(row.id_categoria)
    });
  };

  const onNewBook = () => {
    resetMessages();
    setTab('libros');
    setBookForm({ ...emptyBook });
  };

  const onSaveBook = async () => {
    resetMessages();

    const payload = {
      titulo: String(bookForm.titulo || '').trim(),
      autor: String(bookForm.autor || '').trim(),
      descripcion: String(bookForm.descripcion || ''),
      stock: Number(bookForm.stock),
      stock_compra: Number(bookForm.stock_compra),
      stock_renta: Number(bookForm.stock_renta),
      valor: Number(bookForm.valor),
      id_categoria: bookForm.id_categoria === '' ? null : Number(bookForm.id_categoria)
    };

    // Validaciones básicas en frontend para mejorar UX.
    // El backend igual valida campos obligatorios.
    if (!payload.titulo || !payload.autor) {
      setError('Título y autor son obligatorios.');
      return;
    }

    if (!Number.isFinite(payload.stock) || payload.stock < 0) {
      setError('Stock inválido.');
      return;
    }

    if (!Number.isFinite(payload.stock_compra) || payload.stock_compra < 0) {
      setError('Stock de compra inválido.');
      return;
    }

    if (!Number.isFinite(payload.stock_renta) || payload.stock_renta < 0) {
      setError('Stock de renta inválido.');
      return;
    }

    if (!Number.isFinite(payload.valor) || payload.valor < 0) {
      setError('Precio inválido.');
      return;
    }

    setSaving(true);
    try {
      if (bookForm.id_libro) {
        // Edición parcial.
        await apiFetch(`/api/admin/libros/${encodeURIComponent(bookForm.id_libro)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        setSuccess('Libro actualizado.');
      } else {
        // Creación.
        await apiFetch('/api/admin/libros', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        setSuccess('Libro creado.');
      }

      setBookForm({ ...emptyBook });
      await loadAll(loanQuery);
    } catch (e) {
      setError(e?.message || 'No se pudo guardar el libro.');
    } finally {
      setSaving(false);
    }
  };

  const onSearchLoans = async () => {
    try {
      const q = String(loanQuery || '').trim();
      const qs = q ? `?q=${encodeURIComponent(q)}` : '';
      const rows = await apiFetch(`/api/admin/prestamos${qs}`);
      setLoans(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setError(e?.message || 'No se pudieron cargar los préstamos.');
      setLoans([]);
    }
  };

  const onReturnLoan = async (row) => {
    resetMessages();
    const id_prestamo = row?.id_prestamo;
    const id_usuario = row?.id_usuario;
    if (!id_prestamo || !id_usuario) return;

    try {
      await apiFetch(`/api/prestamos/${encodeURIComponent(id_prestamo)}/devolver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_usuario })
      });
      setSuccess('Devolución registrada.');
      await loadAll(loanQuery);
    } catch (e) {
      setError(e?.message || 'No se pudo registrar la devolución.');
    }
  };

  const onSetUserRole = async (id_usuario, id_rol) => {
    resetMessages();

    const uid = Number(id_usuario);
    const rid = Number(id_rol);
    if (!Number.isFinite(uid) || !Number.isFinite(rid)) return;

    try {
      // Cambia rol en backend.
      // Regla: si intentas cambiar tu propio rol a USUARIO, el backend lo bloquea.
      await apiFetch(`/api/admin/usuarios/${encodeURIComponent(uid)}/rol`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_rol: rid })
      });
      setSuccess('Rol actualizado.');
      await loadAll();
    } catch (e) {
      setError(e?.message || 'No se pudo actualizar el rol.');
    }
  };

  const tabBtn = (key) => (key === tab ? 'filter-btn-active' : 'filter-btn');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Administrador</h1>
        <p className="text-gray-600 mt-1">Gestiona libros, usuarios y préstamos.</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={tabBtn('libros')} onClick={() => setTab('libros')}>
            Libros
          </button>
          <button type="button" className={tabBtn('usuarios')} onClick={() => setTab('usuarios')}>
            Usuarios
          </button>
          <button type="button" className={tabBtn('prestamos')} onClick={() => setTab('prestamos')}>
            Préstamos
          </button>
          <button type="button" className="filter-btn sm:ml-auto" onClick={loadAll}>
            Recargar
          </button>
        </div>

        {error ? <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        {success ? <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p> : null}
      </div>

      {tab === 'libros' ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Libros</h2>
              <button type="button" className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700" onClick={onNewBook}>
                Nuevo
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Título</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Autor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Compra</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Renta</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Disp.</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(books || []).map((b) => (
                    <tr key={b.id_libro}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{b?.titulo || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{b?.autor || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {b?.id_categoria != null ? categoryNameById.get(String(b.id_categoria)) || '-' : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{Number(b?.stock_compra ?? b?.stock ?? 0)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{Number(b?.stock_renta ?? b?.stock ?? 0)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{Number(b?.valor ?? 0)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{Number(b?.disponibilidad) === 1 ? 'Sí' : 'No'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          type="button"
                          className="rounded-lg bg-gray-200 px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-300"
                          onClick={() => onEditBook(b)}
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {Array.isArray(books) && books.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-4 text-sm text-gray-500">
                        No hay libros.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{bookForm.id_libro ? 'Editar libro' : 'Nuevo libro'}</h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="form-label">Título</label>
                <input
                  type="text"
                  className="form-input"
                  value={bookForm.titulo}
                  onChange={(e) => setBookForm((v) => ({ ...v, titulo: e.target.value }))}
                />
              </div>

              <div>
                <label className="form-label">Autor</label>
                <input
                  type="text"
                  className="form-input"
                  value={bookForm.autor}
                  onChange={(e) => setBookForm((v) => ({ ...v, autor: e.target.value }))}
                />
              </div>

              <div>
                <label className="form-label">Categoría</label>
                <select
                  className="form-input"
                  value={bookForm.id_categoria}
                  onChange={(e) => setBookForm((v) => ({ ...v, id_categoria: e.target.value }))}
                >
                  <option value="">(Sin categoría)</option>
                  {(categories || []).map((c) => (
                    <option key={c.id_categoria} value={String(c.id_categoria)}>
                      {c.nombre_categoria}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Stock total (legacy)</label>
                <input
                  type="number"
                  className="form-input"
                  value={bookForm.stock}
                  onChange={(e) => setBookForm((v) => ({ ...v, stock: e.target.value }))}
                />
              </div>

              <div>
                <label className="form-label">Stock compra</label>
                <input
                  type="number"
                  className="form-input"
                  value={bookForm.stock_compra}
                  onChange={(e) => setBookForm((v) => ({ ...v, stock_compra: e.target.value }))}
                />
              </div>

              <div>
                <label className="form-label">Stock renta</label>
                <input
                  type="number"
                  className="form-input"
                  value={bookForm.stock_renta}
                  onChange={(e) => setBookForm((v) => ({ ...v, stock_renta: e.target.value }))}
                />
              </div>

              <div>
                <label className="form-label">Precio</label>
                <input
                  type="number"
                  className="form-input"
                  value={bookForm.valor}
                  onChange={(e) => setBookForm((v) => ({ ...v, valor: e.target.value }))}
                />
              </div>

              <div>
                <label className="form-label">Descripción</label>
                <textarea
                  className="form-input"
                  rows={4}
                  value={bookForm.descripcion}
                  onChange={(e) => setBookForm((v) => ({ ...v, descripcion: e.target.value }))}
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                  onClick={() => setBookForm({ ...emptyBook })}
                >
                  Limpiar
                </button>
                <button
                  type="button"
                  disabled={saving}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  onClick={onSaveBook}
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'usuarios' ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Usuarios</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Correo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(users || []).map((u) => (
                    <tr key={u.id_usuario}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{u?.nombre || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{u?.correo || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {u?.nombre_rol || (u?.id_rol ? String(u.id_rol) : '-')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            className="rounded-lg bg-gray-200 px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-300"
                            onClick={() => onSetUserRole(u.id_usuario, 2)}
                          >
                            USUARIO
                          </button>
                          <button
                            type="button"
                            className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                            onClick={() => onSetUserRole(u.id_usuario, 1)}
                          >
                            ADMIN
                          </button>
                          <button
                            type="button"
                            className="rounded-lg bg-gray-200 px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-300"
                            onClick={() => onEditUser(u)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            disabled={deletingUserId === Number(u.id_usuario)}
                            className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                            onClick={() => onDeleteUser(u)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {Array.isArray(users) && users.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 text-sm text-gray-500">
                        No hay usuarios.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{editUserForm.id_usuario ? 'Editar usuario' : 'Crear usuario'}</h2>
            </div>
            {editUserForm.id_usuario ? (
              <div className="p-6 space-y-4">
                <div>
                  <label className="form-label">Nombre</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editUserForm.nombre}
                    onChange={(e) => setEditUserForm((v) => ({ ...v, nombre: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="form-label">Correo</label>
                  <input
                    type="email"
                    className="form-input"
                    value={editUserForm.correo}
                    onChange={(e) => setEditUserForm((v) => ({ ...v, correo: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="form-label">Contraseña (opcional)</label>
                  <input
                    type="password"
                    className="form-input"
                    value={editUserForm.password}
                    onChange={(e) => setEditUserForm((v) => ({ ...v, password: e.target.value }))}
                  />
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                    onClick={onCancelEditUser}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={savingUser}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                    onClick={onSaveUser}
                  >
                    Guardar
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                <div>
                  <label className="form-label">Nombre</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newUserForm.nombre}
                    onChange={(e) => setNewUserForm((v) => ({ ...v, nombre: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="form-label">Correo</label>
                  <input
                    type="email"
                    className="form-input"
                    value={newUserForm.correo}
                    onChange={(e) => setNewUserForm((v) => ({ ...v, correo: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="form-label">Contraseña</label>
                  <input
                    type="password"
                    className="form-input"
                    value={newUserForm.password}
                    onChange={(e) => setNewUserForm((v) => ({ ...v, password: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="form-label">Rol</label>
                  <select
                    className="form-input"
                    value={String(newUserForm.id_rol)}
                    onChange={(e) => setNewUserForm((v) => ({ ...v, id_rol: Number(e.target.value) }))}
                  >
                    <option value="2">USUARIO</option>
                    <option value="1">ADMIN</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                    onClick={() => setNewUserForm({ nombre: '', correo: '', password: '', id_rol: 2 })}
                  >
                    Limpiar
                  </button>
                  <button
                    type="button"
                    disabled={creatingUser}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                    onClick={onCreateUser}
                  >
                    Crear
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {tab === 'prestamos' ? (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Préstamos</h2>
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                className="form-input"
                value={loanQuery}
                placeholder="Buscar por nombre o correo"
                onChange={(e) => setLoanQuery(e.target.value)}
              />
              <button
                type="button"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                onClick={onSearchLoans}
              >
                Buscar
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Libro</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuario</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Préstamo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Devolución</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ext.</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(loans || []).map((p) => (
                  <tr key={p.id_prestamo}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p?.titulo || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{p?.nombre || p?.correo || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{p?.fecha_prestamo || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{p?.fecha_devolucion || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{p?.estado || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{Number(p?.extensiones ?? 0)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {String(p?.estado || '').toLowerCase().includes('activo') ? (
                        <button
                          type="button"
                          className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                          onClick={() => onReturnLoan(p)}
                        >
                          Registrar devolución
                        </button>
                      ) : (
                        <span className="text-xs text-gray-500">-</span>
                      )}
                    </td>
                  </tr>
                ))}
                {Array.isArray(loans) && loans.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-sm text-gray-500">
                      No hay préstamos.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
