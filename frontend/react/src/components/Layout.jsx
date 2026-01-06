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

import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import Navbar from './Navbar.jsx';
import { getStoredUser } from '../lib/auth.js';

export default function Layout({ children }) {
  // sidebarOpen:
  // - Controla el sidebar en móvil.
  // - En desktop el sidebar siempre está visible por CSS.
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Usuario actual (sesión simple):
  // - Se lee desde localStorage para mostrar/ocultar opciones del menú.
  const user = getStoredUser();
  const isAdmin = Number(user?.id_rol) === 1;

  // linkClass:
  // - NavLink permite saber si la ruta está activa.
  // - Con esto aplicamos estilos (activo/inactivo) sin duplicar clases en cada link.
  const linkClass = ({ isActive }) =>
    isActive ? 'sidebar-link sidebar-link-active' : 'sidebar-link';

  return (
    <div className="relative min-h-screen md:flex">
      <aside
        id="sidebar"
        className={`bg-white w-64 p-4 absolute inset-y-0 left-0 transform md:relative md:translate-x-0 transition duration-200 ease-in-out shadow-lg ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <nav>
          <ul>
            <li className="mt-2">
              <NavLink to="/" className={linkClass} end>
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
                <span className="ml-3">Buscar</span>
              </NavLink>
            </li>

            <li className="mt-2">
              <NavLink to="/prestamos" className={linkClass}>
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
                    d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"
                  />
                </svg>
                <span className="ml-3">Préstamos</span>
              </NavLink>
            </li>

            <li className="mt-2">
              <NavLink to="/carrito" className={linkClass}>
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
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.5 7H19M7 13l-2-8m2 8h12"
                  />
                </svg>
                <span className="ml-3">Carrito</span>
              </NavLink>
            </li>

            <li className="mt-2">
              <NavLink to="/cuenta" className={linkClass}>
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
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                <span className="ml-3">Mi Cuenta</span>
              </NavLink>
            </li>

            <li className="mt-2">
              <NavLink to="/ayuda" className={linkClass}>
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
                    d="M12 16v-4"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8h.01" />
                </svg>
                <span className="ml-3">Ayuda</span>
              </NavLink>
            </li>

            {isAdmin ? (
              <li className="mt-2">
                <NavLink to="/admin" className={linkClass}>
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
                      d="M9 12l2 2 4-4m5-2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="ml-3">Administrador</span>
                </NavLink>
              </li>
            ) : null}
          </ul>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col">
        <div className="md:hidden bg-white shadow">
          <div className="max-w-7xl mx-auto py-4 px-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-blue-600">Biblioteca</span>
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
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 6h16M4 12h16m-7 6h7"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="hidden md:block">
          <Navbar />
        </div>

        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
