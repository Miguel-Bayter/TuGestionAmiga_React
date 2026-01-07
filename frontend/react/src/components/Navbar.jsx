/*
  Navbar.jsx

  Barra superior de navegación.

  ¿Por qué existe?
  - En la maqueta HTML se repite el header con "Inicio" y "Cerrar Sesión".
  - En React lo convertimos en componente para reutilizarlo en todas las pantallas.
*/

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clearStoredUser, getStoredUser, subscribeAuth } from '../lib/auth.js';

export default function Navbar({ onToggleSidebar, sidebarCollapsed }) {
  const navigate = useNavigate();

  // El navbar usa la sesión simple (localStorage) para mostrar el nombre.
  const [user, setUser] = useState(() => getStoredUser());

  useEffect(() => {
    return subscribeAuth((next) => setUser(next));
  }, []);

  // onLogout:
  // - Limpia la sesión del navegador.
  // - Redirige a /login para evitar que el usuario quede en una ruta protegida.
  const onLogout = () => {
    clearStoredUser();
    navigate('/login');
  };

  const isAdmin = Number(user?.id_rol) === 1;
  const roleLabel = isAdmin ? 'Administrador' : 'Usuario';

  const initials = (() => {
    const raw = String(user?.nombre || '').trim();
    if (!raw) return 'U';
    const parts = raw.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] || 'U';
    const second = parts.length > 1 ? parts[parts.length - 1]?.[0] : '';
    return `${first}${second}`.toUpperCase();
  })();

  return (
    <header className="bg-white border-b border-gray-200/70">
      <div className="max-w-7xl mx-auto py-3 px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200/60 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-700 ring-1 ring-gray-200/60">
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 19V6a2 2 0 012-2h12v15a2 2 0 00-2-2H6a2 2 0 00-2 2zm14 0a2 2 0 012-2h0a2 2 0 012 2v1H18v-1z"
                  />
                </svg>
              </div>

              <Link to="/" className="text-lg sm:text-xl font-bold text-gray-900 leading-6 truncate">
                Tu Gestión Amiga
              </Link>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                aria-label="Notificaciones"
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900"
              >
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17a3 3 0 006 0" />
                </svg>
              </button>

              <button
                type="button"
                onClick={() => navigate('/cuenta')}
                className="flex items-center gap-3 rounded-2xl bg-gray-50 px-2 py-1 ring-1 ring-gray-200/60 hover:bg-gray-100"
                aria-label="Ir a Mi Cuenta"
              >
                <div
                  className={`h-9 w-9 rounded-2xl flex items-center justify-center text-sm font-bold select-none ring-1 ring-black/5 ${
                    isAdmin ? 'bg-blue-600 text-white' : 'bg-gray-900 text-white'
                  }`}
                  aria-label="Avatar"
                  title={user?.nombre ? `Usuario: ${user.nombre}` : 'Usuario'}
                >
                  {initials}
                </div>

                <div className="hidden sm:block min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">{user?.nombre || 'Usuario'}</div>
                  <div className="text-xs text-gray-500 truncate">{roleLabel}</div>
                </div>
              </button>

              <button
                type="button"
                onClick={onLogout}
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-gray-100 px-3 text-sm font-semibold text-gray-700 hover:bg-gray-200"
              >
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 16l-4-4m0 0l4-4m-4 4h12" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 19a2 2 0 002-2V7a2 2 0 00-2-2H9a2 2 0 00-2 2v2" />
                </svg>
                <span className="hidden sm:inline">Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
