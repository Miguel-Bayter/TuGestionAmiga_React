

# Taller sobre codificación de módulos del software GA9-220501096-AA1EV01.

Este repositorio implementa una solución modular tipo **frontend + backend + base de datos** (React + Node/Express + MySQL). En este apartado se explica qué se probó, cómo se ejecutaron las pruebas con Cypress, qué se esperaba de ellas y cómo documentar evidencias para cumplir los criterios de evaluación.

## 1) ¿Qué tipos de pruebas se adaptan mejor al proyecto?

Por la arquitectura y por los casos de uso principales (login, catálogo, carrito, checkout, préstamos y administración), se adaptan mejor:

- **Pruebas E2E (End-to-End)** con Cypress
  - Validan el flujo real desde el navegador (como lo usaría un usuario) y que el frontend consuma correctamente la API.
  - Son ideales para evidenciar con capturas/vídeo.
- **Pruebas de integración (API + Base de datos)**
  - Verifican endpoints `/api/*` con MySQL, códigos HTTP (`200/201/401/403/404/409`) y efectos en datos.
  - En este proyecto ya hay pruebas manuales con Postman (ver sección 14.1).
- **Pruebas de autorización (roles y rutas protegidas)**
  - Comprueban que un usuario sin sesión sea redirigido a `/login`.
  - Comprueban que un usuario sin rol admin no pueda acceder a `/admin`.

No se priorizaron otras pruebas (por ejemplo performance o seguridad avanzada) porque el objetivo principal del taller es demostrar **funcionalidad**, **flujo completo**, **reglas de negocio** y **trazabilidad** con evidencias.

## 2) Herramienta seleccionada e instalada: Cypress

Se seleccionó **Cypress** como herramienta E2E porque:

- Permite probar el flujo completo de la SPA (React) consumiendo la API.
- Permite ver ejecución paso a paso y genera evidencia (screenshots/videos).
- Reduce la fragilidad de pruebas usando comandos y helpers (por ejemplo login por API).

### 2.1 Instalación

En `frontend/react/`:

```bash
npm install
```

La dependencia de Cypress ya está incluida en el proyecto (devDependency) y se configuraron scripts para abrir y ejecutar las pruebas.

## 3) Ambiente de pruebas (alineado al entorno de producción)

Para que los resultados sean representativos, el ambiente debe estar lo más parecido posible al real:

- **Base de datos MySQL** levantada y con datos semilla (si aplica).
- **Backend** levantado en `http://localhost:3000`.
- **Frontend (Vite)** levantado en `http://localhost:5173`.

Notas importantes del proyecto:

- La sesión se guarda en `localStorage` (key `tga_auth_user`).
- La API usa el header `x-user-id` para autorizar acciones; el frontend lo agrega automáticamente.

## 4) ¿Cómo ejecutar las pruebas con Cypress?

### 4.1 Prerrequisitos (antes de abrir Cypress)

1) Levantar MySQL.
2) Levantar el backend (puerto 3000).
3) Levantar el frontend (puerto 5173).

### 4.2 Ejecución en modo gráfico (Cypress UI)

En `frontend/react/`:

```bash
npm run cy:open
```

Para ejecutar también las pruebas que requieren credenciales de administrador:

```bash
npm run cy:open:admin
```

En la interfaz:

1) Seleccionar **E2E Testing**.
2) Elegir un navegador.
3) Ejecutar el spec deseado.

### 4.3 Ejecución por consola (modo automático)

En `frontend/react/`:

```bash
npm run cy:run
```

Para correr únicamente el spec de admin (con variables de entorno):

```bash
npm run cy:run:admin
```

## 5) ¿Qué se espera de estas pruebas (resultados esperados)?

Cada prueba valida un comportamiento observable del sistema:

- **Autenticación**: permitir registro/login y navegación a rutas protegidas.
- **Rutas protegidas**: sin sesión debe redirigir a `/login`.
- **Carrito**: agregar items, visualizar carrito y procesar checkout dejando el carrito vacío.
- **Préstamos**: crear préstamo y visualizarlo en el listado.
- **Roles**: usuario normal no debe ver/acceder a administración; admin sí.

