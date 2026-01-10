describe('Rutas protegidas (guards)', () => {
  it('Sin sesión: /prestamos debe redirigir a /login', () => {
    cy.visit('/prestamos');
    cy.url().should('include', '/login');
    cy.contains('Inicia sesión en tu cuenta').should('be.visible');
  });

  it('Sin sesión: /carrito debe redirigir a /login', () => {
    cy.visit('/carrito');
    cy.url().should('include', '/login');
    cy.contains('Inicia sesión en tu cuenta').should('be.visible');
  });

  it('Con sesión: puede entrar a /prestamos', () => {
    cy.createAndLoginTestUser().then(() => {
      cy.visit('/prestamos');
      cy.contains('Mis Préstamos').should('be.visible');
    });
  });
});
