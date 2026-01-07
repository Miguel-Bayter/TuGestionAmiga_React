
# GA7-220501096-AA5-EV03: Diseño y desarrollo de servicios web - proyecto

## 1) Visión general de la API

Este proyecto funciona porque el frontend (React/HTML) consume una **API REST** construida con **Node.js + Express** y una base de datos **MySQL**.

La API se organizó por “módulos” (libros, carrito, compras, préstamos, usuarios y administración). Cada módulo expone endpoints `/api/*` que permiten:

- Consultar información (GET)
- Crear registros (POST)
- Actualizar parcialmente (PATCH)
- Eliminar (DELETE)

### 1.1 Base URL

- `http://localhost:3000`

### 1.2 Autenticación usada por el proyecto (header `x-user-id`)

Este proyecto usa una autenticación simple para aplicar permisos:

- El frontend guarda el usuario en `localStorage`.
- En cada request, el frontend envía el header:
  - `x-user-id: <id_usuario>`

Con ese header el backend:

- Valida que el usuario exista.
- Determina si es `ADMIN` (`id_rol = 1`) o `USUARIO` (`id_rol = 2`).
- Protege rutas privadas (carrito, préstamos, compras, administración).

En Postman, esto se prueba agregando manualmente el header `x-user-id` (ver sección 3).

---

## 2) Endpoints de la API (por módulo)

### 2.1 Utilidades

- `GET /api/health`
  - Confirma que el backend está activo y que MySQL responde.
  - Respuesta típica:
    - `{ "ok": true, "db": true }`

### 2.2 Portadas (covers)

- `GET /api/covers`
  - Lista las imágenes disponibles para portadas en el proyecto.
  - Se usa para que el frontend decida si carga una imagen real o un fallback.

### 2.3 Catálogo de libros

- `GET /api/libros`
  - Lista libros.
  - Query opcional:
    - `?disponible=true` (o `?disponible=1`) para filtrar disponibles.

- `GET /api/libros/:id`
  - Trae el detalle de un libro por id.

- `GET /api/libros/:id/historial` (solo `ADMIN`)
  - Trae historial de préstamos de un libro.
  - Requiere `x-user-id` de un administrador.

### 2.4 Autenticación

En el proyecto existen **dos pares** de endpoints de autenticación:

- **Endpoints usados por el frontend React**
  - `POST /api/register`
  - `POST /api/login`

- **Endpoints del servicio solicitado en la guía** (reciben `usuario` + `password`)
  - `POST /api/auth/register`
  - `POST /api/auth/login`

Ambos crean/inician sesión sobre la misma tabla `usuario`, pero cambian los nombres de campos del body.

### 2.5 Usuarios / Cuenta

- `GET /api/usuarios/:id` (privado: self o `ADMIN`)
  - Obtiene datos básicos del usuario.
  - Requiere `x-user-id`.

- `POST /api/usuarios/:id/password` (privado: self o `ADMIN`)
  - Cambia contraseña, validando contraseña actual.
  - Requiere `x-user-id`.

### 2.6 Recuperación de contraseña (demo)

- `POST /api/password/forgot`
  - Recibe `{ "correo": "..." }`.
  - Devuelve un `demo_code` para poder probar sin correo real.

- `POST /api/password/reset`
  - Recibe `{ "correo": "...", "code": "...", "new_password": "..." }`.

### 2.7 Compras

- `GET /api/compras?id_usuario=...` (privado: self o `ADMIN`)
  - Lista compras del usuario.
  - Requiere `x-user-id`.

- `POST /api/compras` (privado: self o `ADMIN`)
  - Registra una compra puntual (el proyecto normalmente compra por carrito/checkout).
  - Requiere `x-user-id`.

### 2.8 Carrito

Este módulo permite “acumular” productos antes de confirmar la compra.

- `GET /api/carrito?id_usuario=...` (privado: self o `ADMIN`)
  - Lista items actuales del carrito.
  - Requiere `x-user-id`.

- `POST /api/carrito` (privado: self o `ADMIN`)
  - Agrega un libro al carrito o incrementa cantidad.
  - Body:
    - `{ "id_usuario": 1, "id_libro": 10, "cantidad": 2 }`
  - Requiere `x-user-id`.

