/*
  auth.js

  Este módulo agrupa la “autenticación mínima” del frontend.

  ¿Por qué existe?
  - En este proyecto no hay un login con cookies/JWT todavía.
  - Para poder probar compras/préstamos sin hardcodear un usuario, guardamos el usuario en localStorage.
  - Así, al recargar la página, la app recuerda quién inició sesión.
*/

const AUTH_STORAGE_KEY = 'tga_auth_user';
const AUTH_UPDATED_EVENT = 'tga_auth_updated';

const emitAuthUpdated = () => {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(AUTH_UPDATED_EVENT));
    }
  } catch {
  }
};

export const getStoredUser = () => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setStoredUser = (user) => {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  emitAuthUpdated();
};

export const clearStoredUser = () => {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  emitAuthUpdated();
};

export const subscribeAuth = (callback) => {
  if (typeof window === 'undefined') return () => {};
  if (typeof callback !== 'function') return () => {};

  const notify = () => callback(getStoredUser());
  const onStorage = (e) => {
    if (!e || e.key === AUTH_STORAGE_KEY) notify();
  };

  window.addEventListener(AUTH_UPDATED_EVENT, notify);
  window.addEventListener('storage', onStorage);

  return () => {
    window.removeEventListener(AUTH_UPDATED_EVENT, notify);
    window.removeEventListener('storage', onStorage);
  };
};
