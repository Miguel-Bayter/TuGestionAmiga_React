import express from 'express';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

/*
  server.js (backend)

  Este archivo implementa el servidor Express y la API REST del proyecto.

  ¿Por qué existe?
  - El navegador (HTML/JS/React) no puede conectarse directamente a MySQL.
  - Se necesita una capa intermedia (backend) que:
    - Lea variables de entorno (.env)
    - Ejecute consultas SQL de forma segura
    - Exponga endpoints /api/* consumibles desde el frontend

  ¿Para qué sirve?
  - Servir los archivos estáticos del frontend (HTML/CSS/JS) desde un solo servidor.
  - Exponer endpoints para libros, compras, préstamos y usuarios.
  - Aplicar reglas de negocio (disponibilidad, transacciones, validaciones).
  - Controlar permisos por rol (ADMIN/USUARIO) en rutas /api/admin/*.
*/

// ================================
//  Resolución de rutas (Node ESM)
// ================================
// En proyectos con "type": "module" no existe __dirname por defecto.
// Por eso reconstruimos __filename/__dirname con fileURLToPath.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =========================================
//  Ubicación del proyecto y carga de .env
// =========================================
// Este archivo vive en backend/server/.
// - PROJECT_ROOT apunta a la carpeta backend/
// - REPO_ROOT apunta a la raíz del repositorio (donde viven backend/ y frontend/)
const PROJECT_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PROJECT_ROOT, '..');

// Cargo variables de entorno (credenciales) desde .env.
// La idea es no dejar usuario/clave de MySQL escritos en el código.
dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });

const app = express();

// ================================
//  Configuración general
// ================================
// Puerto del servidor (si no está en .env usamos 3000)
const PORT = Number(process.env.PORT || 3000);

// Config de MySQL (si no está en .env usamos valores típicos de local)
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'tugestionamiga_db';
const DB_PORT = Number(process.env.DB_PORT || 3306);

// ================================
//  Conexión a MySQL (Pool)
// ================================
// Pool de conexiones = una “piscina” de conexiones reutilizables.
// Así no abrimos/cerramos una conexión nueva por cada request.
const pool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  port: DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Permite escribir queries con :param en vez de ? para que sea más legible.
  // Ej: WHERE id_usuario = :id_usuario
  namedPlaceholders: true
});

// =============================================
//  Compatibilidad: columnas variables en "libro"
// =============================================
// Detección de columnas (compatibilidad con scripts SQL distintos):
// En la carpeta sql hay variantes donde `libro` puede tener columnas extra como `stock` o `valor`.
// Si en el SELECT pedimos una columna que no existe, MySQL devuelve error y rompe el endpoint.
// Por eso consultamos el esquema 1 vez (lazy) y armamos el SELECT según lo que exista.
let libroColumnsPromise = null;
const getLibroColumns = async () => {
  if (libroColumnsPromise) return libroColumnsPromise;

  libroColumnsPromise = (async () => {
    try {
      const [rows] = await pool.query('SHOW COLUMNS FROM libro');
      const set = new Set();
      for (const r of rows || []) {
        if (r?.Field) set.add(String(r.Field));
      }
      return set;
    } catch {
      // Si falla (ej: tabla no existe aún), devolvemos set vacío para no romper los endpoints.
      return new Set();
    }
  })();

  return libroColumnsPromise;
};

const resetLibroColumnsCache = () => {
  libroColumnsPromise = null;
};

let prestamoColumnsPromise = null;
const getPrestamoColumns = async () => {
  if (prestamoColumnsPromise) return prestamoColumnsPromise;

  prestamoColumnsPromise = (async () => {
    try {
      const [rows] = await pool.query('SHOW COLUMNS FROM prestamo');
      const set = new Set();
      for (const r of rows || []) {
        if (r?.Field) set.add(String(r.Field));
      }
      return set;
    } catch {
      return new Set();
    }
  })();

  return prestamoColumnsPromise;
};

const resetPrestamoColumnsCache = () => {
  prestamoColumnsPromise = null;
};

const ensurePrestamoFechaRealColumn = async () => {
  const cols = await getPrestamoColumns();
  if (cols.has('fecha_devolucion_real')) return true;
  try {
    await pool.query('ALTER TABLE prestamo ADD COLUMN fecha_devolucion_real DATE NULL');
    resetPrestamoColumnsCache();
    return true;
  } catch (e) {
    const msg = String(e?.message || '').toLowerCase();
    const code = String(e?.code || '').toUpperCase();
    if (code === 'ER_DUP_FIELDNAME' || msg.includes('duplicate column')) {
      resetPrestamoColumnsCache();
      return true;
    }
    try {
      const [rows] = await pool.query("SHOW COLUMNS FROM prestamo LIKE 'fecha_devolucion_real'");
      if (Array.isArray(rows) && rows.length) {
        resetPrestamoColumnsCache();
        return true;
      }
    } catch {
    }
    return false;
  }
};

// ensureSchema:
// - Este proyecto empezó con un esquema simple (libro.stock y libro.disponibilidad).
// - Con los cambios del sistema se agregaron columnas/tablas nuevas:
//   - libro.stock_compra y libro.stock_renta (stock dual)
//   - prestamo.extensiones (control de prórrogas)
//   - carrito_item (carrito persistente por usuario)
//
// ¿Por qué está aquí?
// - En ambientes de clase es común que la BD ya exista con una versión anterior.
// - Si intentamos usar columnas que no existen, MySQL rompe el endpoint.
// - Esta función hace una “migración ligera” al iniciar el backend:
//   crea/ajusta lo mínimo para que la API funcione sin obligar a recrear la BD.
const ensureSchema = async () => {
  try {
    const libroCols = await getLibroColumns();
    const alters = [];

    if (!libroCols.has('stock_compra')) alters.push('ADD COLUMN stock_compra INT NOT NULL DEFAULT 0');
    if (!libroCols.has('stock_renta')) alters.push('ADD COLUMN stock_renta INT NOT NULL DEFAULT 0');

    if (alters.length) {
      await pool.query(`ALTER TABLE libro ${alters.join(', ')}`);
      resetLibroColumnsCache();

      const libroColsAfter = await getLibroColumns();
      if (libroColsAfter.has('stock') && libroColsAfter.has('stock_compra')) {
        await pool.query('UPDATE libro SET stock_compra = stock WHERE stock_compra = 0 AND stock IS NOT NULL');
      }
      if (libroColsAfter.has('stock') && libroColsAfter.has('stock_renta')) {
        await pool.query('UPDATE libro SET stock_renta = stock WHERE stock_renta = 0 AND stock IS NOT NULL');
      }
    }
  } catch {
  }

  try {
    // Extensiones de préstamo:
    // - La columna extensiones permite limitar cuántas veces se puede extender.
    // - Se deja en 0 por defecto para préstamos antiguos.
    const cols = await getPrestamoColumns();
    const alters = [];
    if (!cols.has('extensiones')) alters.push('ADD COLUMN extensiones INT NOT NULL DEFAULT 0');
    if (!cols.has('fecha_devolucion_real')) alters.push('ADD COLUMN fecha_devolucion_real DATE NULL');
    if (alters.length) {
      await pool.query(`ALTER TABLE prestamo ${alters.join(', ')}`);
      resetPrestamoColumnsCache();
    }
  } catch {
  }

  try {
    // Tabla carrito_item:
    // - Guarda el carrito por usuario en BD (persistente).
    // - La PK compuesta (id_usuario, id_libro) evita duplicados.
    // - El endpoint de “agregar al carrito” usa ON DUPLICATE KEY para incrementar cantidad.
    await pool.query(
      `CREATE TABLE IF NOT EXISTS carrito_item (
        id_usuario INT NOT NULL,
        id_libro INT NOT NULL,
        cantidad INT NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id_usuario, id_libro),
        FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario),
        FOREIGN KEY (id_libro) REFERENCES libro(id_libro)
      )`
    );
  } catch {
    try {
      // Fallback sin FKs:
      // - En algunas instalaciones las FKs pueden fallar por orden de creación.
      // - Se crea la tabla sin llaves foráneas para no bloquear el uso del carrito.
      await pool.query(
        `CREATE TABLE IF NOT EXISTS carrito_item (
          id_usuario INT NOT NULL,
          id_libro INT NOT NULL,
          cantidad INT NOT NULL DEFAULT 1,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id_usuario, id_libro)
        )`
      );
    } catch {
    }
  }
};

// ================================
//  Middlewares base
// ================================
// Pequeñas buenas prácticas / seguridad
app.disable('x-powered-by');
app.use(express.json({ limit: '8mb' }));

// ================================
//  Helpers de errores async
// ================================
// Helper: Express no captura errores async automáticamente, así que este wrapper evita repetir try/catch.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ================================================
//  Recuperación de contraseña (maqueta / demo)
// ================================================
// Store temporal para códigos de “¿Olvidaste tu contraseña?” (MAQUETA):
// - En una app real esto se guardaría en BD o en Redis.
// - Aquí lo guardamos en memoria porque es un proyecto de práctica.
// - Se borra cuando se usa o cuando expira.
const passwordResetStore = new Map();