Si alguna prueba falla, se espera obtener:

- Evidencia del fallo (captura o vídeo).
- Un mensaje claro del paso que falló (assertion de Cypress).

## 6) Plan de pruebas, casos de prueba y trazabilidad

La trazabilidad se logra mapeando **caso de uso → caso de prueba → evidencia**.

| ID | Caso de uso | Spec Cypress | Tipo | Resultado esperado | Evidencia |
|---|---|---|---|---|---|
| CP-01 | Registro/Login | `01-auth.cy.js` | E2E | Inicia sesión y entra a la app | Captura/Vídeo Cypress |
| CP-02 | Rutas protegidas | `02-guards.cy.js` | E2E | Sin sesión redirige a `/login` | Captura Cypress |
| CP-03 | Catálogo/Carrito | `03-catalogo-carrito.cy.js` | E2E | Agrega al carrito, checkout devuelve 200 y carrito vacío | Captura Cypress |
| CP-04 | Préstamos | `04-prestamos.cy.js` | E2E | Crea préstamo y aparece en listado | Captura Cypress |
| CP-05 | Admin (guard) | `05-admin-guard.cy.js` | E2E/roles | Usuario normal no entra a `/admin`; admin sí (si se configuran env vars) | Captura Cypress |
| CP-06 | Flujos extra | `06-flujos-extra.cy.js` | E2E | Logout; redirect post-login; sidebar admin visible/oculto | Captura Cypress |

## 7) Resumen de las pruebas realizadas

Resumen (lo ejecutado con Cypress):

- **Autenticación**: registro/login por UI; creación/login de usuario por API para estabilizar escenarios.
- **Rutas protegidas**: acceso sin sesión redirige a `/login`.
- **Carrito y checkout**: checkout validado por request (`POST /api/carrito/checkout`) y por estado final (carrito vacío).
- **Préstamos**: creación y visualización del préstamo.
- **Administración**:
  - Usuario normal: bloqueado para `/admin`.
  - Admin: habilitado si se ejecuta Cypress con `ADMIN_EMAIL` y `ADMIN_PASSWORD`.

---

# GA8-220501096-AA1-EV02 módulos integrados

En este apartado se documenta la integración de los módulos del sistema (frontend + backend + base de datos), partiendo de los requerimientos y dejando evidencia de ejecución, configuración y pruebas.

## 1) Requerimientos del sistema

### 1.1 Requerimientos funcionales (qué hace el sistema)

- **Autenticación**
  - Registro de usuario.
  - Inicio de sesión.
- **Catálogo de libros**
  - Listar libros.
  - Ver detalle de un libro.
  - (ADMIN) administrar libros y categorías.
- **Compras**
  - Agregar libros a carrito.
  - Realizar checkout del carrito.
  - Consultar compras realizadas.
- **Préstamos (renta)**
  - Crear préstamo.
  - Extender préstamo (con reglas).
  - (ADMIN) registrar devolución.
- **Cuenta / Perfil**
  - Consultar datos del usuario.
  - Cambiar contraseña.

### 1.2 Requerimientos no funcionales (cómo debe operar)

- **Seguridad**
  - Contraseñas con hash (`bcryptjs`).
  - Restricción por roles (`ADMIN` y `USUARIO`).
  - Variables sensibles en `.env` (no hardcodeadas).
- **Disponibilidad / consistencia**
  - Operaciones críticas con transacciones (ej. checkout y préstamo).
- **Mantenibilidad**
  - Organización por módulos (libros, carrito, compras, préstamos, usuarios, admin).
  - Documentación de endpoints y pruebas.

## 2) Archivos ejecutables (qué se ejecuta para correr cada módulo)

### 2.1 Backend (API + servidor de estáticos)

Ubicación:

- `backend/`

Ejecutables (scripts):

- `npm start`
  - Ejecuta: `node server/server.js`
- `npm run dev`
  - Ejecuta: `node --watch server/server.js`

Archivo principal:

- `backend/server/server.js`

### 2.2 Frontend React (SPA)

Ubicación:

- `frontend/react/`

Ejecutables (scripts):

