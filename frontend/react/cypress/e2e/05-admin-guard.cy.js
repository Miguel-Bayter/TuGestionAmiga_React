describe('Admin (guard)', () => {
  it('Usuario NO admin: entrar a /admin debe redirigir al inicio', () => {
    cy.createAndLoginTestUser().then(() => {
      cy.visit('/admin');
      cy.url().should('eq', `${Cypress.config('baseUrl')}/`);
      cy.contains('Bienvenido').should('be.visible');
    });
  });

  it('Admin (opcional): si configuras credenciales, debe mostrar el panel Administrador', () => {
    const correo = Cypress.env('ADMIN_EMAIL');
    const password = Cypress.env('ADMIN_PASSWORD');

    if (!correo || !password) {
      return;
    }

    cy.loginByApi({ correo, password }).then((user) => {
      cy.setAuthUser(user);
      cy.visit('/admin');
      cy.contains('Administrador').should('be.visible');
      cy.contains('Libros').should('be.visible');
      cy.contains('Usuarios').should('be.visible');
      cy.contains('Préstamos').should('be.visible');
    });
  });
});
