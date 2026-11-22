import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const url = process.env.DEMO_URL || 'http://127.0.0.1:4329';
const browser = await chromium.launch(
  process.env.BROWSER_BIN ? { executablePath: process.env.BROWSER_BIN } : {},
);
const problems = [];
const headings = {
  Pedido: 'Migración bloqueada',
  'Matriz y pruebas': 'Matriz de decisión',
  Eventos: 'Secuencia de eventos',
  Costos: 'Comprar o mantener el motor',
};
try {
  const page = await browser.newPage();
  const button = (name) =>
    page.getByRole('button', { name, exact: typeof name === 'string' });
  await page.goto(url);
  for (const name of [
    'Aceptar pedido',
    'Confirmar a las 00:05',
    'Intentar migración',
  ]) {
    await button(name).click();
  }
  await page.getByRole('heading', { name: 'Migración bloqueada' }).waitFor();
  for (const width of [320, 390, 720, 768, 973, 1024, 1440]) {
    await page.setViewportSize({ width, height: 815 });
    for (const [name, heading] of Object.entries(headings)) {
      await button(name === 'Eventos' ? /^Eventos/ : name).click();
      await page.getByRole('heading', {name:heading,exact:true}).waitFor();
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
      )
        problems.push(width + ' / ' + name + ': desborde horizontal');
      if (
        name !== 'Pedido' &&
        (await page
          .getByRole('status')
          .filter({ hasText: /Motivos:/ })
          .isVisible())
      )
        problems.push(
          width + ' / ' + name + ': aviso del pedido fuera de contexto',
        );
    }
    const groups = await page
      .locator('.cost-grid input')
      .evaluateAll((inputs) => {
        const rows = new Map();
        for (const field of inputs) {
          const y = Math.round(
            field.closest('.cost-field, label').getBoundingClientRect().top,
          );
          const input = field.getBoundingClientRect();
          const row = rows.get(y) ?? [];
          const caption = field.labels[0].getBoundingClientRect();
          row.push({ label: caption.top, top: input.top, bottom: input.bottom });
          rows.set(y, row);
        }
        return [...rows.values()];
      });
    assert.equal(groups.flat().length,5);
    if(width===973) assert.equal(groups.length,1);
    for (const row of groups) {
      for (const edge of ['label', 'top', 'bottom']) {
        const coords = row.map((box) => box[edge]);
        const difference = Math.max(...coords) - Math.min(...coords);
        if (difference > 1)
          problems.push(
            width +
              ' / Costos: bordes ' +
              edge +
              ' difieren ' +
              difference +
              ' px',
          );
      }
    }
    if (width === 973 && !problems.length) {
      await mkdir('docs/evidencia', { recursive: true });
      await page.screenshot({
        path: 'docs/evidencia/costos-alineados.png',
        fullPage: true,
      });
    }
  }
  console.log(
    problems.length
      ? problems.join('\n')
      : 'Cuatro vistas, siete anchos y campos alineados.',
  );
  assert.equal(problems.length, 0, 'Revisar hallazgos de maquetación');
  const volume = page.getByLabel('Volumen mensual');
  await volume.fill('200');
  await page.getByText('USD 17.400',{exact:true}).waitFor();
  await button('Pedido').click();
  await page.getByRole('heading',{name:headings.Pedido}).waitFor();
  await button('Costos').click();
  await volume.waitFor();
  assert.equal(
    await volume.inputValue(),
    '200',
    'Se conservan los supuestos al cambiar de vista',
  );
  for (const invalid of ['', '-1', '1000001']) {
    await volume.fill(invalid);
    await page.locator('#cost-volume[aria-invalid="true"]').waitFor();
    assert.equal(await volume.getAttribute('aria-invalid'), 'true');
    assert.doesNotMatch(
      await page.locator('.summary').innerText(),
      /USD\s*[\d.]+/,
    );
  }
  await volume.fill('100');
  await page.getByText('USD 10.200',{exact:true}).waitFor();
  assert.match(await page.locator('.summary').innerText(), /10\.200/);
  console.log('Edición, validación y recuperación del cálculo verificadas.');
} finally {
  await browser.close();
}
