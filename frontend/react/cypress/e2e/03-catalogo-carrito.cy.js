describe('Catálogo y Carrito', () => {
  it('Con sesión: carga dashboard y permite agregar al carrito por API y verlo en UI', () => {
    cy.createAndLoginTestUser().then(({ user }) => {
      cy.visit('/');
      cy.contains('Bienvenido').should('be.visible');

      cy.request('/api/libros').then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body).to.be.an('array');
        expect(res.body.length).to.be.greaterThan(0);

        const idLibro = res.body[0].id_libro;
        expect(idLibro).to.exist;

        cy.apiAddToCart({ user, id_libro: idLibro, cantidad: 1 }).then((addRes) => {
          expect([200, 201]).to.include(addRes.status);
        });

        cy.visit('/carrito');
        cy.contains('Carrito').should('be.visible');
        cy.contains('Tu carrito está vacío.').should('not.exist');
      });
    });
  });

  it('Checkout: si el carrito tiene items, debe procesar el checkout y dejar el carrito vacío', () => {
    cy.createAndLoginTestUser().then(({ user }) => {
      cy.request('/api/libros').then((res) => {
        const idLibro = res.body?.[0]?.id_libro;
        cy.apiAddToCart({ user, id_libro: idLibro, cantidad: 1 });

        cy.visit('/carrito');

        cy.intercept('POST', '/api/carrito/checkout').as('checkout');
        cy.contains('button', /^Comprar/).click();
        cy.wait('@checkout').its('response.statusCode').should('eq', 200);

        cy.contains('Tu carrito está vacío.', { timeout: 10000 }).should('be.visible');
      });
    });
  });
});