// ================================================
//  Auth por header (sesión simple del frontend)
// ================================================
// La sesión del frontend se guarda en localStorage.
// Para que el backend aplique permisos, el frontend envía el id del usuario en el header:
//   x-user-id: <id_usuario>
// Esto NO reemplaza una auth real (JWT/cookies), pero permite separar roles y proteger rutas.
const getAuthUserId = (req) => {
  const raw = req.headers?.['x-user-id'];
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
};

const getDbUserById = async (id_usuario) => {
  if (!Number.isFinite(Number(id_usuario))) return null;
  const [rows] = await pool.query(
    `SELECT u.id_usuario, u.id_rol, r.nombre_rol
       FROM usuario u
       LEFT JOIN rol r ON r.id_rol = u.id_rol
      WHERE u.id_usuario = :id_usuario
      LIMIT 1`,
    { id_usuario: Number(id_usuario) }
  );
  return rows?.[0] || null;
};

// requireAuth:
// - Verifica que exista x-user-id.
// - Valida que el usuario exista en BD.
// - Adjunta req.auth con datos mínimos para permisos.
const requireAuth = asyncHandler(async (req, res, next) => {
  const id_usuario = getAuthUserId(req);
  if (!id_usuario) return res.status(401).json({ error: 'No autenticado' });

  const u = await getDbUserById(id_usuario);
  if (!u?.id_usuario) return res.status(401).json({ error: 'No autenticado' });

  req.auth = {
    id_usuario: Number(u.id_usuario),
    id_rol: u.id_rol == null ? null : Number(u.id_rol),
    nombre_rol: u.nombre_rol == null ? null : String(u.nombre_rol),
    isAdmin: Number(u.id_rol) === 1
  };

  return next();
});

// requireAdmin:
// - Reutiliza requireAuth.
// - Exige id_rol = 1.
// Nota: si requireAuth ya respondió (401), cortamos con res.headersSent.
const requireAdmin = asyncHandler(async (req, res, next) => {
  await requireAuth(req, res, () => {});
  if (res.headersSent) return;
  if (!req.auth?.isAdmin) return res.status(403).json({ error: 'Solo administradores' });
  return next();
});

// Helper de autorización:
// - Un ADMIN puede actuar sobre cualquier usuario.
// - Un USUARIO normal solo puede actuar sobre sí mismo.
const assertSelfOrAdmin = (req, res, targetUserId) => {
  const tid = Number(targetUserId);
  if (!Number.isFinite(tid)) return false;
  if (req.auth?.isAdmin) return true;
  return Number(req.auth?.id_usuario) === tid;
};

// ================================
//  Hardening de estáticos
// ================================
// Bloqueamos archivos que no deberían servirse como estáticos.
// Aunque exista el archivo en el disco, si alguien lo pide por URL, respondemos 404.
app.use((req, res, next) => {
  const reqPath = String(req.path || '');
  const lower = reqPath.toLowerCase();

  if (lower.startsWith('/node_modules')) return res.status(404).end();
  if (lower.endsWith('.sql') || lower.endsWith('.mwb')) return res.status(404).end();
  if (lower === '/.env' || lower.startsWith('/.env')) return res.status(404).end();
  if (lower === '/package-lock.json') return res.status(404).end();
  if (lower.endsWith('/server.js')) return res.status(404).end();

  return next();
});

// ================================
//  Rutas de estáticos
// ================================
// Si alguien entra a / lo mando al login del frontend.
app.get('/', (req, res) => res.redirect('/src/pages/login.html'));

// Sirvo el frontend como archivos estáticos.
// Buenas prácticas:
// - Idealmente, los archivos del frontend (HTML/CSS/JS/imagenes) viven en una carpeta /public.
// - Para no romper el proyecto existente, sirvo tanto /public (si existe) como la raíz del proyecto.
// - Así se mantiene compatible con URLs como /index.html y /src/pages/*, incluso después de mover.
const PUBLIC_ROOT = path.join(PROJECT_ROOT, 'public');
const FRONTEND_PUBLIC_ROOT = path.join(REPO_ROOT, 'frontend', 'public');
if (fsSync.existsSync(FRONTEND_PUBLIC_ROOT)) {
  app.use(express.static(FRONTEND_PUBLIC_ROOT, { dotfiles: 'deny', index: false }));
} else if (fsSync.existsSync(PUBLIC_ROOT)) {
  app.use(express.static(PUBLIC_ROOT, { dotfiles: 'deny', index: false }));
} else {
  app.use(express.static(PROJECT_ROOT, { dotfiles: 'deny', index: false }));
}

// ================================
//  API: Préstamos / devoluciones
// ================================

// Devolver préstamo:
// - Marca el préstamo como devuelto.
// - Vuelve a poner el libro en stock (disponibilidad = 1).
// - Se valida que el préstamo exista y pertenezca al usuario (porque no hay auth real).
app.post('/api/prestamos/:id/devolver', asyncHandler(async (req, res) => {
  await requireAdmin(req, res, () => {});
  if (res.headersSent) return;

  const id_prestamo = Number(req.params.id);
  const uid = Number(req.body?.id_usuario);

  if (!Number.isFinite(id_prestamo) || !Number.isFinite(uid)) {
    return res.status(400).json({ error: 'id_prestamo e id_usuario son obligatorios' });
  }

  const hasFechaReal = await ensurePrestamoFechaRealColumn();

  const conn = await pool.getConnection();
  try {
    // Transacción:
    // - Esta operación toca 2 tablas (prestamo y libro).
    // - Si algo falla, hacemos rollback para no dejar el préstamo como “Devuelto” sin devolver stock.
    await conn.beginTransaction();

    const [prestamos] = await conn.query(
      'SELECT id_libro, estado, id_usuario FROM prestamo WHERE id_prestamo = :id_prestamo LIMIT 1',
      { id_prestamo }
    );

    if (!prestamos.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Préstamo no encontrado' });
    }

    const prestamo = prestamos[0];
    if (Number(prestamo.id_usuario) !== uid) {
      await conn.rollback();
      return res.status(400).json({ error: 'id_usuario no coincide con el préstamo' });
    }

    const estado = String(prestamo.estado || '').toLowerCase();
    if (estado.includes('devuel')) {
      await conn.rollback();
      return res.status(409).json({ error: 'Este préstamo ya fue devuelto' });
    }

    if (hasFechaReal) {
      await conn.query(
        'UPDATE prestamo SET estado = :estado, fecha_devolucion_real = CURDATE() WHERE id_prestamo = :id_prestamo',
        { estado: 'Devuelto', id_prestamo }
      );
    } else {
      await conn.query(
        'UPDATE prestamo SET estado = :estado WHERE id_prestamo = :id_prestamo',
        { estado: 'Devuelto', id_prestamo }
      );
    }

    const libroCols = await getLibroColumns();
    const id_libro = Number(prestamo.id_libro);
    const canStockCompra = libroCols.has('stock_compra');

    if (libroCols.has('stock_renta')) {
      await conn.query(
        `UPDATE libro
            SET stock_renta = stock_renta + 1,
                disponibilidad = CASE
                  WHEN (${canStockCompra ? 'stock_compra' : '0'} > 0 OR stock_renta + 1 > 0) THEN 1
                  ELSE 0
                END
          WHERE id_libro = :id_libro`,
        { id_libro }
      );
    } else {
      await conn.query(
        'UPDATE libro SET disponibilidad = 1 WHERE id_libro = :id_libro',
        { id_libro }
      );
    }

    await conn.commit();

    let fecha_devolucion_real = null;
    if (hasFechaReal) {
      try {
        const [rows] = await pool.query(
          'SELECT fecha_devolucion_real FROM prestamo WHERE id_prestamo = :id_prestamo LIMIT 1',
          { id_prestamo }
        );
        if (rows.length) fecha_devolucion_real = rows[0]?.fecha_devolucion_real ?? null;
      } catch {
      }
    }

    res.json({ ok: true, fecha_devolucion_real, has_fecha_devolucion_real: hasFechaReal });
  } catch (e) {
    try {
      await conn.rollback();
    } catch {
    }
    throw e;
  } finally {
    conn.release();
  }
}));

// Compras (listar):
// - Se usa para mostrar en el perfil los libros comprados.
// - Solo devuelve compras del usuario (o admin).
app.get('/api/compras', asyncHandler(async (req, res) => {
  await requireAuth(req, res, () => {});
  if (res.headersSent) return;

  const uid = Number(req.query.id_usuario);
  if (!Number.isFinite(uid)) {
    return res.status(400).json({ error: 'id_usuario es obligatorio' });
  }

  if (!assertSelfOrAdmin(req, res, uid)) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const [rows] = await pool.query(
    `SELECT c.id_compra, c.fecha_compra, c.precio,
            l.id_libro, l.titulo, l.autor
       FROM compra c
       LEFT JOIN libro l ON l.id_libro = c.id_libro
      WHERE c.id_usuario = :id_usuario
      ORDER BY c.id_compra DESC`,
    { id_usuario: uid }
  );

  res.json(rows);
}));

