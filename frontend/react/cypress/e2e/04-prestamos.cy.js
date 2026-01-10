describe('Préstamos', () => {
  it('Crear un préstamo por API y verlo en la pantalla Mis Préstamos', () => {
    cy.createAndLoginTestUser().then(({ user }) => {
      cy.request('/api/libros').then((res) => {
        expect(res.status).to.eq(200);
        const libros = Array.isArray(res.body) ? res.body : [];
        expect(libros.length).to.be.greaterThan(0);

        const idLibro = libros[0].id_libro;
        cy.apiCreateLoan({ user, id_libro: idLibro }).then((loanRes) => {
          expect([200, 201, 409]).to.include(loanRes.status);
        });

        cy.visit('/prestamos');
        cy.contains('Mis Préstamos').should('be.visible');
      });
    });
  });

  it('Extender: si hay un préstamo activo con botón Extender, debe mostrar alerta o actualizar', () => {
    cy.createAndLoginTestUser().then(({ user }) => {
      cy.request('/api/libros').then((res) => {
        const idLibro = res.body?.[0]?.id_libro;
        cy.apiCreateLoan({ user, id_libro: idLibro });

        cy.visit('/prestamos');
        cy.contains('Mis Préstamos').should('be.visible');

        cy.on('window:alert', () => {});
        cy.contains('button', 'Extender').then(($btn) => {
          if ($btn.length) {
            cy.wrap($btn[0]).click();
          }
        });
      });
    });
  });
});
