const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const vue = require('vue');
const code = ts.transpile(readFileSync(join(__dirname, 'use-member-records.ts'), 'utf8'), {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
});

function setup(t, fetcher, profile = async () => true) {
  const session = vue.reactive({ userId: 'member-a', token: 'token-a' });
  const exports = {};
  const deps = {
    vue,
    '@/store/session': { sessionState: session, restoreSession() {} },
    '@/utils/api': { readableErrorMessage: (error) => error.message },
    '@/utils/member': { refreshSessionProfile: profile },
  };
  vm.runInNewContext(code, { exports, require: (name) => deps[name] });
  const scope = vue.effectScope();
  t.after(() => scope.stop());
  return { state: scope.run(() => exports.useMemberRecords(fetcher)), session };
}

test('network failure is distinct from empty success and can be retried', async (t) => {
  let fail = true;
  const { state } = setup(t, async () => { if (fail) throw new Error('network failure'); return []; });
  await state.refresh();
  assert.equal(state.loaded.value, false);
  assert.equal(state.errorMessage.value, 'network failure');
  assert.equal(state.loading.value, false);
  fail = false;
  await state.refresh();
  assert.equal(state.loaded.value, true);
  assert.equal(state.errorMessage.value, '');
});

test('logout clears displayed records and ignores a late response', async (t) => {
  let resolve;
  let pending = false;
  const { state, session } = setup(t, () => pending ? new Promise((r) => { resolve = r; }) : Promise.resolve(['old']));
  await state.refresh();
  pending = true;
  const request = state.refresh();
  await new Promise(setImmediate);
  session.userId = '';
  session.token = '';
  resolve(['late']);
  await request;
  assert.equal(state.records.value.length, 0);
  assert.equal(state.loaded.value, false);
  assert.equal(state.loading.value, false);
});

test('switching members clears records and the new member may retry', async (t) => {
  const { state, session } = setup(t, async () => [session.userId]);
  await state.refresh();
  session.userId = 'member-b';
  session.token = 'token-b';
  assert.equal(state.records.value.length, 0);
  await state.refresh();
  assert.equal(state.records.value[0], 'member-b');
});

test('overlapping refresh responses cannot overwrite the newest result', async (t) => {
  const pending = [];
  const { state } = setup(t, () => new Promise((resolve) => pending.push(resolve)));
  const old = state.refresh();
  await new Promise(setImmediate);
  const recent = state.refresh();
  await new Promise(setImmediate);
  pending[1](['recent']);
  await recent;
  pending[0](['old']);
  await old;
  assert.equal(state.records.value[0], 'recent');
});

test('expired session never loads private records', async (t) => {
  let called = false;
  const { state } = setup(t, async () => { called = true; return []; }, async () => false);
  await state.refresh();
  assert.equal(called, false);
  assert.equal(state.loaded.value, false);
  assert.ok(state.errorMessage.value);
});