// ================================
//  API: Carrito
// ================================
// Carrito (listar):
app.get('/api/carrito', asyncHandler(async (req, res) => {
  await requireAuth(req, res, () => {});
  if (res.headersSent) return;

  const uid = Number(req.query.id_usuario);
  if (!Number.isFinite(uid)) {
    return res.status(400).json({ error: 'id_usuario es obligatorio' });
  }

  if (!assertSelfOrAdmin(req, res, uid)) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const libroCols = await getLibroColumns();
  const selectValor = libroCols.has('valor') ? ', l.valor' : '';
  const selectStockCompra = libroCols.has('stock_compra') ? ', l.stock_compra' : '';

  const [rows] = await pool.query(
    `SELECT ci.id_libro, ci.cantidad,
            l.titulo, l.autor${selectValor}${selectStockCompra}
       FROM carrito_item ci
       LEFT JOIN libro l ON l.id_libro = ci.id_libro
      WHERE ci.id_usuario = :id_usuario
      ORDER BY ci.created_at DESC`,
    { id_usuario: uid }
  );

  res.json(rows);
}));

// Carrito (agregar/incrementar):
app.post('/api/carrito', asyncHandler(async (req, res) => {
  await requireAuth(req, res, () => {});
  if (res.headersSent) return;

  const uid = Number(req.body?.id_usuario);
  const lid = Number(req.body?.id_libro);
  const qtyRaw = req.body?.cantidad == null ? 1 : Number(req.body.cantidad);
  const qty = Number.isFinite(qtyRaw) ? Math.trunc(qtyRaw) : NaN;

  if (!Number.isFinite(uid) || !Number.isFinite(lid) || !Number.isFinite(qty) || qty <= 0) {
    return res.status(400).json({ error: 'id_usuario, id_libro y cantidad son obligatorios' });
  }

  if (!assertSelfOrAdmin(req, res, uid)) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const libroCols = await getLibroColumns();
  const canStockCompra = libroCols.has('stock_compra');
  const canStockLegacy = libroCols.has('stock');

  if (!canStockCompra && !canStockLegacy) {
    await pool.query(
      `INSERT INTO carrito_item (id_usuario, id_libro, cantidad)
       VALUES (:id_usuario, :id_libro, :cantidad)
       ON DUPLICATE KEY UPDATE cantidad = cantidad + VALUES(cantidad)`,
      { id_usuario: uid, id_libro: lid, cantidad: qty }
    );
    return res.json({ ok: true });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const selectParts = [];
    if (canStockCompra) selectParts.push('stock_compra');
    if (canStockLegacy) selectParts.push('stock');

    const [libRows] = await conn.query(
      `SELECT ${selectParts.join(', ')} FROM libro WHERE id_libro = :id_libro LIMIT 1 FOR UPDATE`,
      { id_libro: lid }
    );
    if (!libRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Libro no encontrado' });
    }

    const lib = libRows[0] || {};
    const stockCompra = canStockCompra ? Number(lib.stock_compra) : Number(lib.stock);
    if (!Number.isFinite(stockCompra) || stockCompra <= 0) {
      await conn.rollback();
      return res.status(409).json({ error: 'Libro no disponible para compra' });
    }

    const [cartRows] = await conn.query(
      'SELECT cantidad FROM carrito_item WHERE id_usuario = :id_usuario AND id_libro = :id_libro LIMIT 1 FOR UPDATE',
      { id_usuario: uid, id_libro: lid }
    );
    const currentQty = cartRows.length ? Number(cartRows[0]?.cantidad) : 0;
    const safeCurrent = Number.isFinite(currentQty) && currentQty > 0 ? Math.trunc(currentQty) : 0;
    const nextTotal = safeCurrent + qty;

    if (nextTotal > stockCompra) {
      await conn.rollback();
      return res.status(409).json({
        error: `No hay stock suficiente. En tu carrito tienes ${safeCurrent} y el stock disponible es ${stockCompra}.`
      });
    }

    await conn.query(
      `INSERT INTO carrito_item (id_usuario, id_libro, cantidad)
       VALUES (:id_usuario, :id_libro, :cantidad)
       ON DUPLICATE KEY UPDATE cantidad = :cantidad`,
      { id_usuario: uid, id_libro: lid, cantidad: nextTotal }
    );

    await conn.commit();
    return res.json({ ok: true });
  } catch (e) {
    try {
      await conn.rollback();
    } catch {
    }
    throw e;
  } finally {
    conn.release();
  }
}));

// Carrito (eliminar item):
app.delete('/api/carrito/:id_libro', asyncHandler(async (req, res) => {
  await requireAuth(req, res, () => {});
  if (res.headersSent) return;

  const uid = Number(req.query.id_usuario);
  const lid = Number(req.params.id_libro);
  if (!Number.isFinite(uid) || !Number.isFinite(lid)) {
    return res.status(400).json({ error: 'id_usuario e id_libro son obligatorios' });
  }

  if (!assertSelfOrAdmin(req, res, uid)) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  await pool.query(
    'DELETE FROM carrito_item WHERE id_usuario = :id_usuario AND id_libro = :id_libro',
    { id_usuario: uid, id_libro: lid }
  );

  res.json({ ok: true });
}));

// Carrito (checkout):
// - Crea compras para todos los items del carrito.
// - Descuenta stock_compra.
// - Si falta stock en alguno, falla completo.
app.post('/api/carrito/checkout', asyncHandler(async (req, res) => {
  await requireAuth(req, res, () => {});
  if (res.headersSent) return;

  const uid = Number(req.body?.id_usuario);
  if (!Number.isFinite(uid)) {
    return res.status(400).json({ error: 'id_usuario es obligatorio' });
  }

  if (!assertSelfOrAdmin(req, res, uid)) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const libroCols = await getLibroColumns();
  if (!libroCols.has('stock_compra')) {
    return res.status(400).json({ error: 'El sistema no soporta stock de compra en esta BD' });
  }

  const conn = await pool.getConnection();
  try {
    // Transacción (checkout):
    // - El checkout debe ser atómico: o se compran TODOS los items o no se compra ninguno.
    // - Si falta stock en algún libro, se hace rollback y el carrito queda intacto.
    // - Se usa FOR UPDATE al leer el libro para evitar que dos compras descuenten el mismo stock.
    await conn.beginTransaction();

    const [items] = await conn.query(
      'SELECT id_libro, cantidad FROM carrito_item WHERE id_usuario = :id_usuario',
      { id_usuario: uid }
    );

    if (!items.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'El carrito está vacío' });
    }

    for (const it of items) {
      const lid = Number(it.id_libro);
      const qty = Number(it.cantidad);
      if (!Number.isFinite(lid) || !Number.isFinite(qty) || qty <= 0) {
        await conn.rollback();
        return res.status(400).json({ error: 'Carrito inválido' });
      }

      const [libRows] = await conn.query(
        'SELECT stock_compra, stock_renta, valor FROM libro WHERE id_libro = :id_libro LIMIT 1 FOR UPDATE',
        { id_libro: lid }
      );
      if (!libRows.length) {
        await conn.rollback();
        return res.status(404).json({ error: 'Libro no encontrado' });
      }

      const stockCompra = Number(libRows[0].stock_compra);
      if (!Number.isFinite(stockCompra) || stockCompra < qty) {
        await conn.rollback();
        return res.status(409).json({ error: 'Stock insuficiente para completar la compra' });
      }

      const price = Number(libRows[0].valor);
      if (!Number.isFinite(price)) {
        await conn.rollback();
        return res.status(400).json({ error: 'Precio inválido' });
      }

      for (let i = 0; i < qty; i += 1) {
        await conn.query(
          'INSERT INTO compra (fecha_compra, precio, id_usuario, id_libro) VALUES (CURDATE(), :precio, :id_usuario, :id_libro)',
          { precio: price, id_usuario: uid, id_libro: lid }
        );
      }

      await conn.query(
        `UPDATE libro
            SET stock_compra = stock_compra - :qty,
                disponibilidad = CASE
                  WHEN (stock_compra - :qty > 0 OR stock_renta > 0) THEN 1
                  ELSE 0
                END
          WHERE id_libro = :id_libro`,
        { qty, id_libro: lid }
      );
    }

    await conn.query('DELETE FROM carrito_item WHERE id_usuario = :id_usuario', { id_usuario: uid });

    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    try {
      await conn.rollback();
    } catch {
    }
    throw e;
  } finally {
    conn.release();
  }
}));

// Extender préstamo (usuario):
// - Solo el dueño del préstamo (o admin) puede extender.
// - Máximo 2 extensiones para usuarios.
// - Cada extensión suma 5 días.
app.post('/api/prestamos/:id/extender', asyncHandler(async (req, res) => {
  await requireAuth(req, res, () => {});
  if (res.headersSent) return;

  const id_prestamo = Number(req.params.id);
  const uid = Number(req.body?.id_usuario);
  if (!Number.isFinite(id_prestamo) || !Number.isFinite(uid)) {
    return res.status(400).json({ error: 'id_prestamo e id_usuario son obligatorios' });
  }

  if (!assertSelfOrAdmin(req, res, uid)) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT id_usuario, estado, extensiones FROM prestamo WHERE id_prestamo = :id_prestamo LIMIT 1 FOR UPDATE',
      { id_prestamo }
    );
    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Préstamo no encontrado' });
    }

    const p = rows[0] || {};
    if (Number(p.id_usuario) !== uid && !req.auth?.isAdmin) {
      await conn.rollback();
      return res.status(403).json({ error: 'No autorizado' });
    }

    const estado = String(p.estado || '').toLowerCase();
    if (!estado.includes('activo')) {
      await conn.rollback();
      return res.status(409).json({ error: 'Solo se pueden extender préstamos activos' });
    }

    const ext = Number(p.extensiones) || 0;
    if (ext >= 2 && !req.auth?.isAdmin) {
      await conn.rollback();
      return res.status(409).json({ error: 'Límite de extensiones alcanzado' });
    }

    await conn.query(
      'UPDATE prestamo SET fecha_devolucion = DATE_ADD(fecha_devolucion, INTERVAL 5 DAY), extensiones = extensiones + 1 WHERE id_prestamo = :id_prestamo',
      { id_prestamo }
    );

    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    try {
      await conn.rollback();
    } catch {
    }
    throw e;
  } finally {
    conn.release();
  }
}));