- `npm run dev` (servidor de desarrollo)
- `npm run build` (build de producción)
- `npm run preview` (preview del build)

Archivos principales:

- `frontend/react/src/main.jsx` (punto de entrada)
- `frontend/react/src/App.jsx` (rutas y navegación)

### 2.3 Base de datos (scripts SQL)

Ubicación:

- `backend/sql/`

Ejecutables:

- Scripts `*.sql` para crear esquema y datos semilla.

## 3) URLs donde se han desplegado los módulos

### 3.1 URLs de desarrollo local

- **Backend**: `http://localhost:3000`
- **Frontend React (Vite)**: `http://localhost:5173`


## 4) Documentación por módulo y componente (entradas y salidas)

La API se organiza por módulos; para cada módulo se documentan entradas (request) y salidas (response).

Notas generales:

- **Formato de datos**: JSON.
- **Header de autenticación del proyecto**: `x-user-id: <id_usuario>`.
- **Errores estándar** (ejemplos):
  - `400` → `{ "error": "..." }`
  - `401` → `{ "error": "No autenticado" }`
  - `403` → `{ "error": "Solo administradores" }` o `{ "error": "No autorizado" }`
  - `404` → `{ "error": "... no encontrado" }`
  - `409` → `{ "error": "Conflicto / regla de negocio" }`

### 4.1 Módulo Utilidades

- **Entrada**: `GET /api/health` (sin body)
- **Salida**: `200` con `{ "ok": true, "db": true }`

### 4.2 Módulo Autenticación

- **Entrada**: `POST /api/auth/register`
  - Body: `{ "usuario": "correo", "password": "...", "nombre": "..." }`
- **Salida**:
  - `201` con `{ "ok": true, "message": "Registro satisfactorio", "id_usuario": ..., "usuario": "..." }`

- **Entrada**: `POST /api/auth/login`
  - Body: `{ "usuario": "correo", "password": "..." }`
- **Salida**:
  - `200` con `{ "ok": true, "message": "Autenticación satisfactoria", "user": { ... } }`
  - `401` con `{ "ok": false, "error": "Error en la autenticación" }`

### 4.3 Módulo Libros

- **Entrada**: `GET /api/libros`
- **Salida**: `200` con arreglo de libros.

- **Entrada**: `GET /api/libros/:id`
- **Salida**:
  - `200` con objeto libro.
  - `404` si no existe.

### 4.4 Módulo Carrito

- **Entrada**: `GET /api/carrito?id_usuario=...` (requiere `x-user-id`)
- **Salida**: `200` con arreglo de items.

- **Entrada**: `POST /api/carrito` (requiere `x-user-id`)
  - Body: `{ "id_usuario": ..., "id_libro": ..., "cantidad": ... }`
- **Salida**: `200` con `{ "ok": true }`

- **Entrada**: `POST /api/carrito/checkout` (requiere `x-user-id`)
  - Body: `{ "id_usuario": ... }`
- **Salida**:
  - `200` con `{ "ok": true }`
  - `409` si no hay stock suficiente.

### 4.5 Módulo Compras

- **Entrada**: `GET /api/compras?id_usuario=...` (requiere `x-user-id`)
- **Salida**: `200` con arreglo de compras.

- **Entrada**: `POST /api/compras` (requiere `x-user-id`)
  - Body: `{ "id_usuario": ..., "id_libro": ... }`
- **Salida**:
  - `201` con `{ "id_compra": ... }`
  - `409` si el libro no está disponible para compra.

### 4.6 Módulo Préstamos

- **Entrada**: `GET /api/prestamos?id_usuario=...` (requiere `x-user-id`)
- **Salida**: `200` con arreglo de préstamos.

- **Entrada**: `POST /api/prestamos` (requiere `x-user-id`)
  - Body: `{ "id_usuario": ..., "id_libro": ... }`
- **Salida**:
  - `201` con `{ "id_prestamo": ... }`
  - `409` si el libro no está disponible para préstamo.

- **Entrada**: `POST /api/prestamos/:id/extender` (requiere `x-user-id`)
  - Body: `{ "id_usuario": ... }`
