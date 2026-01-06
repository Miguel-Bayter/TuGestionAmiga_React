/*
  Navbar.jsx

  Barra superior de navegación.

  ¿Por qué existe?
  - En la maqueta HTML se repite el header con "Inicio" y "Cerrar Sesión".
  - En React lo convertimos en componente para reutilizarlo en todas las pantallas.
*/

import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { clearStoredUser, getStoredUser } from '../lib/auth.js';

export default function Navbar() {
  const navigate = useNavigate();

  // El navbar usa la sesión simple (localStorage) para mostrar el nombre.
  const user = getStoredUser();

  // onLogout:
  // - Limpia la sesión del navegador.
  // - Redirige a /login para evitar que el usuario quede en una ruta protegida.
  const onLogout = () => {
    clearStoredUser();
    navigate('/login');
  };

  return (
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex-shrink-0">
            <Link to="/" className="text-2xl font-bold text-blue-600">
              Biblioteca
            </Link>
          </div>

          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              <NavLink
                to="/"
                className={({ isActive }) =>
                  isActive
                    ? 'bg-blue-600 text-white px-3 py-2 rounded-md text-sm font-medium'
                    : 'text-gray-500 hover:bg-gray-200 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium'
                }
              >
                Inicio
              </NavLink>

              <button
                type="button"
                onClick={onLogout}
                className="text-gray-500 hover:bg-gray-200 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>

          <div className="hidden md:flex items-center">
            {user?.nombre ? (
              <span className="text-gray-600 text-sm mr-4">Bienvenido, {user.nombre}</span>
            ) : null}
          </div>

          <div className="md:hidden flex items-center">
            {/* El botón móvil lo controla el Layout (sidebar). */}
          </div>
        </div>
      </div>
    </header>
  );
}
