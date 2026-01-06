/*
  main.jsx

  Punto de entrada del frontend React (Vite).

  ¿Por qué existe?
  - Vite necesita un archivo que inicialice React y lo monte en el DOM.
  - Aquí se define el root de React y se conecta el Router.

  ¿Para qué sirve?
  - Monta el componente App dentro del elemento <div id="root"> del index.html de Vite.
  - Habilita navegación por rutas con BrowserRouter.
*/

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