// ================================
//  API: Utilidades
// ================================
// Healthcheck:
// - Se usa para confirmar que Express está arriba.
// - También valida conectividad a MySQL con un SELECT simple.
app.get('/api/health', asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT 1 AS ok');
  res.json({ ok: true, db: rows?.[0]?.ok === 1 });
}));

// ================================
//  API: Portadas (covers)
// ================================
// Covers:
// - El frontend necesita saber qué imágenes existen en src/assets/images.
// - En vez de “adivinar” filenames, este endpoint lista los archivos disponibles.
// - Con eso, el frontend puede hacer match por título y si no hay imagen usar fallback (SVG).
app.get('/api/covers', asyncHandler(async (req, res) => {
  // Compatibilidad con dos estructuras:
  // - Actual:   /src/assets/images
  // - Recomendada: /public/src/assets/images
  const candidates = [
    path.join(REPO_ROOT, 'frontend', 'public', 'src', 'assets', 'images'),
    path.join(PROJECT_ROOT, 'public', 'src', 'assets', 'images'),
    path.join(PROJECT_ROOT, 'src', 'assets', 'images')
  ];

  const allowed = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

  for (const dir of candidates) {
    try {
      const files = await fs.readdir(dir);
      const out = (files || [])
        .filter((f) => allowed.has(path.extname(f).toLowerCase()))
        .sort();
      return res.json(out);
    } catch {
      // Sigo intentando con el siguiente candidato.
    }
  }

  res.json([]);
}));

app.post('/api/admin/covers', requireAdmin, asyncHandler(async (req, res) => {
  const { title, dataUrl } = req.body || {};
  const rawTitle = String(title || '').trim();
  const rawDataUrl = String(dataUrl || '').trim();
  if (!rawTitle) return res.status(400).json({ error: 'title es obligatorio' });
  if (!rawDataUrl) return res.status(400).json({ error: 'dataUrl es obligatorio' });

  const m = rawDataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
  if (!m) return res.status(400).json({ error: 'dataUrl inválido' });

  const mime = String(m[1] || '').toLowerCase();
  const b64 = String(m[2] || '');

  const extByMime = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif'
  };

  const ext = extByMime[mime];
  if (!ext) return res.status(400).json({ error: 'Tipo de imagen no soportado' });

  let buf;
  try {
    buf = Buffer.from(b64, 'base64');
  } catch {
    return res.status(400).json({ error: 'Base64 inválido' });
  }

  if (!buf || buf.length === 0) return res.status(400).json({ error: 'Imagen vacía' });
  if (buf.length > 6 * 1024 * 1024) return res.status(413).json({ error: 'Imagen demasiado grande' });

  const slug = rawTitle
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s/g, '-');

  const safeBase = slug || crypto.randomBytes(8).toString('hex');
  const fileName = `${safeBase}.${ext}`;

  const dir = path.join(REPO_ROOT, 'frontend', 'public', 'src', 'assets', 'images');
  await fs.mkdir(dir, { recursive: true });

  try {
    const files = await fs.readdir(dir);
    const allowed = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
    await Promise.all(
      (files || [])
        .filter((f) => {
          const base = String(f || '').replace(/\.[^/.]+$/, '');
          const extname = path.extname(String(f || '')).toLowerCase();
          return base === safeBase && allowed.has(extname) && f !== fileName;
        })
        .map((f) => fs.unlink(path.join(dir, f)).catch(() => null))
    );
  } catch {
  }

  await fs.writeFile(path.join(dir, fileName), buf);
  res.status(201).json({ file: fileName });
}));

// ================================
//  API: Libros (catálogo)
// ================================
// Lista libros.
// - Si mandan ?disponible=true, solo traemos los disponibles.
// - Se hace LEFT JOIN con categoria para poder mostrar nombre_categoria en el frontend.
app.get('/api/libros', asyncHandler(async (req, res) => {
  const disponible = typeof req.query.disponible === 'string' ? req.query.disponible : undefined;
  const onlyDisponible = disponible === '1' || disponible === 'true';

  const where = onlyDisponible ? 'WHERE l.disponibilidad = 1' : '';

  const libroCols = await getLibroColumns();
  const selectStock = libroCols.has('stock') ? ', l.stock' : '';
  const selectValor = libroCols.has('valor') ? ', l.valor' : '';
  const selectStockCompra = libroCols.has('stock_compra') ? ', l.stock_compra' : '';
  const selectStockRenta = libroCols.has('stock_renta') ? ', l.stock_renta' : '';

  const [rows] = await pool.query(
    `SELECT l.id_libro, l.titulo, l.autor, l.descripcion, l.disponibilidad${selectStock}${selectValor}${selectStockCompra}${selectStockRenta}, l.id_categoria,
            c.nombre_categoria
       FROM libro l
       LEFT JOIN categoria c ON c.id_categoria = l.id_categoria
       ${where}
       ORDER BY l.id_libro DESC`
  );

  res.json(rows);
}));

// ================================
//  API: Administración (solo ADMIN)
// ================================
// Categorías:
// - Se usa en el formulario de Admin para mostrar opciones.
app.get('/api/admin/categorias', requireAdmin, asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT id_categoria, nombre_categoria FROM categoria ORDER BY nombre_categoria ASC');
  res.json(rows);
}));

// Libros (admin):
// - Lista completa para administración (sin filtro de disponibilidad).
app.get('/api/admin/libros', requireAdmin, asyncHandler(async (req, res) => {
  const libroCols = await getLibroColumns();
  const selectStock = libroCols.has('stock') ? ', l.stock' : '';
  const selectValor = libroCols.has('valor') ? ', l.valor' : '';
  const selectStockCompra = libroCols.has('stock_compra') ? ', l.stock_compra' : '';
  const selectStockRenta = libroCols.has('stock_renta') ? ', l.stock_renta' : '';

  const [rows] = await pool.query(
    `SELECT l.id_libro, l.titulo, l.autor, l.descripcion, l.disponibilidad${selectStock}${selectValor}${selectStockCompra}${selectStockRenta}, l.id_categoria,
            c.nombre_categoria
       FROM libro l
       LEFT JOIN categoria c ON c.id_categoria = l.id_categoria
      ORDER BY l.id_libro DESC`
  );
  res.json(rows);
}));

// Crear libro (admin):
// - Se valida título y autor.
// - Se respeta compatibilidad con la columna stock (si existe).
app.post('/api/admin/libros', requireAdmin, asyncHandler(async (req, res) => {
  const { titulo, autor, descripcion, stock, stock_compra, stock_renta, valor, disponibilidad, id_categoria } = req.body || {};
  if (!titulo || !autor) return res.status(400).json({ error: 'titulo y autor son obligatorios' });

  const libroCols = await getLibroColumns();
  const fields = ['titulo', 'autor', 'descripcion', 'disponibilidad', 'id_categoria'];
  const values = {
    titulo: String(titulo),
    autor: String(autor),
    descripcion: descripcion == null ? null : String(descripcion),
    disponibilidad: Number(disponibilidad) === 1 ? 1 : 0,
    id_categoria: id_categoria == null || id_categoria === '' ? null : Number(id_categoria)
  };

  if (libroCols.has('stock')) {
    fields.splice(3, 0, 'stock');
    values.stock = Number(stock) || 0;
  }

  if (libroCols.has('stock_compra')) {
    fields.splice(3, 0, 'stock_compra');
    values.stock_compra = Number(stock_compra ?? stock) || 0;
  }

  if (libroCols.has('stock_renta')) {
    fields.splice(3, 0, 'stock_renta');
    values.stock_renta = Number(stock_renta ?? stock) || 0;
  }

  if (libroCols.has('stock_compra') && libroCols.has('stock_renta')) {
    values.disponibilidad = values.stock_compra > 0 || values.stock_renta > 0 ? 1 : 0;
  }

  if (libroCols.has('valor') && valor !== undefined) {
    fields.splice(3, 0, 'valor');
    values.valor = Number(valor) || 0;
  }

  const cols = fields.map((f) => `\`${f}\``).join(', ');
  const params = fields.map((f) => `:${f}`).join(', ');

  const [result] = await pool.query(`INSERT INTO libro (${cols}) VALUES (${params})`, values);
  res.status(201).json({ id_libro: result.insertId });
}));