- `DELETE /api/carrito/:id_libro?id_usuario=...` (privado: self o `ADMIN`)
  - Elimina un libro del carrito.
  - Requiere `x-user-id`.

- `POST /api/carrito/checkout` (privado: self o `ADMIN`)
  - Confirma la compra de todo el carrito.
  - Descuenta `stock_compra`.
  - Si falla stock en alguno, falla toda la transacción.
  - Requiere `x-user-id`.

### 2.9 Préstamos

- `GET /api/prestamos?id_usuario=...` (privado: self o `ADMIN`)
  - Lista préstamos del usuario.
  - Requiere `x-user-id`.

- `POST /api/prestamos` (privado: self o `ADMIN`)
  - Crea un préstamo.
  - Body:
    - `{ "id_usuario": 1, "id_libro": 10 }`
  - Requiere `x-user-id`.

- `POST /api/prestamos/:id/extender` (privado: self o `ADMIN`)
  - Extiende un préstamo.
  - Body:
    - `{ "id_usuario": 1 }`
  - Requiere `x-user-id`.

- `POST /api/prestamos/:id/devolver` (solo `ADMIN`)
  - Registra la devolución del préstamo.
  - Body:
    - `{ "id_usuario": 1 }` (usuario dueño del préstamo)
  - Requiere `x-user-id` de administrador.

### 2.10 Administración (solo `ADMIN`)

- `GET /api/admin/categorias`

- Libros:
  - `GET /api/admin/libros`
  - `POST /api/admin/libros`
  - `PATCH /api/admin/libros/:id`
  - `DELETE /api/admin/libros/:id`

- Usuarios:
  - `GET /api/admin/usuarios`
  - `POST /api/admin/usuarios`
  - `PATCH /api/admin/usuarios/:id`
  - `PATCH /api/admin/usuarios/:id/rol`
  - `DELETE /api/admin/usuarios/:id`

- Préstamos:
  - `GET /api/admin/prestamos` (query opcional: `?q=texto` para filtrar por nombre/correo)

---

## 3) ¿Cómo probar la API en Postman?

### 3.1 Preparación

#### 3.1.1 ¿Qué significa `{{baseUrl}}`?

En esta guía, `{{baseUrl}}` es la URL donde está corriendo el **backend**.

- Si levantas el backend con `npm start` en `backend/`, el valor típico es:
  - `http://localhost:3000`

Nota:

- El frontend React corre en `http://localhost:5173`, pero **la API** está en `http://localhost:3000`.

#### 3.1.2 ¿Qué significa el header `x-user-id`?

El backend protege algunas rutas. Para permitirlas, espera el header:

- `x-user-id: <id_usuario>`

¿De dónde sale ese `id_usuario`?

- Sale de la respuesta del login (ver sección 3.2), en `user.id_usuario`.

Regla importante:

- Si llamas un endpoint “privado” sin `x-user-id`, el resultado esperado es:
  - `401` con `{ "error": "No autenticado" }`

1) Levanta el backend desde `backend/`:

```bash
npm install
npm start
```

2) En Postman crea un **Environment** (recomendado) con variables:

- `baseUrl` = `http://localhost:3000`
- `userId` = (se llena después del login)
- `adminId` = (se llena después del login de un ADMIN)

Cómo llenar `userId`:

- Haz login (sección 3.2) y copia `user.id_usuario`.

Cómo llenar `adminId`:

- Necesitas un usuario con `id_rol = 1`.
- El script `backend/sql/seed_admin_and_books.sql` prepara un admin con:
  - correo: `admin@mail.com`
  - nombre: `Administrador`
  - password: **lo defines tú** (porque el script pide un hash bcrypt)

Si vas a usar ese script, el flujo típico es:

1) Generar un hash bcrypt (ejemplo con password `admin123`):

```bash
node -e "const bcrypt=require('bcryptjs'); console.log(bcrypt.hashSync('admin123',10));"
```

2) Pegar el hash en el script, reemplazando `REEMPLAZA_ESTE_TEXTO_POR_HASH_BCRYPT`.
3) Ejecutar el script en MySQL.
4) Hacer login por Postman con `correo=admin@mail.com` y `password=admin123`.
5) Copiar de la respuesta el `id_usuario` y guardarlo como `adminId`.

3) Prueba el backend:

- `GET {{baseUrl}}/api/health`

Resultado esperado:

- Status `200`
- JSON similar a:

```json
{ "ok": true, "db": true }
```

### 3.2 Probar autenticación (para obtener `id_usuario`)

#### Registro (servicio simple)

- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/auth/register`
- **Headers**:
  - `Content-Type: application/json`
- **Body (raw JSON)**:

```json
{ "usuario": "prueba@mail.com", "password": "1234", "nombre": "Usuario Prueba" }
```

Resultado esperado:

- Status `201`
- Respuesta similar a:

```json
{ "ok": true, "message": "Registro satisfactorio", "id_usuario": 5, "usuario": "prueba@mail.com" }
```

Errores comunes esperados:

- `400` si falta `usuario` o `password`
- `409` si el usuario ya existe

#### Login (servicio simple)

- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/auth/login`
- **Headers**:
  - `Content-Type: application/json`
- **Body (raw JSON)**:

```json
{ "usuario": "prueba@mail.com", "password": "1234" }
```

Resultado esperado:

- Status `200`
- Respuesta similar a:

```json
{
  "ok": true,
  "message": "Autenticación satisfactoria",
  "user": { "id_usuario": 5, "nombre": "Usuario Prueba", "correo": "prueba@mail.com", "id_rol": 2 }
}
```

Dónde sacar `userId`:

- Copia `user.id_usuario` y pégalo en tu Environment como `userId`.

Errores comunes esperados:

- `401` con `{ "ok": false, "error": "Error en la autenticación" }`

### 3.3 Probar endpoints privados con `x-user-id`

Regla práctica:

- Si el endpoint dice “privado”, agrega el header:
  - `x-user-id: {{userId}}`

Ejemplo: ver carrito

- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/carrito?id_usuario={{userId}}`
- **Headers**:
  - `x-user-id: {{userId}}`

Resultado esperado:

- Status `200`
- Respuesta: un arreglo (puede estar vacío)

```json
[]
```

### 3.4 Flujo completo de carrito (agregar, listar, checkout)

1) **Agregar al carrito**

- `POST {{baseUrl}}/api/carrito`
- Headers:
  - `Content-Type: application/json`
  - `x-user-id: {{userId}}`
- Body:

```json
{ "id_usuario": {{userId}}, "id_libro": 10, "cantidad": 2 }
```

Resultado esperado:

- Status `200`
- Respuesta:

```json
{ "ok": true }
```

2) **Listar carrito**

- `GET {{baseUrl}}/api/carrito?id_usuario={{userId}}`
- Header:
  - `x-user-id: {{userId}}`

Resultado esperado:

- Status `200`
- Respuesta: lista de items con `id_libro`, `cantidad`, `titulo`, `autor` (y a veces `valor` si existe en BD)

3) **Checkout**

- `POST {{baseUrl}}/api/carrito/checkout`
- Headers:
  - `Content-Type: application/json`
  - `x-user-id: {{userId}}`
- Body:

```json
{ "id_usuario": {{userId}} }
```

Resultado esperado:

- Status `200`
- Respuesta:

```json
{ "ok": true }
```

Errores comunes esperados:

- `400` si el carrito está vacío
- `409` si hay stock insuficiente para completar la compra

### 3.5 Probar administración

Para rutas `/api/admin/*` necesitas:

- Un `id_usuario` cuyo `id_rol` sea `1` (ADMIN).
- En Postman poner:
  - `x-user-id: {{adminId}}`

Ejemplo: listar préstamos globales

- `GET {{baseUrl}}/api/admin/prestamos`
- Header:
  - `x-user-id: {{adminId}}`

Resultado esperado:

- Status `200`
- Respuesta: arreglo de préstamos (puede ser vacío)

Errores comunes esperados:

- `401` si falta `x-user-id`
- `403` si el usuario no es administrador (`Solo administradores`)

### 3.6 Probar catálogo de libros (público y admin)

1) **Listar libros (público)**

- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/libros`
- **Body (raw JSON)**: *(no aplica — endpoint `GET` sin body)*

Resultado esperado:

- Status `200`
- Respuesta: arreglo de libros. Ejemplo (campos pueden variar según tu BD):

```json
[
  {
    "id_libro": 10,
    "titulo": "Cien años de soledad",
    "autor": "Gabriel García Márquez",
    "descripcion": "...",
    "disponibilidad": 1,
    "id_categoria": 2,
    "nombre_categoria": "Novela"
  }
]
```

2) **Listar solo disponibles (público)**

- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/libros?disponible=true`
- **Body (raw JSON)**: *(no aplica — endpoint `GET` sin body)*

Resultado esperado:

- Status `200`
- Respuesta: arreglo filtrado (solo libros con `disponibilidad = 1`).

3) **Detalle de un libro (público)**

- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/libros/10`
- **Body (raw JSON)**: *(no aplica — endpoint `GET` sin body)*

Resultado esperado:

- Status `200`
- Respuesta: objeto libro.

Errores comunes esperados:

- `400` si `:id` no es un número válido
- `404` si el libro no existe (`{ "error": "Libro no encontrado" }`)

4) **Historial de préstamos de un libro (solo ADMIN)**

- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/libros/10/historial`
- **Headers**:
  - `x-user-id: {{adminId}}`
- **Body (raw JSON)**: *(no aplica — endpoint `GET` sin body)*

Resultado esperado:

- Status `200`
- Respuesta: arreglo con historial (puede estar vacío).

Errores comunes esperados:

- `401` si falta `x-user-id`
- `403` si no es admin (`Solo administradores`)

### 3.7 Probar compras

1) **Listar compras del usuario (privado: self o ADMIN)**

- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/compras?id_usuario={{userId}}`
- **Headers**:
  - `x-user-id: {{userId}}`
- **Body (raw JSON)**: *(no aplica — endpoint `GET` sin body)*

Resultado esperado:

- Status `200`
- Respuesta: arreglo con compras (puede estar vacío). Ejemplo:

```json
[
  {
    "id_compra": 1,
    "fecha_compra": "2026-01-07",
    "precio": 35000,
    "id_libro": 10,
    "titulo": "Cien años de soledad",
    "autor": "Gabriel García Márquez"
  }
]
```

Errores comunes esperados:

- `401` si falta `x-user-id`
- `403` si `id_usuario` no coincide con el `x-user-id` (y no eres admin)
- `400` si no mandas `id_usuario` en query

2) **Registrar una compra puntual (privado: self o ADMIN)**

Nota:

- En el flujo normal del proyecto se compra con `POST /api/carrito/checkout`.
- Este endpoint existe para registrar una compra directa (1 libro).

- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/compras`
- **Headers**:
  - `Content-Type: application/json`
  - `x-user-id: {{userId}}`
- **Body (raw JSON)**:

```json
{ "id_usuario": {{userId}}, "id_libro": 10 }
```

Resultado esperado:

- Status `201`
- Respuesta:

```json
{ "id_compra": 123 }
```

Errores comunes esperados:

- `404` si el usuario o el libro no existen
- `409` si el libro no está disponible para compra

### 3.8 Probar préstamos (renta)

1) **Listar préstamos del usuario (privado: self o ADMIN)**

- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/prestamos?id_usuario={{userId}}`
- **Headers**:
  - `x-user-id: {{userId}}`
- **Body (raw JSON)**: *(no aplica — endpoint `GET` sin body)*

Resultado esperado:

- Status `200`
- Respuesta: arreglo con préstamos (puede estar vacío). Ejemplo:

```json
[
  {
    "id_prestamo": 5,
    "fecha_prestamo": "2026-01-07",
    "fecha_devolucion": "2026-01-22",
    "estado": "Activo",
    "extensiones": 0,
    "id_libro": 10,
    "titulo": "Cien años de soledad",
    "autor": "Gabriel García Márquez"
  }
]
```

2) **Crear préstamo (privado: self o ADMIN)**

- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/prestamos`
- **Headers**:
  - `Content-Type: application/json`
  - `x-user-id: {{userId}}`
- **Body (raw JSON)**:

```json
{ "id_usuario": {{userId}}, "id_libro": 10 }
```

Resultado esperado:

- Status `201`
- Respuesta:

```json
{ "id_prestamo": 123 }
```

Errores comunes esperados:

- `404` si el usuario o el libro no existen
- `409` si el libro no está disponible para préstamo

3) **Extender préstamo (privado: self o ADMIN)**

- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/prestamos/123/extender`
- **Headers**:
  - `Content-Type: application/json`
  - `x-user-id: {{userId}}`
- **Body (raw JSON)**:

```json
{ "id_usuario": {{userId}} }
```

Resultado esperado:

- Status `200`
- Respuesta:

```json
{ "ok": true }
```

Errores comunes esperados:

- `404` si el préstamo no existe
- `409` si el préstamo no está activo
- `409` si se alcanza el límite de extensiones

4) **Devolver préstamo (solo ADMIN)**

- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/prestamos/123/devolver`
- **Headers**:
  - `Content-Type: application/json`
  - `x-user-id: {{adminId}}`
- **Body (raw JSON)**:

```json
{ "id_usuario": {{userId}} }
```

Resultado esperado:

- Status `200`
- Respuesta:

```json
{ "ok": true }
```

Errores comunes esperados:

- `401` si falta `x-user-id`
- `403` si no es admin (`Solo administradores`)
- `404` si el préstamo no existe
- `409` si el préstamo ya fue devuelto

---

# GA7-220501096-AA5-EV01 diseño y desarrollo de servicios web - caso

## 1) Descripción del servicio

Se implementó un servicio web para **registro** e **inicio de sesión**.

El servicio recibe un **usuario** y una **contraseña**.

- Si la autenticación es correcta devuelve el mensaje: **"Autenticación satisfactoria"**.
- Si la autenticación falla devuelve el mensaje: **"Error en la autenticación"**.

Nota:

- En este proyecto, el campo `usuario` se interpreta como **correo** porque en la base de datos la tabla `usuario` trabaja con `correo`.

## 2) Endpoints disponibles

Base URL (local):

- `http://localhost:3000`

### 2.1 Registro

`POST /api/auth/register`

Body (JSON):

```json
{
  "usuario": "correo@dominio.com",
  "password": "1234",
  "nombre": "opcional"
}
```

Respuestas esperadas:

- `201` (OK)
  - `ok: true`
  - `message: "Registro satisfactorio"`
- `400` si falta `usuario` o `password`
- `409` si el usuario ya existe

### 2.2 Inicio de sesión

`POST /api/auth/login`

Body (JSON):

```json
{
  "usuario": "correo@dominio.com",
  "password": "1234"
}
```

Respuestas esperadas:

- `200` (OK)
  - `ok: true`
  - `message: "Autenticación satisfactoria"`
  - `user`: datos básicos del usuario (sin contraseña)
- `401` (Credenciales inválidas)
  - `ok: false`
  - `error: "Error en la autenticación"`

## 3) ¿Cómo probarlo en Postman?

### 3.1 Preparación

1) Levanta el backend:

```bash
# carpeta backend/
npm install
npm start
```

2) Verifica que esté vivo:

- `GET http://localhost:3000/api/health`

Debe responder algo como:

```json
{ "ok": true }
```

### 3.2 Prueba 1: Registro exitoso

1) En Postman crea una request:

- **Method**: `POST`
- **URL**: `http://localhost:3000/api/auth/register`

2) En la pestaña **Body**:

- Selecciona **raw**
- Tipo: **JSON**

3) Pega este JSON:

```json
{
  "usuario": "prueba@mail.com",
  "password": "1234",
  "nombre": "Usuario Prueba"
}
```

Resultado esperado:

- Status `201`
- Respuesta con `message: "Registro satisfactorio"`

### 3.3 Prueba 2: Registro repetido (usuario ya existe)

Repite el mismo request anterior.

Resultado esperado:

- Status `409`
- Mensaje indicando que el usuario ya existe.

### 3.4 Prueba 3: Login exitoso

1) Crea una request:

- **Method**: `POST`
- **URL**: `http://localhost:3000/api/auth/login`

2) Body (raw JSON):

```json
{
  "usuario": "prueba@mail.com",
  "password": "1234"
}
```

Resultado esperado:

- Status `200`
- `message: "Autenticación satisfactoria"`

### 3.5 Prueba 4: Login fallido

Usa la misma URL pero cambia la contraseña:

```json
{
  "usuario": "prueba@mail.com",
  "password": "xxxx"
}
```

Resultado esperado:

- Status `401`
- `error: "Error en la autenticación"`

---

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
- Presionar **Comprar** (se agrega al carrito).
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
