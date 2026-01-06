USE tugestionamiga_db;

SET @db := DATABASE();

SET @has_stock := (
  SELECT COUNT(*)
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @db
     AND TABLE_NAME = 'libro'
     AND COLUMN_NAME = 'stock'
);

SET @has_valor := (
  SELECT COUNT(*)
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @db
     AND TABLE_NAME = 'libro'
     AND COLUMN_NAME = 'valor'
);

SET @has_stock_compra := (
  SELECT COUNT(*)
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @db
     AND TABLE_NAME = 'libro'
     AND COLUMN_NAME = 'stock_compra'
);

SET @has_stock_renta := (
  SELECT COUNT(*)
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @db
     AND TABLE_NAME = 'libro'
     AND COLUMN_NAME = 'stock_renta'
);

SET @cat_tecnologia := (SELECT id_categoria FROM categoria WHERE nombre_categoria = 'Tecnología' LIMIT 1);
SET @cat_novela := (SELECT id_categoria FROM categoria WHERE nombre_categoria = 'Novela' LIMIT 1);
SET @cat_fantasia := (SELECT id_categoria FROM categoria WHERE nombre_categoria = 'Fantasía' LIMIT 1);
SET @cat_historia := (SELECT id_categoria FROM categoria WHERE nombre_categoria = 'Historia' LIMIT 1);

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

SET @cat_tecnologia := (SELECT id_categoria FROM categoria WHERE nombre_categoria = 'Tecnología' LIMIT 1);
SET @cat_novela := (SELECT id_categoria FROM categoria WHERE nombre_categoria = 'Novela' LIMIT 1);
SET @cat_fantasia := (SELECT id_categoria FROM categoria WHERE nombre_categoria = 'Fantasía' LIMIT 1);
SET @cat_historia := (SELECT id_categoria FROM categoria WHERE nombre_categoria = 'Historia' LIMIT 1);

SET @book_cols := 'titulo, autor, descripcion, disponibilidad, id_categoria';

SET @book_cols := IF(@has_stock > 0, CONCAT(@book_cols, ', stock'), @book_cols);
SET @book_cols := IF(@has_stock_compra > 0, CONCAT(@book_cols, ', stock_compra'), @book_cols);
SET @book_cols := IF(@has_stock_renta > 0, CONCAT(@book_cols, ', stock_renta'), @book_cols);
SET @book_cols := IF(@has_valor > 0, CONCAT(@book_cols, ', valor'), @book_cols);

