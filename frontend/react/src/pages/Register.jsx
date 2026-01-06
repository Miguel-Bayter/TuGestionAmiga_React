/*
  Register.jsx

  Pantalla de registro.

  ¿Por qué existe?
  - En el HTML existe register.html.
  - Aquí consumimos POST /api/register.
  - Si todo sale bien, guardamos el usuario en localStorage y redirigimos al inicio.
*/

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api.js';
import { setStoredUser } from '../lib/auth.js';

export default function Register() {
  const navigate = useNavigate();

  // Estado del formulario:
  // - Se guarda en memoria mientras el componente está montado.
  // - Se usa para construir el body del POST /api/register.
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  // onSubmit:
  // - Evita el comportamiento por defecto del form (recargar la página).
  // - Valida confirmación de contraseña antes de llamar al backend.
  // - Si el backend crea el usuario, devuelve { id_usuario, nombre, correo, id_rol }.
  // - Se guarda ese objeto en localStorage (sesión simple) para habilitar flujos de compra/préstamo.
  const onSubmit = async (e) => {
    e.preventDefault();

    // Validación del lado del cliente:
    // evita enviar datos inconsistentes y mejora UX.
    if (password !== confirm) {
      window.alert('La confirmación no coincide');
      return;
    }

    try {
      // Registro en backend.
      // Nota: el backend normaliza el correo (trim + lower).
      const data = await apiFetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, correo, password })
      });

      // Guardamos el usuario para que el resto de pantallas lo detecten.
      setStoredUser(data);

      // Redirigimos al inicio para que el usuario vea el catálogo.
      navigate('/');
    } catch (e2) {
      window.alert(e2?.message || 'No se pudo registrar');
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8 bg-gray-100">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Crea una nueva cuenta</h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          O{' '}
          <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
            inicia sesión si ya tienes una
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="auth-card">
          <form className="space-y-6" onSubmit={onSubmit}>
            <div>
              <label className="form-label">Nombre Completo</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="Miguel Bayter"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>

            <div>
              <label className="form-label">Correo Electrónico</label>
              <input
                type="email"
                required
                className="form-input"
                placeholder="ejemplo@correo.com"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
              />
            </div>

            <div>
              <label className="form-label">Contraseña</label>
              <input
                type="password"
                required
                className="form-input"
                placeholder="Crea una contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div>
              <label className="form-label">Confirmar Contraseña</label>
              <input
                type="password"
                required
                className="form-input"
                placeholder="Confirma tu contraseña"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>

            <div>
              <button type="submit" className="btn-primary-full">
                Registrarse
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
