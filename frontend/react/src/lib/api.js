/*
  api.js

  Este archivo centraliza el consumo de la API (/api/*).

  ¿Por qué existe?
  - En varias pantallas hacemos fetch y necesitamos el mismo manejo de errores.
  - Si el backend responde con un JSON { error }, aquí lo convertimos a un Error entendible.
  - Si no responde JSON (por ejemplo un error HTML), igual devolvemos un mensaje seguro.
*/

 import { getStoredUser } from './auth.js';

export const safeJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

export const apiFetch = async (url, options) => {
  const user = getStoredUser();
  const uid = Number(user?.id_usuario);
  const extraHeaders = Number.isFinite(uid) ? { 'x-user-id': String(uid) } : {};

  const mergedOptions = {
    ...(options || {}),
    headers: {
      ...extraHeaders,
      ...((options && options.headers) || {})
    }
  };

  const res = await fetch(url, mergedOptions);
  const data = await safeJson(res);

  if (!res.ok) {
    const msg = data?.error || `Error HTTP ${res.status}`;
    const err = new Error(String(msg));
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
};
