CREATE DATABASE  IF NOT EXISTS `tugestionamiga_db` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `tugestionamiga_db`;

-- ------------------------------------------------------
-- Table structure for table `carrito_item`
--
-- Objetivo:
-- - Guardar los libros agregados al carrito por usuario.
-- - Mantener persistencia (si el usuario cierra la sesión o recarga el navegador).
-- - La PK compuesta evita duplicados (mismo libro para el mismo usuario).
-- ------------------------------------------------------

CREATE TABLE IF NOT EXISTS `carrito_item` (
  `id_usuario` int NOT NULL,
  `id_libro` int NOT NULL,
  `cantidad` int NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_usuario`,`id_libro`),
  KEY `id_libro` (`id_libro`),
  CONSTRAINT `carrito_item_ibfk_1` FOREIGN KEY (`id_usuario`) REFERENCES `usuario` (`id_usuario`),
  CONSTRAINT `carrito_item_ibfk_2` FOREIGN KEY (`id_libro`) REFERENCES `libro` (`id_libro`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
