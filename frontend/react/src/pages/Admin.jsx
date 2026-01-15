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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { apiFetch } from '../lib/api.js';
import { getStoredUser } from '../lib/auth.js';
import { createCoverDataUri, ensureCoverMap, getLocalCoverUrl, invalidateCoverMap } from '../lib/covers.js';

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

  const location = useLocation();

  useEffect(() => {
    try {
      const sp = new URLSearchParams(location.search || '');
      const t = sp.get('tab');
      if (t === 'libros' || t === 'usuarios' || t === 'prestamos') {
        setTab(t);
      }
    } catch {
      // ignore
    }
  }, [location.search]);

  const formatDateOnly = (value) => {
    if (!value) return '-';
    const s = String(value);
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return s;
  };

  const bookFormRef = useRef(null);
  const userFormRef = useRef(null);

  const [books, setBooks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loans, setLoans] = useState([]);
  const [categories, setCategories] = useState([]);

  const [bookQuery, setBookQuery] = useState('');

  const [bookForm, setBookForm] = useState(emptyBook);
  const [showBookForm, setShowBookForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingBookId, setDeletingBookId] = useState(null);

  const [loanQuery, setLoanQuery] = useState('');

  const [newUserForm, setNewUserForm] = useState({ nombre: '', correo: '', password: '', id_rol: 2 });
  const [creatingUser, setCreatingUser] = useState(false);

  const [editUserForm, setEditUserForm] = useState({ id_usuario: null, nombre: '', correo: '', password: '' });
  const [showUserForm, setShowUserForm] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState(null);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [coverDataUrl, setCoverDataUrl] = useState('');

  const resetMessages = () => {
    setError('');
    setSuccess('');
  };

  useEffect(() => {
    ensureCoverMap();
  }, []);

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
      window.dispatchEvent(
        new CustomEvent('tga_toast', {
          detail: { message: `Usuario creado: ${payload.nombre}` }
        })
      );
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
    setShowUserForm(true);
    setEditUserForm({
      id_usuario: u?.id_usuario ?? null,
      nombre: String(u?.nombre || ''),
      correo: String(u?.correo || ''),
      password: ''
    });
  };

  const onNewUser = () => {
    resetMessages();
    setTab('usuarios');
    setShowUserForm(true);
    setEditUserForm({ id_usuario: null, nombre: '', correo: '', password: '' });
    setNewUserForm({ nombre: '', correo: '', password: '', id_rol: 2 });
  };

  const onCloseUserForm = () => {
    resetMessages();
    setShowUserForm(false);
    setEditUserForm({ id_usuario: null, nombre: '', correo: '', password: '' });
    setNewUserForm({ nombre: '', correo: '', password: '', id_rol: 2 });
  };

  const onCancelEditUser = () => {
    resetMessages();
    setEditUserForm({ id_usuario: null, nombre: '', correo: '', password: '' });
    setShowUserForm(false);
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
      window.dispatchEvent(
        new CustomEvent('tga_toast', {
          detail: { message: 'Usuario actualizado correctamente.' }
        })
      );
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

    if (!String(loanQuery || '').trim()) {
      const stList = Array.isArray(loans) ? loans : [];
      const hasActiveLoan = stList.some((r) => {
        if (Number(r?.id_usuario) !== id) return false;
        const st = String(r?.estado || '').toLowerCase();
        return !st.includes('devuel');
      });
      if (hasActiveLoan) {
        const msg =
          'No puedes eliminar este usuario porque tiene préstamos activos. Registra la devolución de los libros y vuelve a intentarlo.';
        setError(msg);
        window.dispatchEvent(new CustomEvent('tga_toast', { detail: { message: msg } }));
        return;
      }
    }

    const me = getStoredUser();
    if (Number(me?.id_usuario) === id) {
      setError('Solo otro administrador puede eliminarte');
      return;
    }

    const ok = window.confirm(`¿Eliminar el usuario "${String(u?.nombre || '').trim() || 'sin nombre'}"?`);
    if (!ok) return;

    setDeletingUserId(id);
    try {
      await apiFetch(`/api/admin/usuarios/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      const okMsg = 'Usuario eliminado correctamente.';
      setSuccess(okMsg);
      window.dispatchEvent(
        new CustomEvent('tga_toast', {
          detail: { message: okMsg }
        })
      );
      if (Number(editUserForm.id_usuario) === id) {
        setEditUserForm({ id_usuario: null, nombre: '', correo: '', password: '' });
      }
      await loadAll(loanQuery);
    } catch (e) {
      const msg = e?.message || 'No se pudo eliminar el usuario.';
      setError(msg);
      window.dispatchEvent(new CustomEvent('tga_toast', { detail: { message: msg } }));
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

  useEffect(() => {
    if (tab !== 'libros') setShowBookForm(false);
  }, [tab]);

  useEffect(() => {
    if (tab !== 'usuarios') setShowUserForm(false);
  }, [tab]);

  useEffect(() => {
    if (!showBookForm || tab !== 'libros') return;
    if (typeof window === 'undefined') return;
    if (!window.matchMedia('(max-width: 1023px)').matches) return;

    const el = bookFormRef.current;
    if (!el) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }, [showBookForm, tab]);

  useEffect(() => {
    if (!showUserForm || tab !== 'usuarios') return;
    if (typeof window === 'undefined') return;
    if (!window.matchMedia('(max-width: 1023px)').matches) return;

    const el = userFormRef.current;
    if (!el) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }, [showUserForm, tab]);

  const categoryNameById = useMemo(() => {
    // Mapa auxiliar para mostrar nombre de categoría en la tabla de libros.
    // Evita hacer búsquedas O(n) dentro del render de cada fila.
    const map = new Map();
    for (const c of categories || []) {
      map.set(String(c.id_categoria), c.nombre_categoria);
    }
    return map;
  }, [categories]);

  const filteredBooks = useMemo(() => {
    const list = Array.isArray(books) ? books : [];
    const q = String(bookQuery || '').trim().toLowerCase();
    if (!q) return list;

    return list.filter((b) => {
      const id = String(b?.id_libro ?? '').toLowerCase();
      const titulo = String(b?.titulo ?? '').toLowerCase();
      const autor = String(b?.autor ?? '').toLowerCase();
      const categoria =
        b?.id_categoria != null
          ? String(categoryNameById.get(String(b.id_categoria)) || '').toLowerCase()
          : '';

      return id.includes(q) || titulo.includes(q) || autor.includes(q) || categoria.includes(q);
    });
  }, [books, bookQuery, categoryNameById]);

  const onEditBook = (row) => {
    resetMessages();
    setTab('libros');
    setShowBookForm(true);
    setCoverDataUrl('');

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
    setShowBookForm(true);
    setBookForm({ ...emptyBook });
    setCoverDataUrl('');
  };

  const onCloseBookForm = () => {
    resetMessages();
    setShowBookForm(false);
    setBookForm({ ...emptyBook });
    setCoverDataUrl('');
  };

  const onDeleteBook = async (row) => {
    resetMessages();
    const id = Number(row?.id_libro);
    if (!Number.isFinite(id)) return;

    if (!String(loanQuery || '').trim()) {
      const list = Array.isArray(loans) ? loans : [];
      const hasActiveLoan = list.some((r) => {
        if (Number(r?.id_libro) !== id) return false;
        const st = String(r?.estado || '').toLowerCase();
        return !st.includes('devuel');
      });
      if (hasActiveLoan) {
        setError('No podemos eliminar este libro todavía: tiene préstamos pendientes de devolución. Registra la devolución y vuelve a intentarlo.');
        return;
      }
    }

    const title = String(row?.titulo || '').trim() || 'sin título';
    const ok = window.confirm(`¿Eliminar el libro "${title}"?`);
    if (!ok) return;

    setDeletingBookId(id);
    try {
      await apiFetch(`/api/admin/libros/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      setSuccess('Libro eliminado.');
      window.dispatchEvent(
        new CustomEvent('tga_toast', {
          detail: { message: 'Libro eliminado correctamente.' }
        })
      );
      if (Number(bookForm.id_libro) === id) {
        setShowBookForm(false);
        setBookForm({ ...emptyBook });
      }
      await loadAll(loanQuery);
    } catch (e) {
      setError(e?.message || 'No se pudo eliminar el libro.');
    } finally {
      setDeletingBookId(null);
    }
  };

  const onSaveBook = async () => {
    resetMessages();

    const stockCompra = Number(bookForm.stock_compra);
    const stockRenta = Number(bookForm.stock_renta);

    const payload = {
      titulo: String(bookForm.titulo || '').trim(),
      autor: String(bookForm.autor || '').trim(),
      descripcion: String(bookForm.descripcion || ''),
      stock: stockCompra + stockRenta,
      stock_compra: stockCompra,
      stock_renta: stockRenta,
      valor: Number(bookForm.valor),
      id_categoria: bookForm.id_categoria === '' ? null : Number(bookForm.id_categoria)
    };

    // Validaciones básicas en frontend para mejorar UX.
    // El backend igual valida campos obligatorios.
    if (!payload.titulo || !payload.autor) {
      setError('Título y autor son obligatorios.');
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
        window.dispatchEvent(
          new CustomEvent('tga_toast', {
            detail: { message: 'Cambios guardados correctamente.' }
          })
        );
      } else {
        // Creación.
        await apiFetch('/api/admin/libros', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        setSuccess('Libro creado.');
        window.dispatchEvent(
          new CustomEvent('tga_toast', {
            detail: { message: 'Libro creado exitosamente.' }
          })
        );
      }

      if (coverDataUrl) {
        try {
          await apiFetch('/api/admin/covers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: payload.titulo, dataUrl: coverDataUrl })
          });
          invalidateCoverMap();
          await ensureCoverMap();
        } catch {
          window.dispatchEvent(
            new CustomEvent('tga_toast', {
              detail: { message: 'Libro guardado, pero no se pudo subir la portada.' }
            })
          );
        }
      }

      setBookForm({ ...emptyBook });
      setCoverDataUrl('');
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
      const result = await apiFetch(`/api/prestamos/${encodeURIComponent(id_prestamo)}/devolver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_usuario })
      });
      const fechaReal = result?.fecha_devolucion_real ?? null;
      setSuccess('Devolución registrada.');
      window.dispatchEvent(
        new CustomEvent('tga_toast', {
          detail: { message: 'Devolución registrada correctamente.' }
        })
      );
      setLoans((prev) =>
        (Array.isArray(prev) ? prev : []).map((p) =>
          Number(p?.id_prestamo) === Number(id_prestamo)
            ? {
                ...p,
                estado: 'Devuelto',
                ...(fechaReal ? { fecha_devolucion_real: fechaReal } : {})
              }
            : p
        )
      );
      window.dispatchEvent(new Event('tga_catalog_updated'));
      window.dispatchEvent(new Event('tga_loans_updated'));
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
      window.dispatchEvent(
        new CustomEvent('tga_toast', {
          detail: { message: 'Rol actualizado correctamente.' }
        })
      );
      await loadAll();
    } catch (e) {
      setError(e?.message || 'No se pudo actualizar el rol.');
    }
  };

  const tabBtn = (key) => (key === tab ? 'filter-btn-active' : 'filter-btn');

  const usersWithActiveLoans = useMemo(() => {
    if (String(loanQuery || '').trim()) return new Set();
    const set = new Set();
    const list = Array.isArray(loans) ? loans : [];
    for (const r of list) {
      const uid = Number(r?.id_usuario);
      if (!Number.isFinite(uid)) continue;
      const st = String(r?.estado || '').toLowerCase();
      if (!st.includes('devuel')) set.add(uid);
    }
    return set;
  }, [loans, loanQuery]);

  const booksWithActiveLoans = useMemo(() => {
    if (String(loanQuery || '').trim()) return new Set();
    const set = new Set();
    const list = Array.isArray(loans) ? loans : [];
    for (const r of list) {
      const lid = Number(r?.id_libro);
      if (!Number.isFinite(lid)) continue;
      const st = String(r?.estado || '').toLowerCase();
      if (!st.includes('devuel')) set.add(lid);
    }
    return set;
  }, [loans, loanQuery]);

  const canDeleteUser = (u) => {
    const id = Number(u?.id_usuario);
    if (!Number.isFinite(id)) return false;
    return !usersWithActiveLoans.has(id);
  };

  const canDeleteBook = (b) => {
    const id = Number(b?.id_libro);
    if (!Number.isFinite(id)) return false;
    return !booksWithActiveLoans.has(id);
  };

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
        <div className={`grid grid-cols-1 gap-6 ${showBookForm ? 'lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]' : ''}`}>
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Libros</h2>
              <button type="button" className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700" onClick={onNewBook}>
                Nuevo
              </button>
            </div>
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  className="form-input"
                  value={bookQuery}
                  placeholder="Buscar por título, autor, categoría o ID"
                  onChange={(e) => setBookQuery(e.target.value)}
                />
                <button
                  type="button"
                  className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-300"
                  onClick={() => setBookQuery('')}
                >
                  Limpiar
                </button>
              </div>
              {String(bookQuery || '').trim() ? (
                <p className="mt-2 text-xs text-gray-500">Mostrando {filteredBooks.length} resultado(s).</p>
              ) : null}
            </div>
            <div className="lg:hidden">
              {(filteredBooks || []).map((b) => (
                <div key={b.id_libro} className="border-t border-gray-200 p-4">
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p title={String(b?.titulo || '-')} className="min-w-0 text-sm font-semibold text-gray-900 truncate">
                        {b?.titulo || '-'}
                      </p>
                      <span className="text-xs font-semibold text-gray-600 whitespace-nowrap">
                        {Number(b?.disponibilidad) === 1 ? 'Disponible' : 'No disponible'}
                      </span>
                    </div>
                    <p title={String(b?.autor || '-')} className="mt-1 text-xs text-gray-500 truncate">
                      {b?.autor || '-'}
                    </p>
                    <p
                      title={
                        b?.id_categoria != null ? String(categoryNameById.get(String(b.id_categoria)) || '-') : '-'
                      }
                      className="mt-1 text-xs text-gray-500 truncate"
                    >
                      {b?.id_categoria != null ? categoryNameById.get(String(b.id_categoria)) || '-' : '-'}
                    </p>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-gray-700">
                      <p>
                        <span className="font-semibold text-gray-900">Compra:</span> {Number(b?.stock_compra ?? b?.stock ?? 0)}
                      </p>
                      <p>
                        <span className="font-semibold text-gray-900">Renta:</span> {Number(b?.stock_renta ?? b?.stock ?? 0)}
                      </p>
                      <p className="col-span-2">
                        <span className="font-semibold text-gray-900">Precio:</span> {Number(b?.valor ?? 0)}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        className="inline-flex h-9 w-24 items-center justify-center rounded-lg bg-gray-100 px-3 text-xs font-semibold text-gray-800 hover:bg-gray-200"
                        onClick={() => onEditBook(b)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        disabled={deletingBookId === Number(b.id_libro) || !canDeleteBook(b)}
                        className={
                          deletingBookId === Number(b.id_libro)
                            ? 'inline-flex h-9 w-24 items-center justify-center rounded-lg bg-rose-200 px-3 text-xs font-semibold text-rose-300'
                            : !canDeleteBook(b)
                              ? 'inline-flex h-9 w-24 items-center justify-center rounded-lg bg-gray-100 px-3 text-xs font-semibold text-gray-400'
                              : 'inline-flex h-9 w-24 items-center justify-center rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-700'
                        }
                        onClick={() => onDeleteBook(b)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {Array.isArray(filteredBooks) && filteredBooks.length === 0 ? (
                <p className="px-6 py-4 text-sm text-gray-500">No hay libros.</p>
              ) : null}
            </div>
            <div className="hidden lg:block overflow-hidden">
              <table
                className={
                  showBookForm
                    ? 'w-full table-fixed divide-y divide-gray-200 text-xs leading-tight'
                    : 'w-full table-fixed divide-y divide-gray-200'
                }
              >
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      className={
                        showBookForm
                          ? 'px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase leading-tight'
                          : 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
                      }
                    >
                      Título
                    </th>
                    <th
                      className={
                        showBookForm
                          ? 'px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase leading-tight'
                          : 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
                      }
                    >
                      Autor
                    </th>
                    <th
                      className={
                        showBookForm
                          ? 'hidden 2xl:table-cell px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase leading-tight'
                          : 'hidden xl:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
                      }
                    >
                      Categoría
                    </th>
                    <th
                      className={
                        showBookForm
                          ? 'px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase leading-tight whitespace-normal'
                          : 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
                      }
                    >
                      Stock compra
                    </th>
                    <th
                      className={
                        showBookForm
                          ? 'px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase leading-tight whitespace-normal'
                          : 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
                      }
                    >
                      Stock renta
                    </th>
                    <th
                      className={
                        showBookForm
                          ? 'px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase leading-tight'
                          : 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
                      }
                    >
                      Precio
                    </th>
                    <th
                      className={
                        showBookForm
                          ? 'px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase leading-tight'
                          : 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
                      }
                    >
                      Disp.
                    </th>
                    <th className={`px-4 py-3 pr-16 ${showBookForm ? 'w-48' : 'w-40'}`} />
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(filteredBooks || []).map((b) => (
                    <tr key={b.id_libro}>
                      <td
                        title={String(b?.titulo || '-')}
                        className={
                          showBookForm
                            ? 'px-3 py-3 text-xs font-semibold text-gray-900 truncate'
                            : 'px-4 py-4 text-sm font-medium text-gray-900 truncate'
                        }
                      >
                        {b?.titulo || '-'}
                      </td>
                      <td
                        title={String(b?.autor || '-')}
                        className={
                          showBookForm
                            ? 'px-3 py-3 text-xs text-gray-600 truncate'
                            : 'px-4 py-4 text-sm text-gray-600 truncate'
                        }
                      >
                        {b?.autor || '-'}
                      </td>
                      <td
                        className={
                          showBookForm
                            ? 'hidden 2xl:table-cell px-3 py-3 text-xs text-gray-600 truncate'
                            : 'hidden xl:table-cell px-4 py-4 text-sm text-gray-600 truncate'
                        }
                        title={
                          b?.id_categoria != null ? String(categoryNameById.get(String(b.id_categoria)) || '-') : '-'
                        }
                      >
                        {b?.id_categoria != null ? categoryNameById.get(String(b.id_categoria)) || '-' : '-'}
                      </td>
                      <td className={showBookForm ? 'px-3 py-3 whitespace-nowrap text-xs text-gray-600' : 'px-4 py-4 whitespace-nowrap text-sm text-gray-600'}>
                        {Number(b?.stock_compra ?? b?.stock ?? 0)}
                      </td>
                      <td className={showBookForm ? 'px-3 py-3 whitespace-nowrap text-xs text-gray-600' : 'px-4 py-4 whitespace-nowrap text-sm text-gray-600'}>
                        {Number(b?.stock_renta ?? b?.stock ?? 0)}
                      </td>
                      <td className={showBookForm ? 'px-3 py-3 whitespace-nowrap text-xs text-gray-600' : 'px-4 py-4 whitespace-nowrap text-sm text-gray-600'}>
                        {Number(b?.valor ?? 0)}
                      </td>
                      <td className={showBookForm ? 'px-3 py-3 whitespace-nowrap text-xs text-gray-600' : 'px-4 py-4 whitespace-nowrap text-sm text-gray-600'}>
                        {Number(b?.disponibilidad) === 1 ? 'Sí' : 'No'}
                      </td>
                      <td className={`px-4 py-4 pr-16 whitespace-nowrap ${showBookForm ? 'text-center' : 'text-right'}`}>
                        <div className={`inline-flex flex-wrap items-center gap-2 ${showBookForm ? 'justify-center' : 'justify-end'}`}>
                          <button
                            type="button"
                            className="inline-flex h-9 w-24 items-center justify-center rounded-lg bg-gray-100 px-3 text-xs font-semibold text-gray-800 hover:bg-gray-200"
                            onClick={() => onEditBook(b)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            disabled={deletingBookId === Number(b.id_libro) || !canDeleteBook(b)}
                            className={
                              deletingBookId === Number(b.id_libro)
                                ? 'inline-flex h-9 w-24 items-center justify-center rounded-lg bg-rose-200 px-3 text-xs font-semibold text-rose-300'
                                : !canDeleteBook(b)
                                  ? 'inline-flex h-9 w-24 items-center justify-center rounded-lg bg-gray-100 px-3 text-xs font-semibold text-gray-400'
                                  : 'inline-flex h-9 w-24 items-center justify-center rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-700'
                            }
                            onClick={() => onDeleteBook(b)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {Array.isArray(filteredBooks) && filteredBooks.length === 0 ? (
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

          {showBookForm ? (
            <div ref={bookFormRef} className="bg-white shadow rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">{bookForm.id_libro ? 'Editar libro' : 'Nuevo libro'}</h2>
                <button
                  type="button"
                  className="rounded-lg bg-gray-200 px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-300"
                  onClick={onCloseBookForm}
                >
                  Cerrar
                </button>
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
                  <label className="form-label">Portada</label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px] sm:items-start">
                    <input
                      type="file"
                      accept="image/*"
                      className="form-input"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) {
                          setCoverDataUrl('');
                          return;
                        }
                        if (!String(file.type || '').startsWith('image/')) {
                          setError('Selecciona un archivo de imagen válido.');
                          setCoverDataUrl('');
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () => {
                          const result = String(reader.result || '');
                          setCoverDataUrl(result);
                        };
                        reader.onerror = () => {
                          setError('No se pudo leer la imagen.');
                          setCoverDataUrl('');
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                    <img
                      src={coverDataUrl || getLocalCoverUrl(bookForm.titulo) || createCoverDataUri(bookForm.titulo)}
                      alt="Vista previa de portada"
                      className="w-full rounded-xl border border-gray-200 object-cover aspect-[3/4]"
                      onError={(ev) => {
                        ev.currentTarget.onerror = null;
                        ev.currentTarget.src = createCoverDataUri(bookForm.titulo);
                      }}
                    />
                  </div>
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
                    onClick={() => {
                      setBookForm({ ...emptyBook });
                      setCoverDataUrl('');
                    }}
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
          ) : null}
        </div>
      ) : null}

      {tab === 'usuarios' ? (
        <div className={`grid grid-cols-1 gap-6 ${showUserForm ? 'lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]' : ''}`}>
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Usuarios</h2>
              <button type="button" className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700" onClick={onNewUser}>
                Nuevo
              </button>
            </div>
            <div className="lg:hidden">
              {(users || []).map((u) => {
                const roleId = Number(u?.id_rol);
                const isUserRole = roleId === 2;
                const isAdminRole = roleId === 1;
                const disableDelete = deletingUserId === Number(u.id_usuario) || !canDeleteUser(u);

                return (
                  <div key={u.id_usuario} className="border-t border-gray-200 p-4">
                    <div className="min-w-0">
                      <p title={String(u?.nombre || '-')} className="text-sm font-semibold text-gray-900 truncate">
                        {u?.nombre || '-'}
                      </p>
                      <p title={String(u?.correo || '-')} className="mt-1 text-xs text-gray-500 truncate">
                        {u?.correo || '-'}
                      </p>
                      <p className="mt-2 text-sm text-gray-700">
                        <span className="font-semibold text-gray-900">Rol:</span> {u?.nombre_rol || (u?.id_rol ? String(u.id_rol) : '-')}
                      </p>

                      <div className="mt-3 flex flex-col items-end gap-2">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            disabled={isUserRole}
                            className={
                              isUserRole
                                ? 'inline-flex h-9 w-24 items-center justify-center rounded-lg bg-gray-100 px-3 text-xs font-semibold text-gray-400'
                                : 'inline-flex h-9 w-24 items-center justify-center rounded-lg bg-gray-100 px-3 text-xs font-semibold text-gray-800 hover:bg-gray-200'
                            }
                            onClick={() => (isUserRole ? null : onSetUserRole(u.id_usuario, 2))}
                          >
                            USUARIO
                          </button>
                          <button
                            type="button"
                            disabled={isAdminRole}
                            className={
                              isAdminRole
                                ? 'inline-flex h-9 w-24 items-center justify-center rounded-lg bg-indigo-100 px-3 text-xs font-semibold text-indigo-400'
                                : 'inline-flex h-9 w-24 items-center justify-center rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700'
                            }
                            onClick={() => (isAdminRole ? null : onSetUserRole(u.id_usuario, 1))}
                          >
                            ADMIN
                          </button>
                        </div>

                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            className="inline-flex h-9 w-24 items-center justify-center rounded-lg bg-gray-100 px-3 text-xs font-semibold text-gray-800 hover:bg-gray-200"
                            onClick={() => onEditUser(u)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            disabled={disableDelete}
                            className={
                              deletingUserId === Number(u.id_usuario)
                                ? 'inline-flex h-9 w-24 items-center justify-center rounded-lg bg-rose-200 px-3 text-xs font-semibold text-rose-300'
                                : !canDeleteUser(u)
                                  ? 'inline-flex h-9 w-24 items-center justify-center rounded-lg bg-gray-100 px-3 text-xs font-semibold text-gray-400'
                                  : 'inline-flex h-9 w-24 items-center justify-center rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-700'
                            }
                            onClick={() => onDeleteUser(u)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {Array.isArray(users) && users.length === 0 ? <p className="px-6 py-4 text-sm text-gray-500">No hay usuarios.</p> : null}
            </div>

            <div className="hidden lg:block overflow-hidden">
              <table className="w-full table-fixed divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Correo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
                    <th className={`px-6 py-3 ${showUserForm ? 'w-56' : ''}`} />
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(users || []).map((u) => (
                    <tr key={u.id_usuario}>
                      <td title={String(u?.nombre || '-')} className="px-6 py-4 text-sm text-gray-900 truncate">
                        {u?.nombre || '-'}
                      </td>
                      <td title={String(u?.correo || '-')} className="px-6 py-4 text-sm text-gray-600 truncate">
                        {u?.correo || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {u?.nombre_rol || (u?.id_rol ? String(u.id_rol) : '-')}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap ${showUserForm ? 'text-center' : 'text-right'}`}>
                        <div className="inline-flex flex-col items-end gap-2">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled={u.id_rol === 2}
                              className={
                                u.id_rol === 2
                                  ? 'inline-flex h-9 w-24 items-center justify-center rounded-lg bg-gray-100 px-3 text-xs font-semibold text-gray-400'
                                  : 'inline-flex h-9 w-24 items-center justify-center rounded-lg bg-gray-100 px-3 text-xs font-semibold text-gray-800 hover:bg-gray-200'
                              }
                              onClick={() => onSetUserRole(u.id_usuario, 2)}
                            >
                              USUARIO
                            </button>
                            <button
                              type="button"
                              disabled={u.id_rol === 1}
                              className={
                                u.id_rol === 1
                                  ? 'inline-flex h-9 w-24 items-center justify-center rounded-lg bg-indigo-100 px-3 text-xs font-semibold text-indigo-400'
                                  : 'inline-flex h-9 w-24 items-center justify-center rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700'
                              }
                              onClick={() => onSetUserRole(u.id_usuario, 1)}
                            >
                              ADMIN
                            </button>
                          </div>

                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              className="inline-flex h-9 w-24 items-center justify-center rounded-lg bg-gray-100 px-3 text-xs font-semibold text-gray-800 hover:bg-gray-200"
                              onClick={() => onEditUser(u)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              disabled={deletingUserId === Number(u.id_usuario) || !canDeleteUser(u)}
                              className={
                                deletingUserId === Number(u.id_usuario)
                                  ? 'inline-flex h-9 w-24 items-center justify-center rounded-lg bg-rose-200 px-3 text-xs font-semibold text-rose-300'
                                  : !canDeleteUser(u)
                                    ? 'inline-flex h-9 w-24 items-center justify-center rounded-lg bg-gray-100 px-3 text-xs font-semibold text-gray-400'
                                    : 'inline-flex h-9 w-24 items-center justify-center rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-700'
                              }
                              onClick={() => onDeleteUser(u)}
                            >
                              Eliminar
                            </button>
                          </div>
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

          {showUserForm ? (
            <div ref={userFormRef} className="bg-white shadow rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">{editUserForm.id_usuario ? 'Editar usuario' : 'Crear usuario'}</h2>
                <button
                  type="button"
                  className="rounded-lg bg-gray-200 px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-300"
                  onClick={onCloseUserForm}
                >
                  Cerrar
                </button>
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

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
                    <button
                      type="button"
                      className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-300 w-full sm:w-auto"
                      onClick={onCancelEditUser}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={savingUser}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 w-full sm:w-auto"
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

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
                    <button
                      type="button"
                      className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-300 w-full sm:w-auto"
                      onClick={() => setNewUserForm({ nombre: '', correo: '', password: '', id_rol: 2 })}
                    >
                      Limpiar
                    </button>
                    <button
                      type="button"
                      disabled={creatingUser}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 w-full sm:w-auto"
                      onClick={onCreateUser}
                    >
                      Crear
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === 'prestamos' ? (
        <div className="space-y-4">
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
          </div>
          <div className="lg:hidden">
            {(loans || []).map((p) => (
              <div key={p.id_prestamo} className="border-t border-gray-200 p-4">
                <div className="min-w-0">
                  <p title={String(p?.titulo || '-')} className="text-sm font-semibold text-gray-900 truncate">
                    {p?.titulo || '-'}
                  </p>
                  <p title={String(p?.nombre || p?.correo || '-')} className="mt-1 text-xs text-gray-500 truncate">
                    {p?.nombre || p?.correo || '-'}
                  </p>

                  <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-gray-700">
                    <p>
                      <span className="font-semibold text-gray-900">Préstamo:</span> {formatDateOnly(p?.fecha_prestamo)}
                    </p>
                    <p>
                      <span className="font-semibold text-gray-900">Devolución:</span> {formatDateOnly(p?.fecha_devolucion)}
                    </p>
                    <p>
                      <span className="font-semibold text-gray-900">Devolución efectiva:</span>{' '}
                      {p?.fecha_devolucion_real ? formatDateOnly(p?.fecha_devolucion_real) : '-'}
                    </p>
                    <p>
                      <span className="font-semibold text-gray-900">Estado:</span> {p?.estado || '-'}
                    </p>
                    <p>
                      <span className="font-semibold text-gray-900">Ext.:</span> {Number(p?.extensiones ?? 0)}
                    </p>
                  </div>

                  <div className="mt-3 flex justify-end">
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
                  </div>
                </div>
              </div>
            ))}

            {Array.isArray(loans) && loans.length === 0 ? <p className="px-6 py-4 text-sm text-gray-500">No hay préstamos.</p> : null}
          </div>

          <div className="hidden lg:block overflow-hidden">
            <table className="w-full table-fixed divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Libro</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuario</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Préstamo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Devolución</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Devolución efectiva</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ext.</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(loans || []).map((p) => (
                  <tr key={p.id_prestamo}>
                    <td title={String(p?.titulo || '-')} className="px-6 py-4 text-sm text-gray-900 truncate">
                      {p?.titulo || '-'}
                    </td>
                    <td title={String(p?.nombre || p?.correo || '-')} className="px-6 py-4 text-sm text-gray-600 truncate">
                      {p?.nombre || p?.correo || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatDateOnly(p?.fecha_prestamo)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatDateOnly(p?.fecha_devolucion)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {p?.fecha_devolucion_real ? formatDateOnly(p?.fecha_devolucion_real) : '-'}
                    </td>
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
                    <td colSpan={8} className="px-6 py-4 text-sm text-gray-500">
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
