const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('dist/auth.js', 'utf8');

function setup(overrides = {}, address = 'http://127.0.0.1:8768/login.html?next=%23caso%2FELO-007') {
  const calls = [], events = [], stored = new Map([['elojus-demo-session-v1', '{"mode":"demo","userId":"marina"}']]);
  let now = 1_000_000;
  const profile = { id: 'verified-user-1', email: 'test@example.invalid', email_confirmed_at: '2026-10-19', user_metadata: { full_name: 'Conta de teste', role: 'admin' } };
  const methods = {
    getUser: async () => ({ data: { user: profile }, error: null }),
    signInWithPassword: async () => ({ data: { user: profile }, error: null }),
    signUp: async () => ({ data: { session: null }, error: null }),
    resetPasswordForEmail: async () => ({ data: {}, error: null }),
    exchangeCodeForSession: async () => ({ data: { session: { user: profile }, redirectType: 'recovery' }, error: null }),
    updateUser: async () => ({ data: { user: profile }, error: null }),
    signOut: async () => ({ error: null }),
    ...overrides
  };
  const auth = Object.fromEntries(Object.entries(methods).map(([name, handler]) => [name, async (...args) => { calls.push({ name, args }); return handler(...args); }]));
  auth.onAuthStateChange = callback => { auth.emit = callback; };
  const url = new URL(address), redirects = [];
  const location = { href: url.href, search: url.search, hash: url.hash, pathname: url.pathname, replace: value => redirects.push(value) };
  const window = { EloAuthConfig: { url: 'https://example.supabase.co', publishableKey: 'sb_publishable_test', storageKey: 'auth-test' },
    supabase: { createClient: (url, key, options) => { calls.push({ name: 'createClient', args: [url, key, options] }); return { auth }; } },
    dispatchEvent: event => events.push(event)
  };
  const history = { replaceState: (_state, _title, value) => { const clean = new URL(value, url); location.href = clean.href; location.search = clean.search; location.hash = clean.hash; } };
  vm.runInNewContext(source, { window, location, history, URL, URLSearchParams, Date: { now: () => now }, setTimeout: fn => fn(),
    CustomEvent: class { constructor(name, init) { this.name = name; this.detail = init.detail; } },
    localStorage: { removeItem: key => stored.delete(key), getItem: key => stored.get(key) }
  });
  return { A: window.EloAuth, window, auth, calls, events, profile, redirects, location, stored, advance: amount => { now += amount; } };
}

