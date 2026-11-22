const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/api/lab.js');

test('El servidor conserva una sola confirmación concurrente y controla la activación', async (t) => {
  process.env.RULES_DB = ':memory:';
  const app = await NestFactory.create(AppModule, { logger: false });
  t.after(() => app.close());
  await app.listen(0, '127.0.0.1');
  const base = (await app.getUrl()) + '/api/runs';
  const post = (url, body = {}) =>
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  const session = await (await post(base)).json();
  const run = base + '/' + session.id;
  assert.equal((await post(run + '/migrate')).status, 409);
  assert.equal((await post(run + '/unknown')).status, 400);
  assert.equal((await fetch(base + '/missing')).status, 404);
  await post(run + '/accept');
  const confirmations = await Promise.all(
    Array.from({ length: 8 }, () => post(run + '/confirm', { charged: 10000 })),
  );
  assert.ok(confirmations.every((r) => r.ok));
  const state = await (
    await post(run + '/migrate', { active: 'candidato/2' })
  ).json();
  assert.equal(state.gate, 'blocked');
  assert.equal(state.active, 'tienda/1');
  assert.equal(state.orders.original.charged, 9000);
  assert.equal(
    state.events.filter((e) => e.kind === 'OrderConfirmed').length,
    1,
  );
  assert.equal(
    state.events.filter((e) => e.kind === 'ShadowEvaluated').length,
    1,
  );
});
