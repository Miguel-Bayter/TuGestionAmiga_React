describe('Autenticación (UI)', () => {
  beforeEach(() => {
    cy.clearAuthUser();
  });

  it('Debe permitir registro y redirigir al inicio', () => {
    const stamp = Date.now();
    cy.visit('/register');

    cy.get('input[placeholder="Miguel Bayter"]').type(`Usuario ${stamp}`);
    cy.get('input[placeholder="ejemplo@correo.com"]').type(`ui_${stamp}@mail.com`);
    cy.get('input[placeholder="Crea una contraseña"]').type('1234');
    cy.get('input[placeholder="Confirma tu contraseña"]').type('1234');

    cy.contains('button', 'Registrarse').click();

    cy.url().should('eq', `${Cypress.config('baseUrl')}/`);
    cy.contains('Bienvenido').should('be.visible');
  });

  it('Debe permitir login por formulario', () => {
    cy.createAndLoginTestUser().then(({ correo, password }) => {
      cy.clearAuthUser();
      cy.visit('/login');

      cy.get('input[placeholder="ejemplo@correo.com"]').clear().type(correo);
      cy.get('input[placeholder="Contraseña"]').clear().type(password);
      cy.contains('button', 'Ingresar').click();

      cy.url().should('eq', `${Cypress.config('baseUrl')}/`);
      cy.contains('Bienvenido').should('be.visible');
    });
  });
});