SET @titulo := 'Clean Code';
SET @autor := 'Robert C. Martin';
SET @descripcion := 'Buenas prácticas de programación y código mantenible.';
SET @stock := 5;
SET @valor := 45000.00;
SET @sql := CONCAT(
  'INSERT INTO libro (', @book_cols, ') ',
  'SELECT ', QUOTE(@titulo), ', ', QUOTE(@autor), ', ', QUOTE(@descripcion), ', 1, ', @cat_tecnologia,
  IF(@has_stock > 0, CONCAT(', ', @stock), ''),
  IF(@has_stock_compra > 0, CONCAT(', ', @stock), ''),
  IF(@has_stock_renta > 0, CONCAT(', ', @stock), ''),
  IF(@has_valor > 0, CONCAT(', ', @valor), ''),
  ' WHERE NOT EXISTS (SELECT 1 FROM libro WHERE titulo = ', QUOTE(@titulo), ' LIMIT 1)'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @titulo := 'El Principito';
SET @autor := 'Antoine de Saint-Exupéry';
SET @descripcion := 'Una historia clásica para probar compra y préstamo.';
SET @stock := 3;
SET @valor := 28000.00;
SET @sql := CONCAT(
  'INSERT INTO libro (', @book_cols, ') ',
  'SELECT ', QUOTE(@titulo), ', ', QUOTE(@autor), ', ', QUOTE(@descripcion), ', 1, ', @cat_novela,
  IF(@has_stock > 0, CONCAT(', ', @stock), ''),
  IF(@has_stock_compra > 0, CONCAT(', ', @stock), ''),
  IF(@has_stock_renta > 0, CONCAT(', ', @stock), ''),
  IF(@has_valor > 0, CONCAT(', ', @valor), ''),
  ' WHERE NOT EXISTS (SELECT 1 FROM libro WHERE titulo = ', QUOTE(@titulo), ' LIMIT 1)'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @titulo := 'Harry Potter y la piedra filosofal';
SET @autor := 'J. K. Rowling';
SET @descripcion := 'Libro de fantasía para probar disponibilidad, préstamo y devolución.';
SET @stock := 2;
SET @valor := 52000.00;
SET @sql := CONCAT(
  'INSERT INTO libro (', @book_cols, ') ',
  'SELECT ', QUOTE(@titulo), ', ', QUOTE(@autor), ', ', QUOTE(@descripcion), ', 1, ', @cat_fantasia,
  IF(@has_stock > 0, CONCAT(', ', @stock), ''),
  IF(@has_stock_compra > 0, CONCAT(', ', @stock), ''),
  IF(@has_stock_renta > 0, CONCAT(', ', @stock), ''),
  IF(@has_valor > 0, CONCAT(', ', @valor), ''),
  ' WHERE NOT EXISTS (SELECT 1 FROM libro WHERE titulo = ', QUOTE(@titulo), ' LIMIT 1)'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @titulo := 'Sapiens: De animales a dioses';
SET @autor := 'Yuval Noah Harari';
SET @descripcion := 'Historia y evolución humana para pruebas de catálogo.';
SET @stock := 4;
SET @valor := 60000.00;
SET @sql := CONCAT(
  'INSERT INTO libro (', @book_cols, ') ',
  'SELECT ', QUOTE(@titulo), ', ', QUOTE(@autor), ', ', QUOTE(@descripcion), ', 1, ', @cat_historia,
  IF(@has_stock > 0, CONCAT(', ', @stock), ''),
  IF(@has_stock_compra > 0, CONCAT(', ', @stock), ''),
  IF(@has_stock_renta > 0, CONCAT(', ', @stock), ''),
  IF(@has_valor > 0, CONCAT(', ', @valor), ''),
  ' WHERE NOT EXISTS (SELECT 1 FROM libro WHERE titulo = ', QUOTE(@titulo), ' LIMIT 1)'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Libros que hacen match con portadas locales (frontend/public/src/assets/images)
-- Nota: el matching del frontend normaliza acentos/espacios y filtra palabras comunes.
-- Por eso los títulos aquí se dejan iguales (o muy cercanos) al nombre del archivo.

SET @titulo := 'Fundamentos de  java';
SET @autor := 'Autor de ejemplo';
SET @descripcion := 'Libro de ejemplo para verificar el match de portada local (Fundamentos de  java.jpg).';
SET @stock := 6;
SET @valor := 35000.00;
SET @sql := CONCAT(
  'INSERT INTO libro (', @book_cols, ') ',
  'SELECT ', QUOTE(@titulo), ', ', QUOTE(@autor), ', ', QUOTE(@descripcion), ', 1, ', @cat_tecnologia,
  IF(@has_stock > 0, CONCAT(', ', @stock), ''),
  IF(@has_stock_compra > 0, CONCAT(', ', @stock), ''),
  IF(@has_stock_renta > 0, CONCAT(', ', @stock), ''),
  IF(@has_valor > 0, CONCAT(', ', @valor), ''),
  ' WHERE NOT EXISTS (SELECT 1 FROM libro WHERE titulo = ', QUOTE(@titulo), ' LIMIT 1)'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @titulo := 'Java Avanzado';
SET @autor := 'Autor de ejemplo';
SET @descripcion := 'Libro de ejemplo para verificar el match de portada local (Java Avanzado.jpg).';
SET @stock := 6;
SET @valor := 42000.00;
SET @sql := CONCAT(
  'INSERT INTO libro (', @book_cols, ') ',
  'SELECT ', QUOTE(@titulo), ', ', QUOTE(@autor), ', ', QUOTE(@descripcion), ', 1, ', @cat_tecnologia,
  IF(@has_stock > 0, CONCAT(', ', @stock), ''),
  IF(@has_stock_compra > 0, CONCAT(', ', @stock), ''),
  IF(@has_stock_renta > 0, CONCAT(', ', @stock), ''),
  IF(@has_valor > 0, CONCAT(', ', @valor), ''),
  ' WHERE NOT EXISTS (SELECT 1 FROM libro WHERE titulo = ', QUOTE(@titulo), ' LIMIT 1)'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @titulo := 'Java para Principiantes';
SET @autor := 'Autor de ejemplo';
SET @descripcion := 'Libro de ejemplo para verificar el match de portada local (Java para Principiantes.jpg).';
SET @stock := 6;
SET @valor := 30000.00;
SET @sql := CONCAT(
  'INSERT INTO libro (', @book_cols, ') ',
  'SELECT ', QUOTE(@titulo), ', ', QUOTE(@autor), ', ', QUOTE(@descripcion), ', 1, ', @cat_tecnologia,
  IF(@has_stock > 0, CONCAT(', ', @stock), ''),
  IF(@has_stock_compra > 0, CONCAT(', ', @stock), ''),
  IF(@has_stock_renta > 0, CONCAT(', ', @stock), ''),
  IF(@has_valor > 0, CONCAT(', ', @valor), ''),
  ' WHERE NOT EXISTS (SELECT 1 FROM libro WHERE titulo = ', QUOTE(@titulo), ' LIMIT 1)'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
