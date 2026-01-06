/*
  Login.jsx

  Pantalla de inicio de sesión.

  ¿Por qué existe?
  - En el HTML existe login.html.
  - Aquí consumimos POST /api/login y guardamos el usuario en localStorage.
  - También incluimos el flujo de “¿Olvidaste tu contraseña?” igual que la maqueta.
*/

import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api.js';
import { setStoredUser } from '../lib/auth.js';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  // Estado del formulario de login.
  // Se mantiene en memoria mientras la pantalla está montada.
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');

  // Estado del flujo "Olvidé mi contraseña":
  // - forgotOpen: abre/cierra el panel.
  // - fpStep: paso 1 = pedir código, paso 2 = restablecer.
  // - fpError/fpSuccess: mensajes para el usuario.
  const [forgotOpen, setForgotOpen] = useState(false);
  const [fpEmail, setFpEmail] = useState('');
  const [fpCode, setFpCode] = useState('');
  const [fpNew, setFpNew] = useState('');
  const [fpConfirm, setFpConfirm] = useState('');
  const [fpStep, setFpStep] = useState(1);
  const [fpError, setFpError] = useState('');
  const [fpSuccess, setFpSuccess] = useState('');

  // onSubmit:
  // - Envía correo/password al backend.
  // - Si el backend valida (bcrypt), devuelve un usuario "seguro" (sin contraseña).
  // - Guardamos el usuario en localStorage para que la app recuerde sesión.
  // - Redirigimos al destino original si venía de un guard (RequireAuth/RequireAdmin).
  const onSubmit = async (e) => {
    e.preventDefault();

    try {
      const data = await apiFetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo, password })
      });

      setStoredUser(data);

      // Si el usuario llegó aquí porque intentó entrar a una ruta protegida,
      // RequireAuth guarda el destino en location.state.from.
      const to = location.state?.from || '/';
      navigate(to);
    } catch (err) {
      window.alert(err?.message || 'No se pudo iniciar sesión');
    }
  };

  // Limpia el estado del flujo "Olvidé mi contraseña" para poder reintentar sin arrastrar mensajes.
  const resetForgot = () => {
    setFpError('');
    setFpSuccess('');
    setFpStep(1);
    setFpCode('');
    setFpNew('');
    setFpConfirm('');
  };

  const sendCode = async () => {
    setFpError('');
    setFpSuccess('');

    if (!fpEmail) {
      setFpError('Escribe tu correo');
      return;
    }

    try {
      const data = await apiFetch('/api/password/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo: fpEmail })
      });

      setFpSuccess('Si el correo existe, se generó un código temporal.');
      if (data?.demo_code) {
        setFpCode(String(data.demo_code));
        setFpSuccess(`Código generado (demo): ${String(data.demo_code)}`);
      }

      setFpStep(2);
    } catch (e) {
      setFpError(e?.message || 'No se pudo enviar el código');
    }
  };

  const resetPassword = async () => {
    setFpError('');
    setFpSuccess('');

    if (!fpEmail || !fpCode || !fpNew || !fpConfirm) {
      setFpError('Completa todos los campos');
      return;
    }

    if (fpNew !== fpConfirm) {
      setFpError('La confirmación no coincide');
      return;
    }

    try {
      await apiFetch('/api/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo: fpEmail, code: fpCode, new_password: fpNew })
      });

      setFpSuccess('Contraseña actualizada. Ya puedes iniciar sesión.');
      setFpStep(1);
      setFpCode('');
      setFpNew('');
      setFpConfirm('');
    } catch (e) {
      setFpError(e?.message || 'No se pudo restablecer la contraseña');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="auth-card">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-gray-900">Inicia sesión en tu cuenta</h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            O{' '}
            <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500">
              créate una nueva cuenta
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={onSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
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
            <div className="pt-4">
              <label className="form-label">Contraseña</label>
              <input
                type="password"
                required
                className="form-input"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm">
              <button
                id="login-forgot-password-toggle"
                type="button"
                className="font-medium text-blue-600 hover:text-blue-500"
                onClick={() => {
                  setForgotOpen((v) => !v);
                  if (!forgotOpen) {
                    setFpEmail(fpEmail || correo);
                  }
                  resetForgot();
                }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          </div>

          {forgotOpen ? (
            <div
              id="login-forgot-password-panel"
              className="rounded-xl border border-gray-200 bg-gradient-to-b from-gray-50 to-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Recuperar acceso</p>
                  <p className="mt-1 text-sm text-gray-600">
                    Genera un código temporal y úsalo para crear una nueva contraseña.
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg px-3 py-1 text-sm font-semibold text-gray-600 hover:bg-gray-100"
                  onClick={() => {
                    setForgotOpen(false);
                    resetForgot();
                  }}
                >
                  Cerrar
                </button>
              </div>

              {fpStep === 1 ? (
                <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Paso 1</p>
                  <p className="mt-1 text-sm text-gray-700">Escribe tu correo y presiona “Enviar código”.</p>

                  <div className="mt-3">
                    <label className="form-label">Correo Electrónico</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="ejemplo@correo.com"
                      value={fpEmail}
                      onChange={(e) => setFpEmail(e.target.value)}
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-end">
                    <button
                      type="button"
                      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                      onClick={sendCode}
                    >
                      Enviar código
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Paso 2</p>
                  <p className="mt-1 text-sm text-gray-700">Ingresa el código y tu nueva contraseña.</p>

                  <div className="mt-3">
                    <label className="form-label">Código</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ej: 123456"
                      value={fpCode}
                      onChange={(e) => setFpCode(e.target.value)}
                    />
                  </div>

                  <div className="mt-3">
                    <label className="form-label">Nueva contraseña</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Nueva contraseña"
                      value={fpNew}
                      onChange={(e) => setFpNew(e.target.value)}
                    />
                  </div>

                  <div className="mt-3">
                    <label className="form-label">Confirmar nueva contraseña</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Confirmar nueva contraseña"
                      value={fpConfirm}
                      onChange={(e) => setFpConfirm(e.target.value)}
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      className="rounded-md bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-300"
                      onClick={() => {
                        resetForgot();
                        setFpStep(1);
                      }}
                    >
                      Volver
                    </button>

                    <button
                      type="button"
                      className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                      onClick={resetPassword}
                    >
                      Restablecer
                    </button>
                  </div>
                </div>
              )}

              {fpError ? (
                <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{fpError}</p>
              ) : null}
              {fpSuccess ? (
                <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{fpSuccess}</p>
              ) : null}
            </div>
          ) : null}

          <div>
            <button type="submit" className="btn-primary-full">
              Ingresar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
