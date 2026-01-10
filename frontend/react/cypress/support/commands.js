// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })

const AUTH_STORAGE_KEY = 'tga_auth_user';

Cypress.Commands.add('setAuthUser', (user) => {
  return cy.window({ log: false }).then((win) => {
    win.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  });
});

Cypress.Commands.add('clearAuthUser', () => {
  return cy.window({ log: false }).then((win) => {
    win.localStorage.removeItem(AUTH_STORAGE_KEY);
  });
});

Cypress.Commands.add('registerByApi', ({ nombre, correo, password }) => {
  return cy
    .request({
      method: 'POST',
      url: '/api/register',
      body: { nombre, correo, password },
      failOnStatusCode: false
    })
    .then((res) => {
      if (res.status !== 200 && res.status !== 201) {
        throw new Error(`No se pudo registrar (HTTP ${res.status})`);
      }
      return res.body;
    });
});

Cypress.Commands.add('loginByApi', ({ correo, password }) => {
  return cy
    .request({
      method: 'POST',
      url: '/api/login',
      body: { correo, password },
      failOnStatusCode: false
    })
    .then((res) => {
      if (res.status !== 200) {
        throw new Error(`No se pudo iniciar sesión (HTTP ${res.status})`);
      }
      return res.body;
    });
});

Cypress.Commands.add('createAndLoginTestUser', () => {
  const stamp = Date.now();
  const creds = {
    nombre: `Usuario Cypress ${stamp}`,
    correo: `cypress_${stamp}@mail.com`,
    password: '1234'
  };

  return cy
    .registerByApi(creds)
    .then(() => cy.loginByApi({ correo: creds.correo, password: creds.password }))
    .then((user) => {
      return cy.setAuthUser(user).then(() => ({ ...creds, user }));
    });
});

Cypress.Commands.add('apiAddToCart', ({ user, id_libro, cantidad = 1 }) => {
  return cy.request({
    method: 'POST',
    url: '/api/carrito',
    headers: { 'x-user-id': String(user.id_usuario) },
    body: { id_usuario: user.id_usuario, id_libro, cantidad },
    failOnStatusCode: false
  });
});

Cypress.Commands.add('apiCreateLoan', ({ user, id_libro }) => {
  return cy.request({
    method: 'POST',
    url: '/api/prestamos',
    headers: { 'x-user-id': String(user.id_usuario) },
    body: { id_usuario: user.id_usuario, id_libro },
    failOnStatusCode: false
  });
});