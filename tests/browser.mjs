import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const base = process.env.DEMO_URL || 'http://127.0.0.1:4329';
const browser = await chromium.launch(
  process.env.BROWSER_BIN ? { executablePath: process.env.BROWSER_BIN } : {},
);
try {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const button = (name) => page.getByRole('button', { name, exact: true });
    const action = async (name) => {
      await button(name).waitFor({ state: 'visible' });
      const response = page.waitForResponse(
        (r) =>
          r.request().method() === 'POST' &&
          (name === 'Reiniciar demo'
            ? new URL(r.url()).pathname === '/api/runs'
            : new URL(r.url()).pathname.startsWith('/api/runs/')),
      );
      await button(name).click();
      const res = await response;
      assert.ok(res.ok(), res.status() + ' ' + name);
      return res.json();
    };
    await page.goto(base);
    const first = await action('Aceptar pedido');
    assert.equal(first.orders.original.quote.price, 9000);
    let data = await action('Confirmar a las 00:05');
    assert.equal(data.orders.original.charged, 9000);
    assert.equal(data.orders.original.shadow.decision.price, 10000);
    data = await action('Intentar migración');
    await page.getByRole('heading', { name: 'Migración bloqueada' }).waitFor();
    const receipt = page.getByRole('complementary', {
      name: 'Comprobante del pedido',
    });
    assert.match(await receipt.innerText(), /\$90/);
    assert.match(await receipt.innerText(), /\$100/);
    assert.equal(data.active, 'tienda/1');
    if (viewport.width === 1440) {
      await mkdir('docs/evidencia', { recursive: true });
      await page.screenshot({ path: 'docs/evidencia/migracion-bloqueada.png' });
    }
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.reload();
    await page.getByRole('heading', { name: 'Migración bloqueada' }).waitFor();
    await button('Inspeccionar la regla').click();
    await page
      .getByRole('row', { name: /El pedido cruza medianoche.*Difiere/ })
      .waitFor();
    await button('Pedido').click();
    data = await action('Reintentar confirmación');
    assert.equal(
      data.events.filter((e) => e.kind === 'OrderConfirmed').length,
      1,
    );
    await action('Corregir la matriz');
    await button('Matriz y pruebas').click();
    await page.getByRole('heading', { name: /5\/5/ }).waitFor();
    await button('Pedido').click();
    await action('Validar y activar');
    await action('Aceptar otro pedido');
    data = await action('Confirmar segundo pedido');
    assert.equal(data.orders.nuevo.charged, 10000);
    assert.equal(data.orders.original.charged, 9000);
    await page.getByRole('button', { name: /^Eventos/ }).click();
    await page.getByText('MigrationActivated', { exact: true }).waitFor();
    await button('Costos').click();
    await page.getByLabel('Volumen mensual').fill('200');
    assert.match(await page.locator('.summary').innerText(), /17.400/);
    const reset = await action('Reiniciar demo');
    assert.notEqual(first.id, reset.id);
    await button('Aceptar pedido').waitFor();
    assert.equal(errors.length, 0, errors.join('\n'));
    await page.close();
    console.log('Recorrido completo · ' + viewport.width + ' px');
  }
} finally {
  await browser.close();
}
