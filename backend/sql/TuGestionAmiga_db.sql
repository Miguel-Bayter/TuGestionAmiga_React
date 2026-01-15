CREATE DATABASE IF NOT EXISTS tugestionamiga_db;
USE tugestionamiga_db;

CREATE TABLE rol (
  id_rol INT AUTO_INCREMENT PRIMARY KEY,
  nombre_rol VARCHAR(50) NOT NULL UNIQUE
);

INSERT INTO rol (id_rol, nombre_rol)
VALUES (1, 'ADMIN')
ON DUPLICATE KEY UPDATE nombre_rol = VALUES(nombre_rol);

INSERT INTO rol (id_rol, nombre_rol)
VALUES (2, 'USUARIO')
ON DUPLICATE KEY UPDATE nombre_rol = VALUES(nombre_rol);

CREATE TABLE usuario (
  id_usuario INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  correo VARCHAR(100) NOT NULL UNIQUE,
  `contraseña` VARCHAR(255) NOT NULL,
  id_rol INT,
  FOREIGN KEY (id_rol) REFERENCES rol(id_rol)
);

CREATE TABLE categoria (
  id_categoria INT AUTO_INCREMENT PRIMARY KEY,
  nombre_categoria VARCHAR(100) NOT NULL
);

INSERT INTO categoria (nombre_categoria) VALUES
  ('Novela'),
  ('Ciencia ficción'),
  ('Fantasía'),
  ('Historia'),
  ('Tecnología'),
  ('Biografía'),
  ('Infantil'),
  ('Terror'),
  ('Romance'),
  ('Poesía');

CREATE TABLE libro (
  id_libro INT AUTO_INCREMENT PRIMARY KEY,
  titulo VARCHAR(150) NOT NULL,
  autor VARCHAR(100) NOT NULL,
  descripcion TEXT,
  stock INT NOT NULL DEFAULT 0,
  stock_compra INT NOT NULL DEFAULT 0,
  stock_renta INT NOT NULL DEFAULT 0,
  valor DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  disponibilidad BOOLEAN NOT NULL DEFAULT 0,
  id_categoria INT,
  FOREIGN KEY (id_categoria) REFERENCES categoria(id_categoria)
);

CREATE TABLE prestamo (
  id_prestamo INT AUTO_INCREMENT PRIMARY KEY,
  fecha_prestamo DATE NOT NULL,
  fecha_devolucion DATE NOT NULL,
  fecha_devolucion_real DATE NULL,
  estado VARCHAR(50) NOT NULL,
  extensiones INT NOT NULL DEFAULT 0,
  id_usuario INT,
  id_libro INT,
  FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario),
  FOREIGN KEY (id_libro) REFERENCES libro(id_libro)
);

CREATE TABLE IF NOT EXISTS carrito_item (
  id_usuario INT NOT NULL,
  id_libro INT NOT NULL,
  cantidad INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_usuario, id_libro),
  FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario),
  FOREIGN KEY (id_libro) REFERENCES libro(id_libro)
);

CREATE TABLE compra (
  id_compra INT AUTO_INCREMENT PRIMARY KEY,
  fecha_compra DATE NOT NULL,
  precio DECIMAL(10,2) NOT NULL,
  id_usuario INT,
  id_libro INT,
  FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario),
  FOREIGN KEY (id_libro) REFERENCES libro(id_libro)
);


