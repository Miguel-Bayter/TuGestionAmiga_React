# GA7-220501096-AA4-EV03 Componente frontend del proyecto formativo y proyectos de clase (listas de chequeo)

## 1) Objetivo del proyecto

Desarrollar y probar un sistema web para la gestión de biblioteca, integrando:

- Catálogo de libros.
- Préstamos (renta) con reglas de negocio.
- Compras con carrito persistente.
- Gestión por roles (`ADMIN` y `USUARIO`).

El proyecto conserva el **diseño** de la maqueta original, pero añade funcionalidad real consumiendo una API.

## 2) Arquitectura y tecnologías

- **Backend**: Node.js + Express.
- **Base de datos**: MySQL.
- **Frontend React**: Vite + Tailwind.
- **Frontend HTML**: interfaz estática dentro de `frontend/public`.

## 3) Estructura del repositorio

- `backend/`
  - `server/server.js`: servidor Express con rutas `/api/*`.
  - `sql/`: scripts de base de datos.

- `frontend/`
  - `public/`: versión HTML (diseño original).
  - `react/`: versión React (SPA).

## 4) Base de datos (modelo actualizado)

### 4.1 Libro con stock dual

La tabla `libro` maneja:

- `stock_compra`: unidades para comprar.
- `stock_renta`: unidades para prestar.
- `valor`: precio del libro.

La columna `disponibilidad` se calcula a partir del stock:

- Disponible si `stock_compra > 0` o `stock_renta > 0`.

### 4.2 Carrito persistente

Se agregó la tabla `carrito_item`:

- Guarda `id_usuario`, `id_libro` y `cantidad`.
- Llave primaria compuesta `(id_usuario, id_libro)` para evitar duplicados.

### 4.3 Préstamos con extensiones

La tabla `prestamo` incluye:

- `extensiones`: contador de extensiones (máximo 2 para usuarios).

## 5) Scripts SQL

Dentro de `backend/sql/` están los scripts para crear y poblar la BD.

- **Esquema base**: `TuGestionAmiga_db.sql`
- **Seed de demo**: `seed_demo_data.sql`
- **Seed admin + libros**: `seed_admin_and_books.sql`
- **Tabla carrito**: `tugestionamiga_db_carrito_item.sql`

Sugerencia de orden (MySQL):

```sql
SOURCE backend/sql/TuGestionAmiga_db.sql;
SOURCE backend/sql/seed_demo_data.sql;
```

## 6) Configuración (variables de entorno)

El backend lee variables desde `backend/.env`.

1) Copia `backend/.env.example` a `backend/.env`.
2) Ajusta la conexión:

```bash
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=TU_PASSWORD
DB_NAME=tugestionamiga_db
```

## 7) Ejecución del proyecto

### 7.1 Backend + HTML

En `backend/`:

```bash
npm install
npm start
```

- HTML: `http://localhost:3000/index.html`
- API health: `http://localhost:3000/api/health`

### 7.2 Frontend React

1) Mantén el backend corriendo en `http://localhost:3000`.
2) En `frontend/react/`:

```bash
npm install
npm run dev
```

- React: `http://localhost:5173/`

## 8) Roles y permisos

Roles en BD:

- `ADMIN` (`id_rol = 1`)
- `USUARIO` (`id_rol = 2`)

Reglas principales:

- Un `USUARIO` solo puede ver sus propios préstamos/compras.
- La devolución de préstamos es **solo ADMIN**.
- El historial de préstamos por libro (en el detalle) es **solo ADMIN**.

## 9) Reglas de negocio (resumen)

### 9.1 Préstamos

- Duración por defecto: **15 días**.
- Extensión: **+5 días**.
- Límite de extensiones: **2** (para usuarios).

### 9.2 Compras

- La compra usa carrito (`carrito_item`).
- El checkout crea registros en `compra` y descuenta `stock_compra`.

## 10) Pruebas manuales (paso a paso)

### 10.1 Login

- Crear usuario (registro).
- Iniciar sesión.
- Validar que se guarda sesión en `localStorage`.

### 10.2 Agregar al carrito y comprar

- En el dashboard, seleccionar un libro con stock de compra.
- Ingresar cantidad en la tarjeta o en el modal.
- Presionar **Comprar** (se agrega al carrito y navega a `/carrito`).
- En carrito, presionar **Comprar** para hacer checkout.
- Verificar en **Mi Perfil** la sección **Mis Compras**.

### 10.3 Préstamo

- Seleccionar un libro con stock de renta.
- Presionar **Prestar**.
- Ir a **Mis Préstamos** y validar:
  - Estado `Activo`.
  - Fecha de devolución a 15 días.
- Probar **Extender** hasta 2 veces.

### 10.4 Devolución (ADMIN)

- Iniciar sesión como ADMIN.
- Ir a `/admin`.
- En préstamos activos, usar el botón de **Devolver**.
- Validar que el libro recupera stock de renta.

## 11) Proyectos de clase (listas de chequeo)

### 11.1 Checklist de instalación

- [ ] MySQL instalado y en ejecución.
- [ ] BD creada ejecutando `TuGestionAmiga_db.sql`.
- [ ] `.env` creado en `backend/.env`.
- [ ] Backend ejecuta sin errores (`/api/health`).
- [ ] React ejecuta y muestra el dashboard.

### 11.2 Checklist de compras

- [ ] El catálogo muestra precio (`valor`).
- [ ] El botón **Comprar** no usa `prompt()`.
- [ ] Se puede agregar cantidad al carrito.
- [ ] Checkout descuenta `stock_compra`.
- [ ] La compra aparece en `Mi Perfil`.

### 11.3 Checklist de préstamos

- [ ] Préstamo crea fecha de devolución a 15 días.
- [ ] Extensión funciona (+5 días).
- [ ] No permite más de 2 extensiones para usuario.
- [ ] Devolución solo disponible para ADMIN.

### 11.4 Checklist de administración

- [ ] Crear libro con `valor`, `stock_compra`, `stock_renta`.
- [ ] Editar libro sin campo manual de disponibilidad.
- [ ] Ver préstamos globales y buscar por usuario.
- [ ] Crear usuarios desde la pestaña Usuarios.