- **Salida**:
  - `200` con `{ "ok": true }`
  - `409` si el préstamo no está activo o supera límite.

- **Entrada**: `POST /api/prestamos/:id/devolver` (solo `ADMIN`)
  - Headers: `x-user-id: <adminId>`
  - Body: `{ "id_usuario": ... }`
- **Salida**:
  - `200` con `{ "ok": true }`

### 4.7 Módulo Administración

- **Entrada**: `GET /api/admin/*` (solo `ADMIN`)
- **Salida**: `200` con datos solicitados.

## 6) Ejecución de pruebas básicas con Cypress (y capturas)

Pasos recomendados para generar evidencia:

1) Levantar el **backend**.
2) Levantar el **frontend**.
3) Ejecutar `npx cypress open`, seleccionar **E2E Testing**.
4) Ejecutar pruebas (specs) y tomar capturas.

Para correr el test de **Admin** (`05-admin-guard.cy.js`) debes pasar variables de entorno a Cypress:

```bash
npm run cy:run:admin
```

O directamente con Cypress:

```bash
npx cypress run --spec "cypress/e2e/05-admin-guard.cy.js" --env ADMIN_EMAIL=admin@mail.com,ADMIN_PASSWORD=123456
```

## 6) Manual técnico (resumen)

### 6.1 Manual técnico de instalación
1) Crear BD y cargar scripts SQL (carpeta `backend/sql/`).
2) Configurar `backend/.env` con credenciales de MySQL.
3) Levantar backend:
   - `npm install`
   - `npm start`
4) Levantar frontend React (opcional si se usa SPA):
   - `npm install`
   - `npm run dev`

### 6.2 Manual técnico de configuración

- Backend:
  - Puerto: `PORT` (por defecto 3000).
  - MySQL: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.
- Frontend:
  - Vite en `5173`.
  - Proxy configurado para consumir `/api` desde el backend.

### 6.3 Manual técnico de operación

- Probar disponibilidad:
  - `GET /api/health`.
- Probar autenticación:
  - `POST /api/auth/register` y `POST /api/auth/login`.
- Probar módulos privados:
  - Agregar `x-user-id` en Postman.

---

# GA8-220501096-AA1-EV01 desarrollar software a partir de la integración de sus módulos componentes

Este proyecto integra módulos de **frontend** (React/HTML) y **backend** (API REST) para un sistema de gestión (biblioteca) con base de datos **MySQL**.

## 1) Mecanismos de seguridad requeridos por la aplicación

- **Autenticación**: el proyecto usa sesión simple desde el frontend mediante `localStorage` y el header `x-user-id`.
- **Autorización por roles**:
  - `ADMIN` (`id_rol = 1`) para rutas `/api/admin/*` y funciones administrativas.
  - `USUARIO` (`id_rol = 2`) para operaciones propias (carrito, préstamos, compras).
- **Protección de recursos**:
  - El backend valida que el usuario exista antes de permitir operaciones privadas.
  - El backend bloquea el servido de archivos sensibles como `.env`, `.sql`, `server.js`, etc.
- **Protección de credenciales**:
  - Las contraseñas se almacenan usando hash con `bcryptjs` (no texto plano).
  - La configuración de conexión a MySQL se gestiona por variables de entorno con `dotenv`.

## 2) Identificar las capas en donde se ubican los componentes

- **Capa de presentación (UI)**:
  - Frontend **React (Vite + Tailwind)** en `frontend/react/`.
  - Frontend **HTML estático** en `frontend/public/` (maqueta original).
- **Capa de aplicación / API**:
  - Backend **Node.js + Express** en `backend/server/server.js` con endpoints `/api/*`.
- **Capa de datos**:
  - **MySQL** (tablas `usuario`, `rol`, `libro`, `carrito_item`, `compra`, `prestamo`, etc.).
- **Capa transversal (cross-cutting)**:
  - Middlewares: `asyncHandler`, `requireAuth`, `requireAdmin`, manejo global de errores.
  - Configuración de entorno y acceso a BD (pool `mysql2/promise`).

## 3) Conocer la metodología de desarrollo de software