// Editar libro (admin):
// - PATCH permite actualizar parcialmente.
// - Si no se manda ningún campo, se responde "Sin cambios".
app.patch('/api/admin/libros/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' });

  const { titulo, autor, descripcion, stock, stock_compra, stock_renta, valor, disponibilidad, id_categoria } = req.body || {};
  const libroCols = await getLibroColumns();

  const updates = [];
  const values = { id };

  if (titulo != null) {
    updates.push('titulo = :titulo');
    values.titulo = String(titulo);
  }
  if (autor != null) {
    updates.push('autor = :autor');
    values.autor = String(autor);
  }
  if (descripcion != null) {
    updates.push('descripcion = :descripcion');
    values.descripcion = String(descripcion);
  }
  if (disponibilidad != null) {
    updates.push('disponibilidad = :disponibilidad');
    values.disponibilidad = Number(disponibilidad) === 1 ? 1 : 0;
  }
  if (id_categoria !== undefined) {
    updates.push('id_categoria = :id_categoria');
    values.id_categoria = id_categoria == null || id_categoria === '' ? null : Number(id_categoria);
  }
  if (libroCols.has('stock') && stock !== undefined) {
    updates.push('stock = :stock');
    values.stock = Number(stock) || 0;
  }

  if (libroCols.has('stock_compra') && stock_compra !== undefined) {
    updates.push('stock_compra = :stock_compra');
    values.stock_compra = Number(stock_compra) || 0;
  }

  if (libroCols.has('stock_renta') && stock_renta !== undefined) {
    updates.push('stock_renta = :stock_renta');
    values.stock_renta = Number(stock_renta) || 0;
  }

  if (libroCols.has('valor') && valor !== undefined) {
    updates.push('valor = :valor');
    values.valor = Number(valor) || 0;
  }

  if (!updates.length) return res.status(400).json({ error: 'Sin cambios' });

  const [result] = await pool.query(
    `UPDATE libro SET ${updates.join(', ')} WHERE id_libro = :id`,
    values
  );

  if (!result?.affectedRows) return res.status(404).json({ error: 'Libro no encontrado' });

  if (libroCols.has('stock_compra') && libroCols.has('stock_renta')) {
    await pool.query(
      'UPDATE libro SET disponibilidad = CASE WHEN (stock_compra > 0 OR stock_renta > 0) THEN 1 ELSE 0 END WHERE id_libro = :id',
      { id }
    );
  }

  res.json({ ok: true });
}));

app.delete('/api/admin/libros/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' });

  const [hasActiveLoans] = await pool.query(
    "SELECT 1 FROM prestamo WHERE id_libro = :id AND (estado IS NULL OR LOWER(estado) NOT LIKE '%devuel%') LIMIT 1",
    { id }
  );
  if (hasActiveLoans.length) {
    return res.status(409).json({
      error: 'No podemos eliminar este libro todavía: tiene préstamos pendientes de devolución. Registra la devolución y vuelve a intentarlo.'
    });
  }

  const [hasBuys] = await pool.query('SELECT 1 FROM compra WHERE id_libro = :id LIMIT 1', { id });
  if (hasBuys.length) return res.status(409).json({ error: 'No se puede eliminar: el libro tiene compras' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    try {
      await conn.query('DELETE FROM carrito_item WHERE id_libro = :id', { id });
    } catch {
    }

    try {
      await conn.query(
        "DELETE FROM prestamo WHERE id_libro = :id AND estado IS NOT NULL AND LOWER(estado) LIKE '%devuel%'",
        { id }
      );
    } catch {
    }

    const [result] = await conn.query('DELETE FROM libro WHERE id_libro = :id', { id });
    if (!result?.affectedRows) {
      await conn.rollback();
      return res.status(404).json({ error: 'Libro no encontrado' });
    }

    await conn.commit();
  } catch (e) {
    try {
      await conn.rollback();
    } catch {
    }

    const code = String(e?.code || '');
    if (code.includes('ER_ROW_IS_REFERENCED')) {
      return res.status(409).json({ error: 'No se puede eliminar: el libro tiene movimientos asociados' });
    }
    throw e;
  } finally {
    conn.release();
  }

  res.json({ ok: true });
}));

