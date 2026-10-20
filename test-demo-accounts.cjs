'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const source = fs.readFileSync('dist/demo-accounts.js', 'utf8');
function harness(failWrites = false) {
  const data = new Map();
  const context = { window: { crypto: webcrypto }, crypto: webcrypto, TextEncoder, sessionStorage: {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => { if (failWrites) throw new Error('quota'); data.set(key, value); }
  } };
  vm.runInNewContext(source, context);
  return { api: context.window.EloDemoAccounts, data };
}
(async () => {
  const { api, data } = harness();
  const password = 'Cadastro-ficticio-01';
  assert.equal((await api.register(' Ana Exemplo ', ' ANA@example.invalid ', password)).ok, true);
  const profile = await api.authenticate('ana@EXAMPLE.invalid', password);
  assert.equal(profile.name, 'Ana Exemplo'); assert.equal(profile.email, 'ana@example.invalid');
  assert.equal(await api.authenticate('ana@example.invalid', 'senha-incorreta'), null);
  assert.equal(await api.authenticate('outro@example.invalid', password), null);
  assert.equal((await api.register('Outra pessoa', 'ana@example.invalid', 'Outra-senha-01')).reason, 'duplicate');
  assert.equal((await api.register('Outra pessoa', api.demo.email, password)).reason, 'duplicate');
  assert.equal(await api.authenticate(api.demo.email, 'errada'), null);
  assert.equal((await api.authenticate(api.demo.email, api.demo.password)).name, 'Marina Exemplo');
  assert.equal((await api.register('A', 'a@example.invalid', password)).reason, 'invalid');
  assert.equal((await api.register('Ana', 'a@example.invalid', 'curta')).reason, 'invalid');
  assert.equal(api.takePendingEmail(), 'ana@example.invalid'); assert.equal(api.takePendingEmail(), '');
  assert.equal((await api.register('Bia Exemplo', 'bia@example.invalid', password)).ok, true);
  const stored = JSON.parse(data.get('elojus-demo-accounts-v1'));
  assert.equal(stored.accounts.length, 2);
  assert.notEqual(stored.accounts[0].salt, stored.accounts[1].salt);
  assert.notEqual(stored.accounts[0].verifier, stored.accounts[1].verifier);
  assert.ok(!JSON.stringify(stored).includes(password), 'no plaintext password in session storage');
  assert.equal(await harness().api.authenticate('ana@example.invalid', password), null, 'new storage cannot use another tab registration');
  await assert.rejects(() => harness(true).api.register('Ana', 'ana@example.invalid', password), /quota/);
  data.set('elojus-demo-accounts-v1', '{broken');
  await assert.rejects(() => api.register('Ana', 'new@example.invalid', password));
  console.log('PASS: temporary signup/login, email normalization, incorrect passwords, duplicate and reserved email, validation, one-time email handoff, unique salts, no plaintext password, isolated storage and storage failure.');
})().catch(error => { console.error(error); process.exitCode = 1; });
