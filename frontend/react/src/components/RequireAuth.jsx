/*
  RequireAuth.jsx

  Este componente protege rutas.

  ¿Por qué existe?
  - Hay pantallas (Préstamos / Cuenta) que solo tienen sentido si hay un usuario logueado.
  - Como la auth es por localStorage, aquí validamos: si no hay usuario, enviamos a /login.
*/

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getStoredUser } from '../lib/auth.js';

export default function RequireAuth({ children }) {
  const location = useLocation();
  const user = getStoredUser();

  if (!user?.id_usuario) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
