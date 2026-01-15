/*
  covers.js

  Este módulo resuelve el tema de portadas:

  - La base de datos no tiene URL de imagen.
  - El backend expone GET /api/covers con la lista de archivos reales que existen en /src/assets/images.
  - El frontend intenta “hacer match” entre el título del libro y el nombre del archivo.
  - Si no existe imagen, se genera una portada SVG como fallback.
*/

import { apiFetch } from './api.js';

const STOPWORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las']);

const normalizeCoverKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // En Windows hay caracteres que no se pueden usar en nombres de archivo (por ejemplo ':').
    // Para que el título del libro pueda hacer match con el filename, quitamos puntuación y símbolos.
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ');

const normalizeForMatch = (value) =>
  normalizeCoverKey(value)
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .filter((w) => !STOPWORDS.has(w))
    .join(' ');

let coverMap = null;
let coverMapPromise = null;

export const invalidateCoverMap = () => {
  coverMap = null;
  coverMapPromise = null;
};

export const ensureCoverMap = async () => {
  if (coverMapPromise) return coverMapPromise;

  coverMapPromise = (async () => {
    const map = new Map();

    try {
      const files = await apiFetch('/api/covers');
      if (Array.isArray(files)) {
        files.forEach((file) => {
          const base = String(file || '').replace(/\.[^/.]+$/, '');
          const key = normalizeForMatch(base);
          if (!key) return;
          map.set(key, `/src/assets/images/${file}`);
        });
      }
    } catch {
      // Si el backend no está corriendo o no existe la ruta, dejamos el mapa vacío.
      // El UI sigue funcionando gracias al fallback (SVG).
    }

    coverMap = map;
    return map;
  })();

  return coverMapPromise;
};

export const getLocalCoverUrl = (title) => {
  if (!coverMap) return '';
  const key = normalizeForMatch(title);
  return coverMap.get(key) || '';
};

export const createCoverDataUri = (title) => {
  const safeTitle = String(title || 'Libro').slice(0, 22);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#4f46e5"/><stop offset="1" stop-color="#0ea5e9"/></linearGradient></defs><rect width="256" height="256" fill="url(#g)"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="22" fill="white">${safeTitle
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};
