describe('Flujos extra (E2E)', () => {
  beforeEach(() => {
    cy.clearAuthUser();
  });

  it('Logout: al cerrar sesión debe ir a /login y bloquear rutas protegidas', () => {
    cy.createAndLoginTestUser().then(() => {
      cy.visit('/');
      cy.contains('Bienvenido').should('be.visible');

      cy.contains('button', 'Cerrar Sesión').click();
      cy.url().should('include', '/login');

      cy.visit('/prestamos');
      cy.url().should('include', '/login');
    });
  });

  it('Redirect post-login: si intentas entrar a /carrito sin sesión, al loguearte debes volver a /carrito', () => {
    cy.visit('/carrito');
    cy.url().should('include', '/login');

    cy.createAndLoginTestUser().then(({ correo, password }) => {
      cy.visit('/login');

      cy.get('input[placeholder="ejemplo@correo.com"]').clear().type(correo);
      cy.get('input[placeholder="Contraseña"]').clear().type(password);
      cy.contains('button', 'Ingresar').click();

      cy.url().should('include', '/carrito');
      cy.contains('Carrito').should('be.visible');
    });
  });

  it('Sidebar: usuario normal no debe ver link Administrador; admin sí (opcional con env vars)', () => {
    cy.createAndLoginTestUser().then(() => {
      cy.visit('/');
      cy.get('#sidebar').within(() => {
        cy.contains('Administrador').should('not.exist');
      });

      const correo = Cypress.env('ADMIN_EMAIL');
      const password = Cypress.env('ADMIN_PASSWORD');
      if (!correo || !password) {
        return;
      }

      cy.loginByApi({ correo, password }).then((user) => {
        cy.setAuthUser(user);
        cy.visit('/');
        cy.get('#sidebar').within(() => {
          cy.contains('Administrador').should('be.visible');
        });
      });
    });
  });
});
