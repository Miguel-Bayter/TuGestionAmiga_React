/*
  auth.js

  Este módulo agrupa la “autenticación mínima” del frontend.

  ¿Por qué existe?
  - En este proyecto no hay un login con cookies/JWT todavía.
  - Para poder probar compras/préstamos sin hardcodear un usuario, guardamos el usuario en localStorage.
  - Así, al recargar la página, la app recuerda quién inició sesión.
*/

const AUTH_STORAGE_KEY = 'tga_auth_user';

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
};

export const clearStoredUser = () => {
  localStorage.removeItem(AUTH_STORAGE_KEY);
};
