USE tugestionamiga_db;

-- ==========================================================
-- seed_admin_and_books.sql
--
-- Objetivo:
-- - Asegurar roles (ADMIN=1, USUARIO=2)
-- - Crear/actualizar un usuario administrador
-- - Insertar categorías y libros de ejemplo
--
-- Importante (contraseñas):
-- - El backend valida con bcrypt.
-- - Por eso, en la columna `usuario`.`contraseña` se debe guardar un HASH bcrypt.
-- - Este script NO puede generar bcrypt dentro de MySQL.
-- - Debes reemplazar el placeholder por el hash generado con Node.
--
-- Generar hash (ejemplo):
--   node -e "const bcrypt=require('bcryptjs'); console.log(bcrypt.hashSync('admin123',10));"
--
-- Luego pega el resultado en ADMIN_PASSWORD_HASH.
-- ==========================================================

-- Roles esperados por el sistema
INSERT INTO rol (id_rol, nombre_rol)
VALUES (1, 'ADMIN')
ON DUPLICATE KEY UPDATE nombre_rol = VALUES(nombre_rol);

INSERT INTO rol (id_rol, nombre_rol)
VALUES (2, 'USUARIO')
ON DUPLICATE KEY UPDATE nombre_rol = VALUES(nombre_rol);

-- Admin (cambia el hash por uno real bcrypt)
SET @ADMIN_EMAIL := 'admin@mail.com';
SET @ADMIN_NAME := 'Administrador';
SET @ADMIN_PASSWORD_HASH := 'REEMPLAZA_ESTE_TEXTO_POR_HASH_BCRYPT';

INSERT INTO usuario (nombre, correo, `contraseña`, id_rol)
VALUES (@ADMIN_NAME, @ADMIN_EMAIL, @ADMIN_PASSWORD_HASH, 1)
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  `contraseña` = VALUES(`contraseña`),
  id_rol = 1;

-- Categorías (si ya existen, no se duplican)
INSERT INTO categoria (nombre_categoria)
SELECT 'Tecnología'
WHERE NOT EXISTS (SELECT 1 FROM categoria WHERE nombre_categoria = 'Tecnología' LIMIT 1);

INSERT INTO categoria (nombre_categoria)
SELECT 'Novela'
WHERE NOT EXISTS (SELECT 1 FROM categoria WHERE nombre_categoria = 'Novela' LIMIT 1);

INSERT INTO categoria (nombre_categoria)
SELECT 'Fantasía'
WHERE NOT EXISTS (SELECT 1 FROM categoria WHERE nombre_categoria = 'Fantasía' LIMIT 1);

INSERT INTO categoria (nombre_categoria)
SELECT 'Historia'
WHERE NOT EXISTS (SELECT 1 FROM categoria WHERE nombre_categoria = 'Historia' LIMIT 1);

-- IDs de categorías
SET @CAT_TECNOLOGIA := (SELECT id_categoria FROM categoria WHERE nombre_categoria = 'Tecnología' LIMIT 1);
SET @CAT_NOVELA := (SELECT id_categoria FROM categoria WHERE nombre_categoria = 'Novela' LIMIT 1);
SET @CAT_FANTASIA := (SELECT id_categoria FROM categoria WHERE nombre_categoria = 'Fantasía' LIMIT 1);
SET @CAT_HISTORIA := (SELECT id_categoria FROM categoria WHERE nombre_categoria = 'Historia' LIMIT 1);

-- Compatibilidad: algunos dumps traen `stock` y otros no.
SET @DB := DATABASE();
SET @HAS_STOCK := (
  SELECT COUNT(*)
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @DB
     AND TABLE_NAME = 'libro'
     AND COLUMN_NAME = 'stock'
);

SET @HAS_VALOR := (
  SELECT COUNT(*)
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @DB
     AND TABLE_NAME = 'libro'
     AND COLUMN_NAME = 'valor'
);

SET @HAS_STOCK_COMPRA := (
  SELECT COUNT(*)
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @DB
     AND TABLE_NAME = 'libro'
     AND COLUMN_NAME = 'stock_compra'
);

SET @HAS_STOCK_RENTA := (
  SELECT COUNT(*)
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @DB
     AND TABLE_NAME = 'libro'
     AND COLUMN_NAME = 'stock_renta'
);

-- Inserción dinámica de libros (para soportar stock o no)
SET @BOOK_COLS := 'titulo, autor, descripcion, disponibilidad, id_categoria';
SET @BOOK_COLS := IF(@HAS_STOCK > 0, CONCAT(@BOOK_COLS, ', stock'), @BOOK_COLS);
SET @BOOK_COLS := IF(@HAS_STOCK_COMPRA > 0, CONCAT(@BOOK_COLS, ', stock_compra'), @BOOK_COLS);
SET @BOOK_COLS := IF(@HAS_STOCK_RENTA > 0, CONCAT(@BOOK_COLS, ', stock_renta'), @BOOK_COLS);
SET @BOOK_COLS := IF(@HAS_VALOR > 0, CONCAT(@BOOK_COLS, ', valor'), @BOOK_COLS);