- **Levantamiento de requisitos**: historias de usuario (login, catálogo, préstamos, carrito, administración).
- **Diseño**: definición de módulos, rutas UI, endpoints `/api`, modelo de datos y reglas de negocio.
- **Implementación**: desarrollo por módulos (auth, libros, carrito, préstamos, compras, admin).
- **Pruebas**: unitarias y pruebas de integración de endpoints.
- **Despliegue/entrega**: documentación de ambientes y configuración.

## 4) Conocer el mapa de navegación de la aplicación

### 4.1 Navegación del frontend React (rutas SPA)

Rutas definidas en `frontend/react/src/App.jsx`:

- `GET /login`: inicio de sesión.
- `GET /register`: registro.
- `GET /`: inicio/dashboard (redirige a `/login` si no hay sesión).
- `GET /rentable`: dashboard filtrado (protegido por `RequireAuth`).
- `GET /buscar`: búsqueda (protegido por `RequireAuth`).
- `GET /ayuda`: ayuda (protegido por `RequireAuth`).
- `GET /prestamos`: préstamos del usuario (protegido por `RequireAuth`).
- `GET /carrito`: carrito del usuario (protegido por `RequireAuth`).
- `GET /cuenta`: perfil / cuenta (protegido por `RequireAuth`).
- `GET /admin`: panel de administración (protegido por `RequireAdmin`).

### 4.2 Navegación del frontend HTML (maqueta)

El backend sirve archivos estáticos del frontend y redirige `/` a la maqueta (login HTML).

## 5) Codificar cada módulo en el lenguaje seleccionado

- **Backend**: JavaScript (Node.js ESM) + Express.
- **Frontend**: JavaScript/JSX con React.
- **Base de datos**: SQL (scripts en `backend/sql/`).

## 6) Determinar librerías necesarias en cada capa de la aplicación

- **Backend (API)**:
  - `express`: enrutamiento y middleware HTTP.
  - `mysql2`: conexión a MySQL (pool y transacciones).
  - `bcryptjs`: hash/verificación de contraseñas.
  - `dotenv`: variables de entorno.
- **Frontend React (UI)**:
  - `react`, `react-dom`: UI.
  - `react-router-dom`: navegación SPA.
  - `tailwindcss`, `postcss`, `autoprefixer`: estilos.
  - `vite`: tooling de desarrollo/build.

## 7) Determinar los frameworks en cada capa de la aplicación

- **UI**: React (SPA) + TailwindCSS (estilos).
- **API**: Express (Node.js).
- **Datos**: MySQL.

## 8) Dividir el módulo a desarrollar en componentes reutilizables

- **Frontend**: componentes como `Layout`, `RequireAuth`, `RequireAdmin`, tarjetas/listas de libros, modales, formularios.
- **Backend**: endpoints organizados por módulos funcionales (libros, carrito, compras, préstamos, usuarios, administración) y middlewares reutilizables.

## 9) Aplicar buenas prácticas de escritura de código

- Validación de entradas (`body`, `params`, `query`).
- Manejo consistente de errores (HTTP status + JSON de error).
- Uso de transacciones en operaciones críticas (checkout, préstamos, devoluciones).
- Separación de responsabilidades (UI vs API vs BD).
- Uso de variables de entorno para credenciales/configuración.

## 10) Dividir el código fuente en paquetes con nombres de fácil entendimiento

Estructura recomendada (sin cambiar el funcionamiento):

- `backend/`
  - `server/` (arranque/Express)
  - `modules/` (auth, libros, carrito, compras, préstamos, usuarios, admin)
  - `db/` (pool, utilidades)
  - `middleware/` (auth, errores)
- `frontend/react/src/`
  - `pages/` (pantallas)
  - `components/` (componentes reutilizables)
  - `lib/` o `services/` (cliente API, auth)

## 11) Aplicar patrones de diseño de acuerdo con la arquitectura por componente

- **Backend**:
  - Controller/Service/Repository para separar HTTP, negocio y acceso a datos.
  - Middleware para auth/roles y reglas transversales.
  - Transaction Script para operaciones atómicas (checkout / devolución).
