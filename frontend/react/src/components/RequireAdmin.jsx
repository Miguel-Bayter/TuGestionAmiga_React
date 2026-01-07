/*
  RequireAdmin.jsx

  Componente de protección de rutas para el rol ADMIN.

  ¿Por qué existe?
  - El panel /admin no debe ser accesible por usuarios normales.
  - Como la sesión se guarda en localStorage, este guard valida el rol antes de renderizar.

  ¿Para qué sirve?
  - Si no hay sesión, redirige a /login.
  - Si el usuario no es ADMIN (id_rol != 1), redirige al inicio.
  - Si es ADMIN, renderiza el contenido protegido.
*/

import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getStoredUser, subscribeAuth } from '../lib/auth.js';

export default function RequireAdmin({ children }) {
  const location = useLocation();
  const [user, setUser] = useState(() => getStoredUser());

  useEffect(() => {
    return subscribeAuth((next) => setUser(next));
  }, []);

  if (!user?.id_usuario) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (Number(user?.id_rol) !== 1) {
    return <Navigate to="/" replace />;
  }

  return children;
}
