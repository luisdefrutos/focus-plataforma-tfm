import { test, expect } from '@playwright/test';

test('Debe redirigir al login si el usuario no está autenticado', async ({ page }) => {
  // Intentar acceder a la página de clientes (protegida)
  await page.goto('/clientes');

  // NextAuth debe redirigir a la ruta de inicio de sesión
  await expect(page).toHaveURL(/.*\/login.*/);

  // Verificar que la página contiene un texto o elemento característico del login
  // Reemplaza 'Focus' con algún texto real que aparezca en tu pantalla de login si es distinto.
  await expect(page.locator('body')).toContainText(/Focus/i);
});