- **Frontend**:
  - Composición de componentes.
  - Guards de ruta (`RequireAuth`, `RequireAdmin`).
  - Separación de páginas (pages) vs componentes UI.

## 12) Pruebas unitarias de cada módulo

- **Backend**: pruebas de endpoints y servicios (ej. auth, carrito, préstamos) con herramientas tipo `supertest`.
- **Frontend**: pruebas de componentes/páginas (render, navegación, validaciones) con herramientas tipo React Testing Library.

## 13) Configuraciones de servidores y de bases de datos

- **Servidor backend**: `http://localhost:3000`.
- **Servidor frontend React (Vite)**: `http://localhost:5173` con proxy a `/api` hacia `http://localhost:3000`.
- **Base de datos**: MySQL (config en `backend/.env`): `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.

## 14) Documentar ambientes de desarrollo y pruebas

- **Ambiente de desarrollo**:
  - Backend: `npm install` y `npm start` en `backend/`.
  - Frontend React: `npm install` y `npm run dev` en `frontend/react/`.
- **Ambiente de pruebas**:
  - Base de datos con scripts en `backend/sql/`.
  - Pruebas manuales con Postman y (recomendado) pruebas automatizadas unitarias.

### 14.1 Pruebas manuales con Postman (requests y resultados esperados)

#### 14.1.1 Preparación (Environment recomendado)

Crear un Environment (por ejemplo: `local`) con variables:

- `baseUrl` = `http://localhost:3000`
- `userId` = *(se llena después del login de usuario)*
- `adminId` = *(se llena después del login de un administrador)*

Header importante del proyecto:

- `x-user-id: <id_usuario>`

Reglas esperadas:

- Si llamas un endpoint “privado” sin `x-user-id`:
  - **401** con `{ "error": "No autenticado" }`
- Si llamas un endpoint de admin sin ser admin:
  - **403** con `{ "error": "Solo administradores" }`

#### 14.1.2 Healthcheck

- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/health`

Resultado esperado:

- **200**
- JSON:

```json
{ "ok": true, "db": true }
```

#### 14.1.3 Portadas (covers)

- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/covers`

Resultado esperado:

- **200**
- JSON: arreglo con nombres de archivo (puede estar vacío)

```json
["cien-anos.jpg", "don-quijote.png"]
```

#### 14.1.4 Autenticación (servicio simple)

##### A) Registro exitoso

- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/auth/register`
- **Headers**:
  - `Content-Type: application/json`
- **Body**:

```json
{ "usuario": "prueba@mail.com", "password": "1234", "nombre": "Usuario Prueba" }
```

Resultado esperado:

- **201**

```json
{ "ok": true, "message": "Registro satisfactorio", "id_usuario": 5, "usuario": "prueba@mail.com" }
```

##### B) Registro repetido (usuario ya existe)

- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/auth/register`
- **Body**: mismo del registro

Resultado esperado:

- **409**
- JSON con error indicando que el usuario ya existe

##### C) Login exitoso

- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/auth/login`
- **Headers**:
  - `Content-Type: application/json`
- **Body**:

```json
{ "usuario": "prueba@mail.com", "password": "1234" }
```

Resultado esperado:

- **200**

```json
{
  "ok": true,
  "message": "Autenticación satisfactoria",
  "user": { "id_usuario": 5, "nombre": "Usuario Prueba", "correo": "prueba@mail.com", "id_rol": 2 }
}
```

Acción:

- Copiar `user.id_usuario` y guardarlo en `{{userId}}`.

##### D) Login fallido (credenciales inválidas)

- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/auth/login`
- **Body**:

```json
{ "usuario": "prueba@mail.com", "password": "xxxx" }
```

Resultado esperado:

- **401**

```json
{ "ok": false, "error": "Error en la autenticación" }
```

#### 14.1.5 Catálogo de libros

##### A) Listar libros (público)

- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/libros`

Resultado esperado:

- **200**
- JSON: arreglo de libros

##### B) Listar solo disponibles

- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/libros?disponible=true`

Resultado esperado:

- **200**
- JSON: arreglo filtrado

##### C) Detalle de libro

- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/libros/10`

Resultado esperado:

- **200** si existe
- **404** con `{ "error": "Libro no encontrado" }` si no existe

##### D) Historial de préstamos de un libro (solo ADMIN)

- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/libros/10/historial`
- **Headers**:
  - `x-user-id: {{adminId}}`

Resultado esperado:

- **200** (arreglo)
- **401** si falta `x-user-id`
- **403** si `x-user-id` no es admin

#### 14.1.6 Usuarios / Cuenta (privado)

##### A) Obtener datos de usuario (self o ADMIN)

- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/usuarios/{{userId}}`
- **Headers**:
  - `x-user-id: {{userId}}`

Resultado esperado:

- **200** con datos del usuario
- **401** si falta `x-user-id`
- **403** si intentas consultar otro usuario sin ser admin

##### B) Cambiar contraseña

- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/usuarios/{{userId}}/password`
- **Headers**:
  - `Content-Type: application/json`
  - `x-user-id: {{userId}}`
- **Body** *(ejemplo)*:

```json
{ "current_password": "1234", "new_password": "abcd" }
```

Resultado esperado:

- **200** con `{ "ok": true }` (o respuesta equivalente)
- **400** si faltan campos
- **401/403** según autenticación/autorización

#### 14.1.7 Recuperación de contraseña (demo)

##### A) Solicitar código

- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/password/forgot`
- **Headers**:
  - `Content-Type: application/json`
- **Body**:

```json
{ "correo": "prueba@mail.com" }
```

Resultado esperado:

- **200**

```json
{ "ok": true, "demo_code": "123456", "expires_in_seconds": 600 }
```

##### B) Restablecer contraseña

- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/password/reset`
- **Headers**:
  - `Content-Type: application/json`
- **Body**:

```json
{ "correo": "prueba@mail.com", "code": "123456", "new_password": "abcd" }
```

Resultado esperado:

- **200** con `{ "ok": true }`
- **400** si el código es inválido/expiró
- **401** si el código es incorrecto

#### 14.1.8 Carrito (privado)

##### A) Ver carrito

- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/carrito?id_usuario={{userId}}`
- **Headers**:
  - `x-user-id: {{userId}}`

Resultado esperado:

- **200** con arreglo (vacío o con items)

##### B) Agregar al carrito

- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/carrito`
- **Headers**:
  - `Content-Type: application/json`
  - `x-user-id: {{userId}}`
- **Body**:

```json
{ "id_usuario": {{userId}}, "id_libro": 10, "cantidad": 2 }
```

Resultado esperado:

- **200** con `{ "ok": true }`
- **400** si falta `id_usuario`, `id_libro` o cantidad inválida
- **403** si `id_usuario` no coincide con `x-user-id` (y no eres admin)

##### C) Eliminar item del carrito

- **Method**: `DELETE`
- **URL**: `{{baseUrl}}/api/carrito/10?id_usuario={{userId}}`
- **Headers**:
  - `x-user-id: {{userId}}`

Resultado esperado:

- **200** con `{ "ok": true }`
- **400** si faltan ids

##### D) Checkout del carrito

- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/carrito/checkout`
- **Headers**:
  - `Content-Type: application/json`
  - `x-user-id: {{userId}}`
- **Body**:

```json
{ "id_usuario": {{userId}} }
```

Resultado esperado:

- **200** con `{ "ok": true }`
- **400** si el carrito está vacío
- **409** si hay stock insuficiente

#### 14.1.9 Compras (privado)

##### A) Listar compras del usuario

- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/compras?id_usuario={{userId}}`
- **Headers**:
  - `x-user-id: {{userId}}`

Resultado esperado:

- **200** con arreglo de compras
- **400** si no envías `id_usuario`
- **403** si `id_usuario` no coincide con `x-user-id` (y no eres admin)

##### B) Compra puntual (1 libro)

- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/compras`
- **Headers**:
  - `Content-Type: application/json`
  - `x-user-id: {{userId}}`
- **Body**:

```json
{ "id_usuario": {{userId}}, "id_libro": 10 }
```

Resultado esperado:

- **201** con `{ "id_compra": 123 }`
- **404** si usuario o libro no existen
- **409** si el libro no está disponible para compra

#### 14.1.10 Préstamos (privado) y devoluciones (solo ADMIN)

##### A) Listar préstamos del usuario

- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/prestamos?id_usuario={{userId}}`
- **Headers**:
  - `x-user-id: {{userId}}`

