/*
  Ayuda.jsx

  Pantalla informativa con instrucciones rápidas de uso.

  ¿Por qué existe?
  - Reduce fricción al probar el sistema (login, prestar, comprar, etc.).
  - Reemplaza el enfoque de "documentación suelta" dentro de la UI por una pantalla dedicada.

  ¿Para qué sirve?
  - Mostrar preguntas frecuentes y pasos básicos para validar funcionalidades.
*/

import React from 'react';

export default function Ayuda() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">Ayuda</h2>
        <p className="mt-2 text-sm text-gray-600">
          Aquí encuentras una guía rápida para usar el sistema y probar las funciones principales.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900">Cómo iniciar sesión</h3>
          <p className="mt-2 text-sm text-gray-700">
            Si no tienes cuenta, usa la opción de <span className="font-semibold">Registro</span>. Luego ingresa con tu correo
            y contraseña.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900">Cómo ver libros disponibles (Rentable)</h3>
          <p className="mt-2 text-sm text-gray-700">
            En <span className="font-semibold">Inicio</span> puedes usar la pestaña <span className="font-semibold">Rentable</span>{' '}
            (al lado de <span className="font-semibold">Comprar</span>) para filtrar los libros que están disponibles.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900">Cómo prestar un libro</h3>
          <p className="mt-2 text-sm text-gray-700">
            En una tarjeta de libro, pulsa <span className="font-semibold">Rentar</span>. Luego revisa la sección{' '}
            <span className="font-semibold">Préstamos</span> para ver el registro y usar la opción <span className="font-semibold">Devolver</span>.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900">Cómo comprar un libro</h3>
          <p className="mt-2 text-sm text-gray-700">
            En una tarjeta de libro, pulsa <span className="font-semibold">Comprar</span> para agregarlo al <span className="font-semibold">Carrito</span>.
            Luego entra a <span className="font-semibold">Carrito</span> y confirma con <span className="font-semibold">Comprar</span> (checkout).
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900">Si no aparecen libros</h3>
        <p className="mt-2 text-sm text-gray-700">
          Carga datos de ejemplo en MySQL usando <span className="font-mono">backend/sql/seed_demo_data.sql</span> y recarga la página.
        </p>
      </div>
    </div>
  );
}
