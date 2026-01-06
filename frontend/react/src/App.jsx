/*
  App.jsx

  Este archivo define las rutas principales del frontend React.

  ¿Por qué existe?
  - En una SPA (Single Page Application) necesitamos mapear URLs a pantallas.
  - Aquí centralizamos el ruteo para que todas las páginas tengan un punto único de entrada.

  ¿Para qué sirve?
  - Conecta cada path (/, /prestamos, /cuenta, /admin, etc.) con su componente.
  - Aplica wrappers de seguridad como RequireAuth y RequireAdmin.
  - Envuelve pantallas dentro de Layout para mantener el diseño consistente.
*/

import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import RequireAdmin from './components/RequireAdmin.jsx';
import { getStoredUser } from './lib/auth.js';
import Dashboard from './pages/Dashboard.jsx';
import Prestamos from './pages/Prestamos.jsx';
import Cuenta from './pages/Cuenta.jsx';
import Carrito from './pages/Carrito.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Ayuda from './pages/Ayuda.jsx';
import Admin from './pages/Admin.jsx';

export default function App() {
  const user = getStoredUser();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        path="/"
        element={
          user?.id_usuario ? (
            <Layout>
              <Dashboard />
            </Layout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route
        path="/rentable"
        element={
          <Layout>
            <Dashboard />
          </Layout>
        }
      />

      <Route
        path="/ayuda"
        element={
          <Layout>
            <Ayuda />
          </Layout>
        }
      />

      <Route
        path="/prestamos"
        element={
          <RequireAuth>
            <Layout>
              <Prestamos />
            </Layout>
          </RequireAuth>
        }
      />

      <Route
        path="/cuenta"
        element={
          <RequireAuth>
            <Layout>
              <Cuenta />
            </Layout>
          </RequireAuth>
        }
      />

      <Route
        path="/carrito"
        element={
          <RequireAuth>
            <Layout>
              <Carrito />
            </Layout>
          </RequireAuth>
        }
      />

      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <Layout>
              <Admin />
            </Layout>
          </RequireAdmin>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