Resultado esperado:

- **200** con arreglo de préstamos

##### B) Crear préstamo

- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/prestamos`
- **Headers**:
  - `Content-Type: application/json`
  - `x-user-id: {{userId}}`
- **Body**:

```json
{ "id_usuario": {{userId}}, "id_libro": 10 }
```

Resultado esperado:

- **201** con `{ "id_prestamo": 123 }`
- **404** si usuario o libro no existen
- **409** si el libro no está disponible para préstamo

##### C) Extender préstamo (self o admin)

- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/prestamos/123/extender`
- **Headers**:
  - `Content-Type: application/json`
  - `x-user-id: {{userId}}`
- **Body**:

```json
{ "id_usuario": {{userId}} }
```

Resultado esperado:

- **200** con `{ "ok": true }`
- **404** si el préstamo no existe
- **409** si no está activo o se alcanza límite de extensiones

##### D) Devolver préstamo (solo ADMIN)

- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/prestamos/123/devolver`
- **Headers**:
  - `Content-Type: application/json`
  - `x-user-id: {{adminId}}`
- **Body**:

```json
{ "id_usuario": {{userId}} }
```

Resultado esperado:

- **200** con `{ "ok": true }`
- **401** si falta `x-user-id`
- **403** si no es admin
- **404** si el préstamo no existe
- **409** si ya fue devuelto

#### 14.1.11 Administración (solo ADMIN)

##### A) Listar categorías

- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/admin/categorias`
- **Headers**:
  - `x-user-id: {{adminId}}`

Resultado esperado:

- **200** con arreglo de categorías

##### B) Listar libros (admin)

- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/admin/libros`
- **Headers**:
  - `x-user-id: {{adminId}}`

Resultado esperado:

- **200** con arreglo de libros

##### C) Crear libro

- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/admin/libros`
- **Headers**:
  - `Content-Type: application/json`
  - `x-user-id: {{adminId}}`
- **Body** *(ejemplo básico)*:

```json
{ "titulo": "Libro X", "autor": "Autor Y", "descripcion": "...", "stock_compra": 2, "stock_renta": 1, "valor": 35000, "id_categoria": 1 }
```

Resultado esperado:

- **201** con `{ "id_libro": 10 }` (o id equivalente)
- **400** si faltan campos obligatorios

##### D) Editar libro (PATCH)

- **Method**: `PATCH`
- **URL**: `{{baseUrl}}/api/admin/libros/10`
- **Headers**:
  - `Content-Type: application/json`
  - `x-user-id: {{adminId}}`
- **Body** *(ejemplo)*:

```json
{ "stock_compra": 5 }
```

Resultado esperado:

- **200** (respuesta de éxito)
- **400** si el id es inválido

##### E) Eliminar libro

- **Method**: `DELETE`
- **URL**: `{{baseUrl}}/api/admin/libros/10`
- **Headers**:
  - `x-user-id: {{adminId}}`

Resultado esperado:

- **200** (o **204**) según implementación

##### F) Endpoints admin adicionales

También se pueden probar (según lo expuesto por la API):

- `GET {{baseUrl}}/api/admin/usuarios`
- `POST {{baseUrl}}/api/admin/usuarios`
- `PATCH {{baseUrl}}/api/admin/usuarios/:id`
- `PATCH {{baseUrl}}/api/admin/usuarios/:id/rol`
- `DELETE {{baseUrl}}/api/admin/usuarios/:id`
- `GET {{baseUrl}}/api/admin/prestamos`

Resultados esperados:

- **200/201** si `x-user-id` corresponde a `ADMIN`
- **401** si falta `x-user-id`
- **403** si no es admin

#### 14.1.12 Validación de endpoint inexistente

- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/esto-no-existe`

Resultado esperado:

- **404**

```json
{ "error": "Endpoint no encontrado" }
```

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
