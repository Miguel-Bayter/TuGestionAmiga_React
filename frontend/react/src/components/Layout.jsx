/*
  Layout.jsx

  Este componente define el “marco” visual de la app:
  - Sidebar (menú lateral)
  - Header (Navbar)
  - Área principal donde se renderiza cada pantalla

  ¿Por qué existe?
  - En la maqueta HTML el layout se repite en index.html, prestamos.html, cuenta.html, etc.
  - En React lo centralizamos para no duplicar HTML y asegurar que el diseño sea consistente.
*/

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router-dom';
import Navbar from './Navbar.jsx';
import { getStoredUser, subscribeAuth } from '../lib/auth.js';
import { apiFetch } from '../lib/api.js';

export default function Layout({ children }) {
  // sidebarOpen:
  // - Controla el sidebar en móvil.
  // - En desktop el sidebar siempre está visible por CSS.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem('sidebarCollapsed') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem('sidebarCollapsed', sidebarCollapsed ? '1' : '0');
    } catch {
      // ignore
    }
  }, [sidebarCollapsed]);

  // Usuario actual (sesión simple):
  // - Se lee desde localStorage para mostrar/ocultar opciones del menú.
  const [user, setUser] = useState(() => getStoredUser());

  useEffect(() => {
    return subscribeAuth((next) => setUser(next));
  }, []);

  const isAdmin = Number(user?.id_rol) === 1;

  const [cartCount, setCartCount] = useState(0);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let alive = true;

    const loadCartCount = async () => {
      const id = user?.id_usuario;
      if (!id) {
        if (alive) setCartCount(0);
        try {
          if (typeof window !== 'undefined') window.__tga_cart_items = [];
        } catch {
        }
        return;
      }

      try {
        const data = await apiFetch(`/api/carrito?id_usuario=${encodeURIComponent(id)}`);
        const items = Array.isArray(data) ? data : [];
        const totalQty = items.reduce((acc, it) => acc + (Number(it?.cantidad) || 0), 0);
        if (alive) setCartCount(totalQty);
        try {
          if (typeof window !== 'undefined') window.__tga_cart_items = items;
        } catch {
        }
      } catch {
        if (alive) setCartCount(0);
        try {
          if (typeof window !== 'undefined') window.__tga_cart_items = [];
        } catch {
        }
      }
    };

    loadCartCount();
    const onUpdated = () => loadCartCount();
    window.addEventListener('tga_cart_updated', onUpdated);
    return () => {
      alive = false;
      window.removeEventListener('tga_cart_updated', onUpdated);
    };
  }, [user?.id_usuario]);

  useEffect(() => {
    let timer = null;

    const onToast = (e) => {
      const msg =
        typeof e?.detail === 'string'
          ? e.detail
          : String(e?.detail?.message || '').trim();
      if (!msg) return;
      setToast({ message: msg, id: Date.now() });
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setToast(null), 2600);
    };

    window.addEventListener('tga_toast', onToast);
    return () => {
      window.removeEventListener('tga_toast', onToast);
      if (timer) clearTimeout(timer);
    };
  }, []);

  // linkClass:
  // - NavLink permite saber si la ruta está activa.
  // - Con esto aplicamos estilos (activo/inactivo) sin duplicar clases en cada link.
  const linkClass = ({ isActive }) => {
    const base = isActive ? 'sidebar-link sidebar-link-active' : 'sidebar-link';
    return sidebarCollapsed
      ? `${base} md:justify-center md:h-11 md:w-11 md:mx-auto md:px-0 md:gap-0`
      : `${base}`;
  };

  return (
    <div className="relative min-h-screen flex flex-col overflow-x-hidden">
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Cerrar menú"
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <div className="md:hidden sticky top-0 z-40 bg-white shadow">
        <div className="max-w-7xl mx-auto py-4 px-4">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-blue-600">Tu Gestión Amiga</span>
            <button
              id="mobile-menu-button"
              aria-label="Abrir menú"
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400"
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
            >
              <svg
                className="h-6 w-6"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <circle cx="6" cy="7" r="1.5" fill="currentColor" stroke="none" />
                <circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none" />
                <circle cx="6" cy="17" r="1.5" fill="currentColor" stroke="none" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 7h10" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 12h10" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 17h10" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="hidden md:block sticky top-0 z-40 bg-white">
        <Navbar onToggleSidebar={() => setSidebarCollapsed((v) => !v)} sidebarCollapsed={sidebarCollapsed} />
      </div>

      <div className="flex-1 md:flex md:items-start">
        <aside
          id="sidebar"
          className={`relative z-50 bg-white w-64 p-4 absolute inset-y-0 left-0 transform md:fixed md:top-24 md:left-4 md:inset-y-auto md:transform-none md:rounded-2xl md:ring-1 md:ring-gray-200/60 md:shadow-sm transition duration-200 ease-in-out shadow-lg ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } ${sidebarCollapsed ? 'md:w-20 md:p-3' : ''}`}
        >
          <div className={`mb-4 flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} border-b border-gray-200/60 pb-4`}>
            <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-semibold select-none">
              T
            </div>
            {!sidebarCollapsed ? (
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900 leading-5 truncate">Tu Gestión Amiga</div>
                <div className="text-xs text-gray-500 truncate">Menú</div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            aria-label={sidebarCollapsed ? 'Expandir menú' : 'Colapsar menú'}
            className="hidden md:inline-flex absolute -right-3 top-8 h-8 w-8 items-center justify-center rounded-full bg-white text-gray-600 ring-1 ring-gray-200 shadow-sm hover:bg-gray-50"
            onClick={() => setSidebarCollapsed((v) => !v)}
          >
            {sidebarCollapsed ? (
              <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            ) : (
              <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            )}
          </button>

          <nav onClick={() => setSidebarOpen(false)}>
            <ul className="flex flex-col">
              <li className="mt-1">
                <NavLink to="/" className={linkClass} end title="Inicio">
                  <svg
                    className="w-6 h-6"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M3 10.5l9-7 9 7V21a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1V10.5z"
                    />
                  </svg>
                  <span className={`${sidebarCollapsed ? 'md:hidden' : ''}`}>Inicio</span>
                </NavLink>
              </li>

              <li className="mt-1">
                <NavLink to="/buscar" className={linkClass} title="Buscar">
                  <svg
                    className="w-6 h-6"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <span className={`${sidebarCollapsed ? 'md:hidden' : ''}`}>Buscar</span>
                </NavLink>
              </li>

            <li className="mt-1">
              <NavLink to="/prestamos" className={linkClass} title="Préstamos">
                <svg
                  className="w-6 h-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 5h6a2 2 0 012 2v1m-10-3a2 2 0 00-2 2v1m12 0H7m10 0v10a2 2 0 01-2 2H9a2 2 0 01-2-2V8m3 4h4m-4 4h4"
                  />
                </svg>
                <span className={`${sidebarCollapsed ? 'md:hidden' : ''}`}>Préstamos</span>
              </NavLink>
            </li>

            <li className="mt-1">
              <NavLink to="/carrito" className={linkClass} title="Carrito">
                <span className="relative inline-flex">
                  <svg
                    className="w-6 h-6"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M2.25 3h1.5l1.06 4.25m0 0h15.24l-1.35 6.75H6.3m-1.49-6.75L6.3 19.5h12.9"
                    />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 21a1 1 0 100-2 1 1 0 000 2zm9 0a1 1 0 100-2 1 1 0 000 2z" />
                  </svg>
                  {cartCount > 0 ? (
                    <span
                      className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[11px] font-bold leading-[18px] text-center ring-2 ring-white"
                      aria-label={`Carrito con ${cartCount} items`}
                      title={`Carrito: ${cartCount}`}
                    >
                      {cartCount > 99 ? '99+' : cartCount}
                    </span>
                  ) : null}
                </span>
                <span className={`${sidebarCollapsed ? 'md:hidden' : ''}`}>Carrito</span>
              </NavLink>
            </li>

            <li className="mt-1">
              <NavLink to="/cuenta" className={linkClass} title="Mi Cuenta">
                <svg
                  className="w-6 h-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4.5 20.25a7.5 7.5 0 0115 0"
                  />
                </svg>
                <span className={`${sidebarCollapsed ? 'md:hidden' : ''}`}>Mi Cuenta</span>
              </NavLink>
            </li>

            {isAdmin ? (
              <li className="mt-1">
                <NavLink to="/admin" className={linkClass} title="Administrador">
                  <svg
                    className="w-6 h-6"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 3l7 4v5c0 5-3 9-7 9s-7-4-7-9V7l7-4z"
                    />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.5 12.5l1.5 1.5 3.5-3.5" />
                  </svg>
                  <span className={`${sidebarCollapsed ? 'md:hidden' : ''}`}>Administrador</span>
                </NavLink>
              </li>
            ) : null}

            <li className="mt-4 border-t border-gray-200/60 pt-4">
              <NavLink to="/ayuda" className={linkClass} title="Ayuda">
                <svg
                  className="w-6 h-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 2a10 10 0 100 20 10 10 0 000-20z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9.75 9a2.25 2.25 0 014.5 0c0 1.5-2.25 1.875-2.25 3.75"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 17.25h.01" />
                </svg>
                <span className={`${sidebarCollapsed ? 'md:hidden' : ''}`}>Ayuda</span>
              </NavLink>
            </li>
            </ul>
          </nav>
        </aside>

        <main
          className={`flex-1 p-4 sm:p-6 min-h-0 ${sidebarCollapsed ? 'md:ml-28' : 'md:ml-72'}`}
        >
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>

      {toast
        ? (() => {
            const portalTarget = typeof document !== 'undefined' ? document.body : null;

            const node = (
              <div className="fixed top-4 right-4 z-[90]">
                <div className="max-w-sm rounded-2xl bg-gray-900/95 px-4 py-3 text-sm font-semibold text-white shadow-2xl ring-1 ring-white/10">
                  {toast.message}
                </div>
              </div>
            );

            return portalTarget ? createPortal(node, portalTarget) : node;
          })()
        : null}
    </div>
  );
}