// Usuarios (admin):
// - Se listan con su rol (JOIN a la tabla rol).
app.get('/api/admin/usuarios', requireAdmin, asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT u.id_usuario, u.nombre, u.correo, u.id_rol, r.nombre_rol
       FROM usuario u
       LEFT JOIN rol r ON r.id_rol = u.id_rol
      ORDER BY u.id_usuario DESC`
  );
  res.json(rows);
}));

app.post('/api/admin/usuarios', requireAdmin, asyncHandler(async (req, res) => {
  const { nombre, correo, password, id_rol } = req.body || {};

  const email = String(correo || '').trim().toLowerCase();
  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'nombre, correo y password son obligatorios' });
  }

  const roleId = id_rol == null ? 2 : Number(id_rol);
  const rid = Number.isFinite(roleId) ? roleId : 2;

  const [roles] = await pool.query('SELECT 1 FROM rol WHERE id_rol = :id_rol LIMIT 1', { id_rol: rid });
  if (!roles.length) return res.status(400).json({ error: 'Rol inválido' });

  const [exists] = await pool.query('SELECT 1 FROM usuario WHERE LOWER(TRIM(correo)) = :correo LIMIT 1', { correo: email });
  if (exists.length) return res.status(409).json({ error: 'El correo ya está registrado' });

  const hash = await bcrypt.hash(String(password), 10);
  const [result] = await pool.query(
    'INSERT INTO usuario (nombre, correo, `contraseña`, id_rol) VALUES (:nombre, :correo, :hash, :id_rol)',
    {
      nombre: String(nombre),
      correo: email,
      hash,
      id_rol: rid
    }
  );

  res.status(201).json({
    id_usuario: result.insertId,
    nombre: String(nombre),
    correo: email,
    id_rol: rid
  });
}));

app.patch('/api/admin/usuarios/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' });

  const { nombre, correo, password } = req.body || {};

  const updates = [];
  const values = { id };

  if (nombre !== undefined) {
    const nextName = String(nombre || '').trim();
    if (!nextName) return res.status(400).json({ error: 'nombre es obligatorio' });
    updates.push('nombre = :nombre');
    values.nombre = nextName;
  }

  if (correo !== undefined) {
    const email = String(correo || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'correo es obligatorio' });
    const [exists] = await pool.query(
      'SELECT 1 FROM usuario WHERE LOWER(TRIM(correo)) = :correo AND id_usuario <> :id LIMIT 1',
      { correo: email, id }
    );
    if (exists.length) return res.status(409).json({ error: 'El correo ya está registrado' });
    updates.push('correo = :correo');
    values.correo = email;
  }

  if (password !== undefined && String(password) !== '') {
    const hash = await bcrypt.hash(String(password), 10);
    updates.push('`contraseña` = :hash');
    values.hash = hash;
  }

  if (!updates.length) return res.status(400).json({ error: 'Sin cambios' });

  const [result] = await pool.query(
    `UPDATE usuario SET ${updates.join(', ')} WHERE id_usuario = :id`,
    values
  );

  if (!result?.affectedRows) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ ok: true });
}));

// Cambiar rol de usuario (admin):
// - Valida que el rol exista.
// - Regla: un administrador no puede cambiar su propio rol a USUARIO.
app.patch('/api/admin/usuarios/:id/rol', requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const rid = Number(req.body?.id_rol);
  if (!Number.isFinite(id) || !Number.isFinite(rid)) return res.status(400).json({ error: 'id e id_rol son obligatorios' });

  if (Number(req.auth?.id_usuario) === id && rid !== 1) {
    return res.status(403).json({ error: 'No puedes cambiar tu propio rol a usuario. Otro administrador debe hacerlo.' });
  }

  const [roles] = await pool.query('SELECT 1 FROM rol WHERE id_rol = :id_rol LIMIT 1', { id_rol: rid });
  if (!roles.length) return res.status(400).json({ error: 'Rol inválido' });

  const [result] = await pool.query('UPDATE usuario SET id_rol = :id_rol WHERE id_usuario = :id', { id_rol: rid, id });
  if (!result?.affectedRows) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ ok: true });
}));

app.delete('/api/admin/usuarios/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' });

  if (Number(req.auth?.id_usuario) === id) {
    return res.status(403).json({ error: 'Solo otro administrador puede eliminarte' });
  }

  const [hasActiveLoans] = await pool.query(
    "SELECT 1 FROM prestamo WHERE id_usuario = :id AND (estado IS NULL OR LOWER(estado) NOT LIKE '%devuel%') LIMIT 1",
    { id }
  );
  if (hasActiveLoans.length) {
    return res.status(409).json({
      error: 'No podemos eliminar este usuario todavía: tiene préstamos pendientes de devolución. Registra la devolución y vuelve a intentarlo.'
    });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    try {
      await conn.query('DELETE FROM carrito_item WHERE id_usuario = :id', { id });
    } catch {
    }

    try {
      await conn.query('DELETE FROM compra WHERE id_usuario = :id', { id });
    } catch {
    }

    // El usuario puede tener historial de préstamos devueltos.
    // Como existe FK prestamo.id_usuario -> usuario, debemos limpiarlos antes de borrar el usuario.
    try {
      await conn.query(
        "DELETE FROM prestamo WHERE id_usuario = :id AND estado IS NOT NULL AND LOWER(estado) LIKE '%devuel%'",
        { id }
      );
    } catch {
    }

    const [result] = await conn.query('DELETE FROM usuario WHERE id_usuario = :id', { id });
    if (!result?.affectedRows) {
      await conn.rollback();
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    await conn.commit();
  } catch (e) {
    try {
      await conn.rollback();
    } catch {
    }

    const code = String(e?.code || '');
    if (code.includes('ER_ROW_IS_REFERENCED')) {
      return res.status(409).json({ error: 'No se puede eliminar: el usuario tiene movimientos asociados' });
    }
    throw e;
  } finally {
    conn.release();
  }

  res.json({ ok: true });
}));

// Préstamos (admin):
// - Vista global para seguimiento.
app.get('/api/admin/prestamos', requireAdmin, asyncHandler(async (req, res) => {
  const qRaw = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
  const hasQ = qRaw.length > 0;
  const where = hasQ ? 'WHERE (LOWER(u.nombre) LIKE :q OR LOWER(u.correo) LIKE :q)' : '';
  const params = hasQ ? { q: `%${qRaw}%` } : {};

  const hasFechaReal = await ensurePrestamoFechaRealColumn();
  const prestamoCols = await getPrestamoColumns();
  const selectFechaReal = hasFechaReal && prestamoCols.has('fecha_devolucion_real') ? ', p.fecha_devolucion_real' : '';

  const [rows] = await pool.query(
    `SELECT p.id_prestamo, p.fecha_prestamo, p.fecha_devolucion${selectFechaReal}, p.estado, p.extensiones,
            u.id_usuario, u.nombre, u.correo,
            l.id_libro, l.titulo, l.autor
       FROM prestamo p
       LEFT JOIN usuario u ON u.id_usuario = p.id_usuario
       LEFT JOIN libro l ON l.id_libro = p.id_libro
       ${where}
      ORDER BY p.id_prestamo DESC`,
    params
  );
  res.json(rows);
}));

// ================================
//  API: Libros (detalle e historial)
// ================================
// Detalle de un libro por id
app.get('/api/libros/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' });

  const libroCols = await getLibroColumns();
  const selectStock = libroCols.has('stock') ? ', l.stock' : '';
  const selectValor = libroCols.has('valor') ? ', l.valor' : '';
  const selectStockCompra = libroCols.has('stock_compra') ? ', l.stock_compra' : '';
  const selectStockRenta = libroCols.has('stock_renta') ? ', l.stock_renta' : '';

  const [rows] = await pool.query(
    `SELECT l.id_libro, l.titulo, l.autor, l.descripcion, l.disponibilidad${selectStock}${selectValor}${selectStockCompra}${selectStockRenta}, l.id_categoria,
            c.nombre_categoria
       FROM libro l
       LEFT JOIN categoria c ON c.id_categoria = l.id_categoria
      WHERE l.id_libro = :id
      LIMIT 1`,
    { id }
  );

  if (!rows.length) return res.status(404).json({ error: 'Libro no encontrado' });
  res.json(rows[0]);
}));

// Historial de préstamos por libro:
// - Esto se usa en el modal de “Ver detalles” para mostrar quién ha rentado el libro.
// - No hay auth real, así que solo devolvemos un listado general.
// - Lo ordeno por el préstamo más reciente primero.
app.get('/api/libros/:id/historial', asyncHandler(async (req, res) => {
  await requireAdmin(req, res, () => {});
  if (res.headersSent) return;

  const id_libro = Number(req.params.id);
  if (!Number.isFinite(id_libro)) return res.status(400).json({ error: 'id inválido' });

  const hasFechaReal = await ensurePrestamoFechaRealColumn();
  const prestamoCols = await getPrestamoColumns();
  const selectFechaReal = hasFechaReal && prestamoCols.has('fecha_devolucion_real') ? ', p.fecha_devolucion_real' : '';

  const [rows] = await pool.query(
    `SELECT p.id_prestamo, p.fecha_prestamo, p.fecha_devolucion${selectFechaReal}, p.estado,
            u.id_usuario, u.nombre, u.correo
       FROM prestamo p
       INNER JOIN usuario u ON u.id_usuario = p.id_usuario
      WHERE p.id_libro = :id_libro
      ORDER BY p.id_prestamo DESC`,
    { id_libro }
  );

  res.json(rows);
}));

// ================================
//  API: Autenticación
// ================================
// Registro:
// - Guardamos contraseña hasheada (bcrypt).
// - Normalizamos el correo (trim + lower) para evitar errores por espacios/mayúsculas.
// Ojo: la columna se llama `contraseña` (con ñ), por eso va con backticks.
app.post('/api/register', asyncHandler(async (req, res) => {
  const { nombre, correo, password, id_rol } = req.body || {};

  const email = String(correo || '').trim().toLowerCase();

  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'nombre, correo y password son obligatorios' });
  }

  const hash = await bcrypt.hash(String(password), 10);

  const roleId = id_rol == null ? 2 : Number(id_rol);

  const [result] = await pool.query(
    'INSERT INTO usuario (nombre, correo, `contraseña`, id_rol) VALUES (:nombre, :correo, :hash, :id_rol)',
    {
      nombre: String(nombre),
      correo: email,
      hash,
      id_rol: Number.isFinite(roleId) ? roleId : 2
    }
  );

  res.status(201).json({ id_usuario: result.insertId, nombre, correo: email, id_rol: Number.isFinite(roleId) ? roleId : 2 });
}));

// Login:
// - Buscamos por correo normalizado.
// - Comparamos el password con bcrypt.
// - Si todo está bien devolvemos un usuario “seguro” (sin contraseña).
app.post('/api/login', asyncHandler(async (req, res) => {
  const { correo, password } = req.body || {};

  const email = String(correo || '').trim().toLowerCase();

  if (!email || !password) {
    return res.status(400).json({ error: 'correo y password son obligatorios' });
  }

  const [rows] = await pool.query(
    'SELECT id_usuario, nombre, correo, id_rol, `contraseña` AS password_hash FROM usuario WHERE LOWER(TRIM(correo)) = :correo LIMIT 1',
    { correo: email }
  );

  if (!rows.length) return res.status(401).json({ error: 'Credenciales inválidas' });

  const user = rows[0];
  const ok = await bcrypt.compare(String(password), String(user.password_hash));
  if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

  res.json({
    id_usuario: user.id_usuario,
    nombre: user.nombre,
    correo: user.correo,
    id_rol: user.id_rol
  });
}));

// ==========================================
//  Servicio simple: Registro / Login (tarea)
// ==========================================
// Nota de diseño:
// - El proyecto ya tiene /api/register y /api/login (usados por el frontend).
// - Para cumplir el enunciado (recibir "usuario" + "contraseña"), se agregan
//   rutas paralelas /api/auth/* sin afectar lo existente.
//
// Convención de este servicio:
// - "usuario" se interpreta como correo (email) porque la BD usa usuario.correo.
// - La contraseña se guarda como hash bcrypt (seguridad básica).
// - En login, si autentica, devolvemos un mensaje "Autenticación satisfactoria".
// - Si no autentica, devolvemos error "Error en la autenticación".

// Registro (servicio simple):
// Body esperado:
// { "usuario": "correo@dominio.com", "password": "1234", "nombre": "opcional" }
app.post('/api/auth/register', asyncHandler(async (req, res) => {
  const { usuario, password, nombre } = req.body || {};

  // Normalizamos el usuario (correo) para evitar duplicados por mayúsculas o espacios.
  const email = String(usuario || '').trim().toLowerCase();

  // Validación mínima: el enunciado pide usuario + contraseña.
  if (!email || !password) {
    return res.status(400).json({ ok: false, error: 'usuario y password son obligatorios' });
  }

  // Si no nos mandan nombre, generamos uno simple para poder insertar en la BD.
  // (La tabla usuario requiere nombre.)
  const displayName = String(nombre || '').trim() || email.split('@')[0] || 'Usuario';

  // Verificamos si el usuario ya existe.
  const [exists] = await pool.query(
    'SELECT 1 FROM usuario WHERE LOWER(TRIM(correo)) = :correo LIMIT 1',
    { correo: email }
  );
  if (exists.length) {
    return res.status(409).json({ ok: false, error: 'El usuario ya existe' });
  }

  // Hash de contraseña: nunca se guarda el texto plano.
  const hash = await bcrypt.hash(String(password), 10);

  // Por defecto registramos como rol USUARIO (id_rol = 2).
  const [result] = await pool.query(
    'INSERT INTO usuario (nombre, correo, `contraseña`, id_rol) VALUES (:nombre, :correo, :hash, 2)',
    { nombre: displayName, correo: email, hash }
  );

  res.status(201).json({
    ok: true,
    message: 'Registro satisfactorio',
    id_usuario: result.insertId,
    usuario: email
  });
}));

// Login (servicio simple):
// Body esperado:
// { "usuario": "correo@dominio.com", "password": "1234" }
app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const { usuario, password } = req.body || {};
  const email = String(usuario || '').trim().toLowerCase();

  if (!email || !password) {
    return res.status(400).json({ ok: false, error: 'usuario y password son obligatorios' });
  }

  // Buscamos el hash y comparamos con bcrypt.
  // Si el usuario no existe o el hash no coincide, la respuesta es la misma.
  const [rows] = await pool.query(
    'SELECT id_usuario, nombre, correo, id_rol, `contraseña` AS password_hash FROM usuario WHERE LOWER(TRIM(correo)) = :correo LIMIT 1',
    { correo: email }
  );

  if (!rows.length) {
    return res.status(401).json({ ok: false, error: 'Error en la autenticación' });
  }

  const user = rows[0];
  const ok = await bcrypt.compare(String(password), String(user.password_hash || ''));
  if (!ok) {
    return res.status(401).json({ ok: false, error: 'Error en la autenticación' });
  }

  // Autenticación exitosa: devolvemos mensaje + datos básicos.
  res.json({
    ok: true,
    message: 'Autenticación satisfactoria',
    user: {
      id_usuario: user.id_usuario,
      nombre: user.nombre,
      correo: user.correo,
      id_rol: user.id_rol
    }
  });
}));

app.get('/api/usuarios/:id', asyncHandler(async (req, res) => {
  await requireAuth(req, res, () => {});
  if (res.headersSent) return;

  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' });

  if (!assertSelfOrAdmin(req, res, id)) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const [rows] = await pool.query(
    'SELECT id_usuario, nombre, correo, id_rol FROM usuario WHERE id_usuario = :id LIMIT 1',
    { id }
  );

  if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(rows[0]);
}));

// Actualizar datos básicos del usuario:
// - Permite editar únicamente nombre/correo.
// - Reglas de acceso: solo el propio usuario (o un admin) puede actualizar.
// - Se valida correo único para evitar duplicados en la tabla usuario.
app.patch('/api/usuarios/:id', asyncHandler(async (req, res) => {
  await requireAuth(req, res, () => {});
  if (res.headersSent) return;

  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' });

  if (!assertSelfOrAdmin(req, res, id)) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const { nombre, correo } = req.body || {};
  const updates = [];
  const values = { id };

  if (nombre !== undefined) {
    const nextName = String(nombre || '').trim();
    if (!nextName) return res.status(400).json({ error: 'nombre es obligatorio' });
    updates.push('nombre = :nombre');
    values.nombre = nextName;
  }

  if (correo !== undefined) {
    const email = String(correo || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'correo es obligatorio' });
    const [exists] = await pool.query(
      'SELECT 1 FROM usuario WHERE LOWER(TRIM(correo)) = :correo AND id_usuario <> :id LIMIT 1',
      { correo: email, id }
    );
    if (exists.length) return res.status(409).json({ error: 'El correo ya está registrado' });
    updates.push('correo = :correo');
    values.correo = email;
  }

  if (!updates.length) return res.status(400).json({ error: 'Sin cambios' });

  const [result] = await pool.query(
    `UPDATE usuario SET ${updates.join(', ')} WHERE id_usuario = :id`,
    values
  );

  if (!result?.affectedRows) return res.status(404).json({ error: 'Usuario no encontrado' });

  // Devolvemos la versión actualizada para que el frontend pueda refrescar estado/localStorage.
  const [rows] = await pool.query(
    'SELECT id_usuario, nombre, correo, id_rol FROM usuario WHERE id_usuario = :id LIMIT 1',
    { id }
  );

  if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(rows[0]);
}));

// ================================
//  API: Cuenta / Seguridad
// ================================
// Cambio de contraseña:
// - Se pide contraseña actual + nueva contraseña.
// - Se compara la actual con bcrypt (porque en la BD NO guardamos la clave en texto plano).
// - Si coincide, se guarda la nueva contraseña hasheada.
// - Se valida que id_usuario del body coincida con el :id del URL para evitar cambios a otro usuario.
app.post('/api/usuarios/:id/password', asyncHandler(async (req, res) => {
  await requireAuth(req, res, () => {});
  if (res.headersSent) return;

  const id = Number(req.params.id);
  const { id_usuario, current_password, new_password } = req.body || {};

  // Validaciones básicas para no procesar datos inválidos.
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' });
  const uid = Number(id_usuario);
  if (!Number.isFinite(uid) || uid !== id) {
    return res.status(400).json({ error: 'id_usuario inválido' });
  }

  if (!assertSelfOrAdmin(req, res, uid)) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'current_password y new_password son obligatorios' });
  }

  const current = String(current_password);
  const next = String(new_password);
  // Regla mínima para evitar contraseñas demasiado cortas.
  if (next.length < 4) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 4 caracteres' });
  }

  // Traemos el hash actual de la contraseña.
  // Nota: la columna se llama `contraseña` (con ñ), por eso va entre backticks.
  const [rows] = await pool.query(
    'SELECT `contraseña` AS password_hash FROM usuario WHERE id_usuario = :id LIMIT 1',
    { id }
  );

  if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });

  // bcrypt.compare valida si el texto (current) corresponde al hash guardado.
  const ok = await bcrypt.compare(current, String(rows[0].password_hash || ''));
  if (!ok) return res.status(401).json({ error: 'Contraseña actual incorrecta' });

  // Si la actual es correcta, hasheamos la nueva y la guardamos.
  const hash = await bcrypt.hash(next, 10);
  await pool.query(
    'UPDATE usuario SET `contraseña` = :hash WHERE id_usuario = :id',
    { hash, id }
  );

  res.json({ ok: true });
}));

// ================================
//  API: Recuperación de contraseña (demo)
// ================================
// ¿Olvidaste tu contraseña? (MAQUETA)
// Flujo en 2 pasos:
// 1) POST /api/password/forgot  -> genera un código temporal
// 2) POST /api/password/reset  -> valida el código y guarda la nueva contraseña hasheada
//
// Nota importante:
// - En una app real el código se envía por email/SMS.
// - Aquí lo devolvemos en la respuesta (demo_code) para poder probarlo sin integrar correo.
app.post('/api/password/forgot', asyncHandler(async (req, res) => {
  const { correo } = req.body || {};
  if (!correo) return res.status(400).json({ error: 'correo es obligatorio' });

  const email = String(correo).trim().toLowerCase();

  const [rows] = await pool.query(
    'SELECT id_usuario FROM usuario WHERE correo = :correo LIMIT 1',
    { correo: email }
  );

  // Para no filtrar si un correo existe o no, respondemos ok:true igual.
  // Si no existe, simplemente no guardamos código.
  if (!rows.length) return res.json({ ok: true });

  // Código numérico de 6 dígitos.
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const salt = crypto.randomBytes(16).toString('hex');
  const codeHash = crypto.createHash('sha256').update(`${salt}:${code}`).digest('hex');

  // Expira en 10 minutos.
  const expiresAt = Date.now() + 10 * 60 * 1000;

  passwordResetStore.set(email, {
    id_usuario: Number(rows[0].id_usuario),
    salt,
    codeHash,
    expiresAt
  });

  res.json({ ok: true, demo_code: code, expires_in_seconds: 600 });
}));

app.post('/api/password/reset', asyncHandler(async (req, res) => {
  const { correo, code, new_password } = req.body || {};
  if (!correo || !code || !new_password) {
    return res.status(400).json({ error: 'correo, code y new_password son obligatorios' });
  }

  const email = String(correo).trim().toLowerCase();
  const entry = passwordResetStore.get(email);
  if (!entry) return res.status(400).json({ error: 'Código inválido o expirado' });

  if (Date.now() > Number(entry.expiresAt)) {
    passwordResetStore.delete(email);
    return res.status(400).json({ error: 'Código inválido o expirado' });
  }

  const provided = String(code).trim();
  const providedHash = crypto.createHash('sha256').update(`${entry.salt}:${provided}`).digest('hex');
  if (providedHash !== entry.codeHash) return res.status(401).json({ error: 'Código incorrecto' });

  const next = String(new_password);
  if (next.length < 4) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 4 caracteres' });
  }

  const hash = await bcrypt.hash(next, 10);
  const [result] = await pool.query(
    'UPDATE usuario SET `contraseña` = :hash WHERE id_usuario = :id_usuario',
    { hash, id_usuario: Number(entry.id_usuario) }
  );

  passwordResetStore.delete(email);

  if (!result?.affectedRows) {
    return res.status(500).json({ error: 'No se pudo actualizar la contraseña' });
  }

  res.json({ ok: true });
}));

// ================================
//  API: Compras
// ================================
// Compras: registra la compra (fecha actual)
app.post('/api/compras', asyncHandler(async (req, res) => {
  await requireAuth(req, res, () => {});
  if (res.headersSent) return;

  const { id_usuario, id_libro, precio } = req.body || {};

  const uid = Number(id_usuario);
  const lid = Number(id_libro);

  if (!Number.isFinite(uid) || !Number.isFinite(lid)) {
    return res.status(400).json({ error: 'id_usuario e id_libro son obligatorios' });
  }

  if (!assertSelfOrAdmin(req, res, uid)) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  // Validación anti-error FK:
  // - Si el frontend manda un id_usuario que no existe, MySQL lanza un error por la foreign key.
  // - En vez de mostrar el error “crudo”, validamos antes y devolvemos un mensaje entendible.
  // - Esto también ayuda cuando el usuario quedó guardado en localStorage pero fue borrado de la BD.
  const [usuarios] = await pool.query(
    'SELECT 1 FROM usuario WHERE id_usuario = :id_usuario LIMIT 1',
    { id_usuario: uid }
  );
  if (!usuarios.length) {
    return res.status(404).json({ error: 'Usuario no encontrado. Inicia sesión o regístrate.' });
  }

  const [libros] = await pool.query(
    'SELECT 1 FROM libro WHERE id_libro = :id_libro LIMIT 1',
    { id_libro: lid }
  );
  if (!libros.length) {
    return res.status(404).json({ error: 'Libro no encontrado' });
  }

  // Compra con efecto en stock:
  // - Si se compra un libro, lo marcamos como no disponible (disponibilidad = 0).
  // - Se usa transacción para asegurar consistencia:
  //   o se registra compra + se actualiza stock, o no se hace nada.
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const libroCols = await getLibroColumns();
    const canStockCompra = libroCols.has('stock_compra');
    const canStockRenta = libroCols.has('stock_renta');
    const canValor = libroCols.has('valor');

    const selectParts = [];
    if (canStockCompra) selectParts.push('stock_compra');
    if (canStockRenta) selectParts.push('stock_renta');
    selectParts.push('disponibilidad');
    if (canValor) selectParts.push('valor');

    const [libroRows] = await conn.query(
      `SELECT ${selectParts.join(', ')} FROM libro WHERE id_libro = :id_libro LIMIT 1 FOR UPDATE`,
      { id_libro: lid }
    );
    if (!libroRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Libro no encontrado' });
    }

    const row = libroRows[0] || {};
    const stockCompra = canStockCompra ? Number(row.stock_compra) : Number(row.disponibilidad) === 1 ? 1 : 0;
    if (!Number.isFinite(stockCompra) || stockCompra <= 0) {
      await conn.rollback();
      return res.status(409).json({ error: 'Libro no disponible para compra' });
    }

    const unitPrice = canValor ? Number(row.valor) : Number(precio);
    if (!Number.isFinite(unitPrice)) {
      await conn.rollback();
      return res.status(400).json({ error: 'precio inválido' });
    }

    const [result] = await conn.query(
      'INSERT INTO compra (fecha_compra, precio, id_usuario, id_libro) VALUES (CURDATE(), :precio, :id_usuario, :id_libro)',
      { precio: unitPrice, id_usuario: uid, id_libro: lid }
    );

    if (canStockCompra) {
      await conn.query(
        `UPDATE libro
            SET stock_compra = GREATEST(stock_compra - 1, 0),
                disponibilidad = CASE
                  WHEN (GREATEST(stock_compra - 1, 0) > 0 OR ${canStockRenta ? 'stock_renta' : '0'} > 0) THEN 1
                  ELSE 0
                END
          WHERE id_libro = :id_libro`,
        { id_libro: lid }
      );
    } else {
      await conn.query(
        'UPDATE libro SET disponibilidad = 0 WHERE id_libro = :id_libro',
        { id_libro: lid }
      );
    }

    await conn.commit();
    res.status(201).json({ id_compra: result.insertId });
  } catch (e) {
    try {
      await conn.rollback();
    } catch {
    }
    throw e;
  } finally {
    conn.release();
  }
}));

// ================================
//  API: Préstamos
// ================================
// Préstamos (listar):
// - Se usa para la tabla de préstamos (React y HTML).
// - Solo devuelve préstamos del usuario (o admin).
app.get('/api/prestamos', asyncHandler(async (req, res) => {
  await requireAuth(req, res, () => {});
  if (res.headersSent) return;

  const uid = Number(req.query.id_usuario);
  if (!Number.isFinite(uid)) {
    return res.status(400).json({ error: 'id_usuario es obligatorio' });
  }

  if (!assertSelfOrAdmin(req, res, uid)) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const hasFechaReal = await ensurePrestamoFechaRealColumn();
  const prestamoCols = await getPrestamoColumns();
  const selectFechaReal = hasFechaReal && prestamoCols.has('fecha_devolucion_real') ? ', p.fecha_devolucion_real' : '';

  const [rows] = await pool.query(
    `SELECT p.id_prestamo, p.fecha_prestamo, p.fecha_devolucion${selectFechaReal}, p.estado, p.extensiones,
            l.id_libro, l.titulo, l.autor
       FROM prestamo p
       INNER JOIN libro l ON l.id_libro = p.id_libro
      WHERE p.id_usuario = :id_usuario
      ORDER BY p.id_prestamo DESC`,
    { id_usuario: uid }
  );

  res.json(rows);
}));

// Préstamos: acá uso transacción para que sea “todo o nada”.
// Si algo falla, hago rollback y no dejo la BD a medias.
app.post('/api/prestamos', asyncHandler(async (req, res) => {
  await requireAuth(req, res, () => {});
  if (res.headersSent) return;

  const { id_usuario, id_libro, cantidad } = req.body || {};

  const uid = Number(id_usuario);
  const lid = Number(id_libro);

  const qty = Number(cantidad ?? 1);
  const cantidadInt = Number.isFinite(qty) ? Math.trunc(qty) : NaN;

  if (!Number.isFinite(uid) || !Number.isFinite(lid)) {
    return res.status(400).json({ error: 'id_usuario e id_libro son obligatorios' });
  }

  if (!Number.isFinite(cantidadInt) || cantidadInt <= 0) {
    return res.status(400).json({ error: 'cantidad inválida' });
  }

  if (cantidadInt > 20) {
    return res.status(400).json({ error: 'cantidad máxima: 20' });
  }

  if (!assertSelfOrAdmin(req, res, uid)) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Validación anti-error FK dentro de la transacción:
    // - Si el usuario no existe, no tiene sentido continuar.
    // - Se hace aquí (con conn) para mantener todo consistente dentro de la transacción.
    // - Esto también ayuda cuando el usuario quedó guardado en localStorage pero fue borrado de la BD.
    const [usuarios] = await conn.query(
      'SELECT 1 FROM usuario WHERE id_usuario = :id_usuario LIMIT 1',
      { id_usuario: uid }
    );
    if (!usuarios.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Usuario no encontrado. Inicia sesión o regístrate.' });
    }

    const libroCols = await getLibroColumns();
    const canStockCompra = libroCols.has('stock_compra');
    const canStockRenta = libroCols.has('stock_renta');

    const selectParts = [];
    if (canStockCompra) selectParts.push('stock_compra');
    if (canStockRenta) selectParts.push('stock_renta');
    selectParts.push('disponibilidad');

    const [libros] = await conn.query(
      `SELECT ${selectParts.join(', ')} FROM libro WHERE id_libro = :id_libro LIMIT 1 FOR UPDATE`,
      { id_libro: lid }
    );

    if (!libros.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Libro no encontrado' });
    }

    const row = libros[0] || {};
    const stockRenta = canStockRenta ? Number(row.stock_renta) : Number(row.disponibilidad) === 1 ? 1 : 0;

    if (!canStockRenta && cantidadInt > 1) {
      await conn.rollback();
      return res.status(400).json({ error: 'cantidad no soportada en este esquema' });
    }

    if (!Number.isFinite(stockRenta) || stockRenta < cantidadInt) {
      await conn.rollback();
      return res.status(409).json({ error: 'Libro no disponible para préstamo' });
    }

    const date = new Date();
    date.setDate(date.getDate() + 15);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const fecha_devolucion = `${yyyy}-${mm}-${dd}`;

    for (let i = 0; i < cantidadInt; i += 1) {
      await conn.query(
        'INSERT INTO prestamo (fecha_prestamo, fecha_devolucion, estado, extensiones, id_usuario, id_libro) VALUES (CURDATE(), :fecha_devolucion, :estado, 0, :id_usuario, :id_libro)',
        {
          fecha_devolucion: String(fecha_devolucion),
          estado: 'Activo',
          id_usuario: uid,
          id_libro: lid
        }
      );
    }

    if (canStockRenta) {
      await conn.query(
        `UPDATE libro
            SET stock_renta = GREATEST(stock_renta - :cantidad, 0),
                disponibilidad = CASE
                  WHEN (${canStockCompra ? 'stock_compra' : '0'} > 0 OR GREATEST(stock_renta - :cantidad, 0) > 0) THEN 1
                  ELSE 0
                END
          WHERE id_libro = :id_libro`,
        { id_libro: lid, cantidad: cantidadInt }
      );
    } else {
      await conn.query('UPDATE libro SET disponibilidad = 0 WHERE id_libro = :id_libro', { id_libro: lid });
    }

    await conn.commit();
    res.status(201).json({ ok: true, cantidad: cantidadInt });
  } catch (e) {
    try {
      await conn.rollback();
    } catch {
    }
    throw e;
  } finally {
    conn.release();
  }
}));

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado' });
});

// ================================
//  Manejo de errores
// ================================
// Manejo de errores general:
// - Centraliza respuestas de error.
// - Traduce algunos errores comunes de MySQL a mensajes amigables.
app.use((err, req, res, next) => {
  // Traducción de errores comunes de MySQL:
  // - ER_NO_REFERENCED_ROW_2 aparece cuando falla una foreign key.
  // - Esto evita exponer mensajes técnicos y da una respuesta entendible al frontend.
  if (err?.code === 'ER_NO_REFERENCED_ROW_2' || err?.code === 'ER_NO_REFERENCED_ROW') {
    return res.status(400).json({ error: 'Referencia inválida (usuario o libro no existe).' });
  }
  const status = typeof err?.status === 'number' ? err.status : 500;
  res.status(status).json({ error: err?.message || 'Error interno' });
});

// ================================
//  Arranque del servidor
// ================================
// Arranco el servidor
ensureSchema()
  .catch(() => {})
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