-- Libro 1
SET @TITULO := 'Clean Code';
SET @AUTOR := 'Robert C. Martin';
SET @DESCRIPCION := 'Buenas prácticas de programación y código mantenible.';
SET @STOCK := 5;
SET @VALOR := 45000.00;
SET @SQL := CONCAT(
  'INSERT INTO libro (', @BOOK_COLS, ') ',
  'SELECT ', QUOTE(@TITULO), ', ', QUOTE(@AUTOR), ', ', QUOTE(@DESCRIPCION), ', 1, ', @CAT_TECNOLOGIA,
  IF(@HAS_STOCK > 0, CONCAT(', ', @STOCK), ''),
  IF(@HAS_STOCK_COMPRA > 0, CONCAT(', ', @STOCK), ''),
  IF(@HAS_STOCK_RENTA > 0, CONCAT(', ', @STOCK), ''),
  IF(@HAS_VALOR > 0, CONCAT(', ', @VALOR), ''),
  ' WHERE NOT EXISTS (SELECT 1 FROM libro WHERE titulo = ', QUOTE(@TITULO), ' LIMIT 1)'
);
PREPARE stmt FROM @SQL;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Libro 2
SET @TITULO := 'El Principito';
SET @AUTOR := 'Antoine de Saint-Exupéry';
SET @DESCRIPCION := 'Una historia clásica para probar compra y préstamo.';
SET @STOCK := 3;
SET @VALOR := 28000.00;
SET @SQL := CONCAT(
  'INSERT INTO libro (', @BOOK_COLS, ') ',
  'SELECT ', QUOTE(@TITULO), ', ', QUOTE(@AUTOR), ', ', QUOTE(@DESCRIPCION), ', 1, ', @CAT_NOVELA,
  IF(@HAS_STOCK > 0, CONCAT(', ', @STOCK), ''),
  IF(@HAS_STOCK_COMPRA > 0, CONCAT(', ', @STOCK), ''),
  IF(@HAS_STOCK_RENTA > 0, CONCAT(', ', @STOCK), ''),
  IF(@HAS_VALOR > 0, CONCAT(', ', @VALOR), ''),
  ' WHERE NOT EXISTS (SELECT 1 FROM libro WHERE titulo = ', QUOTE(@TITULO), ' LIMIT 1)'
);
PREPARE stmt FROM @SQL;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Libro 3
SET @TITULO := 'Harry Potter y la piedra filosofal';
SET @AUTOR := 'J. K. Rowling';
SET @DESCRIPCION := 'Libro de fantasía para probar disponibilidad, préstamo y devolución.';
SET @STOCK := 2;
SET @VALOR := 52000.00;
SET @SQL := CONCAT(
  'INSERT INTO libro (', @BOOK_COLS, ') ',
  'SELECT ', QUOTE(@TITULO), ', ', QUOTE(@AUTOR), ', ', QUOTE(@DESCRIPCION), ', 1, ', @CAT_FANTASIA,
  IF(@HAS_STOCK > 0, CONCAT(', ', @STOCK), ''),
  IF(@HAS_STOCK_COMPRA > 0, CONCAT(', ', @STOCK), ''),
  IF(@HAS_STOCK_RENTA > 0, CONCAT(', ', @STOCK), ''),
  IF(@HAS_VALOR > 0, CONCAT(', ', @VALOR), ''),
  ' WHERE NOT EXISTS (SELECT 1 FROM libro WHERE titulo = ', QUOTE(@TITULO), ' LIMIT 1)'
);
PREPARE stmt FROM @SQL;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Libro 4
SET @TITULO := 'Sapiens: De animales a dioses';
SET @AUTOR := 'Yuval Noah Harari';
SET @DESCRIPCION := 'Historia y evolución humana para pruebas de catálogo.';
SET @STOCK := 4;
SET @VALOR := 60000.00;
SET @SQL := CONCAT(
  'INSERT INTO libro (', @BOOK_COLS, ') ',
  'SELECT ', QUOTE(@TITULO), ', ', QUOTE(@AUTOR), ', ', QUOTE(@DESCRIPCION), ', 1, ', @CAT_HISTORIA,
  IF(@HAS_STOCK > 0, CONCAT(', ', @STOCK), ''),
  IF(@HAS_STOCK_COMPRA > 0, CONCAT(', ', @STOCK), ''),
  IF(@HAS_STOCK_RENTA > 0, CONCAT(', ', @STOCK), ''),
  IF(@HAS_VALOR > 0, CONCAT(', ', @VALOR), ''),
  ' WHERE NOT EXISTS (SELECT 1 FROM libro WHERE titulo = ', QUOTE(@TITULO), ' LIMIT 1)'
);
PREPARE stmt FROM @SQL;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
