const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { certify } = require('../dist/api/domain/pricing.js');
const { EventStore } = require('../dist/api/event-store.js');
const { restore } = require('../dist/api/domain/run.js');
test('El contrato independiente detecta la deriva aunque se comparen dos copias del mismo candidato', () => {
  const bad = certify('candidato/1');
  assert.deepEqual(bad, certify('candidato/1'));
  assert.deepEqual(
    bad.filter((c) => !c.passed).map((c) => [c.expected, c.actual]),
    [[9000, 10000]],
  );
  for (const version of ['tienda/1', 'candidato/2'])
    assert.ok(certify(version).every((c) => c.passed));
});
test('Confirmar conserva la cotización. El observador recupera trabajo pendiente después de reiniciar', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'precio-pactado-'));
  const filename = join(dir, 'test.sqlite');
  let store = new EventStore(filename);
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const id = store.create(),
    other = store.create();
  const events = () => store.read(id);
  const state = () => restore(events());
  const command = (c) => store.execute(id, c);
  assert.throws(() => command('confirm'), /aceptá/);
  assert.throws(() => command('accept-new'), /activá/);
  command('accept');
  command('accept');
  assert.equal(state().orders.original.quote.price, 9000);
  command('confirm');
  command('confirm');
  assert.equal(state().orders.original.charged, 9000);
  assert.equal(state().orders.original.shadow, null);
  assert.throws(() => command('migrate'), /pendiente/);
  store.close();
  store = new EventStore(filename);
  assert.ok(store.pending().includes(id));
  store.deliver(id);
  store.deliver(id);
  assert.equal(state().orders.original.shadow.decision.price, 10000);
  assert.throws(() => command('correct'), /migración/);
  command('migrate');
  command('migrate');
  assert.equal(state().gate, 'blocked');
  assert.equal(state().active, 'tienda/1');
  command('correct');
  assert.throws(() => command('migrate'), /pendiente/);
  store.deliver(id);
  command('migrate');
  command('migrate');
  assert.equal(state().active, 'candidato/2');
  command('accept-new');
  command('confirm-new');
  store.deliver(id);
  command('confirm');
  assert.equal(state().orders.original.quote.version, 'tienda/1');
  assert.equal(state().orders.original.charged, 9000);
  assert.equal(state().orders.nuevo.charged, 10000);
  assert.equal(state().orders.nuevo.quote.version, 'candidato/2');
  const kinds = events().map((e) => e.kind);
  assert.equal(kinds.filter((k) => k === 'OrderConfirmed').length, 2);
  assert.equal(kinds.filter((k) => k === 'MigrationBlocked').length, 1);
  assert.equal(kinds.filter((k) => k === 'MigrationActivated').length, 1);
  assert.equal(kinds.filter((k) => k === 'ShadowEvaluated').length, 3);
  assert.equal(store.read(other).length, 1);
});