test('allows only application return routes', () => {
  const { A } = setup();
  for (const bad of ['https://evil.example', '//evil.example', '#caso/ELO-007<script>', '#inicio/../../login.html']) assert.equal(A.safeRoute(bad), '#inicio');
  for (const route of ['#inicio', '#casos', '#revisoes', '#caso/ELO-007', '#caso/ELO-007/history']) assert.equal(A.safeRoute(route), route);
  for (const route of ['#equipe', '#convite/'+'a'.repeat(64), '#trabalho/12345678-1234-4321-abcd-123456789012']) assert.equal(A.safeRoute(route),route);
  for (const route of ['#convite/'+'a'.repeat(64)+'?next=https://evil.example','#trabalho/../../../admin','#convite/not-a-token']) assert.equal(A.safeRoute(route),'#inicio');
});
test('a legacy demo marker cannot authenticate or open the workspace', async () => {
  const env = setup({ getUser: async () => ({ data: { user: null }, error: { code: 'session_missing' } }) });
  assert.equal(await env.A.requireUser(), null);
  assert.match(env.redirects[0], /^login\.html\?reason=session/);
  assert.equal(env.calls.filter(c => c.name === 'getUser').length, 1);
});
test('office onboarding returns only to the fixed local registration page', async () => {
  const { A, calls } = setup();
  assert.equal(A.safeRoute('#cadastro-escritorio'), '#cadastro-escritorio');
  assert.equal(A.destination('#cadastro-escritorio'), 'cadastro-escritorio.html');
  assert.equal(A.destination('#planos'), 'planos.html');
  assert.equal(A.destination('#contratacao'), 'contratacao.html');
  assert.equal(A.destination('#caso/ELO-007'), 'index.html#caso/ELO-007');
  for (const bad of ['//evil.example', 'cadastro-escritorio.html', '#cadastro-escritorio/../../evil', '#planos/../../evil', '#planos?next=https://evil.example', '#contratacao/../../evil', '#contratacao?next=https://evil.example', 'https://evil.example']) assert.equal(A.destination(bad), 'index.html#inicio');
  await A.register('Pessoa', 'pessoa@example.invalid', 'example-only', '#cadastro-escritorio');
  assert.match(calls.find(c => c.name === 'signUp').args[0].options.emailRedirectTo, /next=%23cadastro-escritorio$/);
  await A.requestRecovery('pessoa@example.invalid', '#cadastro-escritorio');
  assert.match(calls.find(c => c.name === 'resetPasswordForEmail').args[1].redirectTo, /next=%23cadastro-escritorio$/);
});
test('login requires a server-verified, confirmed user and propagates invalid credentials', async () => {
  const env = setup({ signInWithPassword: async () => ({ error: { code: 'invalid_credentials' } }) });
  await assert.rejects(env.A.login('x@example.invalid', 'fake'), e => e.code === 'invalid_credentials');
  assert.equal(env.calls.some(c => c.name === 'getUser'), false);
  const unconfirmed = setup({ getUser: async () => ({ data: { user: { id: 'u', email_confirmed_at: null } } }) });
  await assert.rejects(unconfirmed.A.user(), e => e.code === 'session_missing');
});
test('signup and recovery use the provider and trusted redirect destinations', async () => {
  const env = setup();
  const result = await env.A.register(' Pessoa ', ' pessoa@example.invalid ', 'not-a-real-password', '//bad');
  assert.equal(result.confirmationRequired, true);
  const signup = env.calls.find(c => c.name === 'signUp').args[0];
  assert.equal(signup.email, 'pessoa@example.invalid');
  assert.equal(signup.options.data.full_name, 'Pessoa');
  assert.equal(signup.options.emailRedirectTo, 'http://127.0.0.1:8768/login.html?next=%23inicio');
  await env.A.requestRecovery('pessoa@example.invalid', '#caso/ELO-007');
  const reset = env.calls.find(c => c.name === 'resetPasswordForEmail').args;
  assert.equal(reset[1].redirectTo, 'http://127.0.0.1:8768/redefinir-senha.html?next=%23caso%2FELO-007');
  const options = env.calls.find(c => c.name === 'createClient').args[2].auth;
  assert.equal(options.flowType, 'pkce'); assert.equal(options.detectSessionInUrl, false);
});
test('opening reset directly cannot change a password even with an existing session', async () => {
  const env = setup(); await env.A.user();
  await assert.rejects(env.A.resetPassword('sample-only'), e => e.code === 'invalid_link');
  assert.equal(env.calls.some(c => c.name === 'updateUser'), false);
});
test('expired or reused code is denied and removed from the URL', async () => {
  const env = setup({ exchangeCodeForSession: async () => ({ data: { session: null }, error: { code: 'flow_state_expired' } }) }, 'http://127.0.0.1:8768/redefinir-senha.html?code=one-time&next=%23casos');
  await assert.rejects(env.A.consumeCode('recovery'), e => e.code === 'invalid_link');
  assert.equal(env.location.href.includes('one-time'), false);
  await assert.rejects(env.A.resetPassword('sample-only'), e => e.code === 'invalid_link');
});
test('signup codes do not authorize password recovery', async () => {
  const env = setup({ exchangeCodeForSession: async () => ({ data: { session: {}, redirectType: null } }) }, 'http://127.0.0.1:8768/redefinir-senha.html?code=signup');
  await assert.rejects(env.A.consumeCode('recovery'), e => e.code === 'invalid_link');
  assert.equal(env.calls.some(c => c.name === 'signOut'), true);
});
test('verified recovery updates the password, revokes sessions, and cannot repeat', async () => {
  const env = setup({}, 'http://127.0.0.1:8768/redefinir-senha.html?code=one-time&sb_flow_id=flow&next=%23casos');
  await env.A.consumeCode('recovery');
  assert.equal(env.calls.find(c => c.name === 'exchangeCodeForSession').args[1].flowId, 'flow');
  assert.equal(env.location.href, 'http://127.0.0.1:8768/redefinir-senha.html?next=%23casos');
  const result = await env.A.resetPassword('sample-only'); assert.equal(result.sessionsRevoked, true);
  assert.equal(env.calls.find(c => c.name === 'signOut').args[0].scope, 'global');
  await assert.rejects(env.A.resetPassword('another-sample'), e => e.code === 'invalid_link');
  assert.equal(env.calls.filter(c => c.name === 'updateUser').length, 1);
});
test('recovery permission expires and is bound to the verified account', async () => {
  const env = setup({}, 'http://127.0.0.1:8768/redefinir-senha.html?code=one-time');
  await env.A.consumeCode('recovery'); env.advance(16 * 60 * 1000);
  await assert.rejects(env.A.resetPassword('sample-only'), e => e.code === 'invalid_link');
  const other = setup({}, 'http://127.0.0.1:8768/redefinir-senha.html?code=one-time');
  await other.A.consumeCode('recovery'); other.profile.id = 'different-user';
  await assert.rejects(other.A.resetPassword('sample-only'), e => e.code === 'invalid_link');
  assert.equal(other.calls.some(c => c.name === 'updateUser'), false);
});
test('local data keys use verified identity; user metadata does not grant permissions', async () => {
  const env = setup(); assert.throws(() => env.A.storageKey('documents'));
  await env.A.user(); assert.equal(env.A.storageKey('documents'), 'documents:verified-user-1');
  assert.equal(env.A.displayName(), 'Conta de teste');
  env.profile.id = 'second-account'; await env.A.user(); assert.equal(env.A.storageKey('documents'), 'documents:second-account');
});
test('errors and auth events do not disclose tokens or raw provider details', async () => {
  const env = setup(); await env.A.user();
  assert.equal(env.A.message({ code: 'invalid_credentials' }), 'E-mail ou senha não conferem.');
  assert.equal(env.A.message({ message: 'secret data' }).includes('secret data'), false);
  env.auth.emit('TOKEN_REFRESHED', { access_token: 'SECRET', user: env.profile });
  assert.equal(JSON.stringify(env.events).includes('SECRET'), false);
});
test('a rejected password update is not reported as success and allows correction', async () => {
  let rejected = true;
  const env = setup({ updateUser: async () => ({ error: rejected ? { code: 'same_password' } : null }) }, 'http://127.0.0.1:8768/redefinir-senha.html?code=one-time');
  await env.A.consumeCode('recovery');
  await assert.rejects(env.A.resetPassword('sample-only'), e => e.code === 'same_password');
  assert.equal(env.calls.some(c => c.name === 'signOut'), false);
  rejected = false; assert.equal((await env.A.resetPassword('different-sample')).sessionsRevoked, true);
});
test('failure to revoke all sessions is surfaced after a successful password change', async () => {
  const env = setup({ signOut: async ({ scope }) => ({ error: scope === 'global' ? { code: 'network' } : null }) }, 'http://127.0.0.1:8768/redefinir-senha.html?code=one-time');
  await env.A.consumeCode('recovery');
  assert.equal((await env.A.resetPassword('sample-only')).sessionsRevoked, false);
  assert.equal(env.calls.filter(c => c.name === 'signOut').length, 2);
});
