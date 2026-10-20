(() => {
  'use strict';
  // Local prototype only: these records are editable in browser storage and
  // provide no authorization. Never use this module for production accounts.
  const KEY = 'elojus-demo-accounts-v1', ITERATIONS = 150000;
  const demo = Object.freeze({ name: 'Marina Exemplo', email: 'marina@elojus.demo', password: 'elojus-demo' });
  const normalizeEmail = value => String(value || '').trim().toLowerCase();
  function read() {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return { version: 1, accounts: [], pendingEmail: '' };
    const data = JSON.parse(raw);
    if (data?.version !== 1 || !Array.isArray(data.accounts) || data.accounts.some(account =>
      typeof account?.name !== 'string' || account.name.length > 120 || typeof account.email !== 'string' || account.email.length > 254 ||
      !/^[a-f0-9]{32}$/.test(account.salt) || !/^[a-f0-9]{64}$/.test(account.verifier))) throw new Error('invalid-demo-storage');
    return data;
  }
  const toHex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  const fromHex = value => Uint8Array.from(value.match(/../g), part => parseInt(part, 16));
  async function derive(password, salt) {
    if (!window.crypto?.subtle) throw new Error('crypto-unavailable');
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: fromHex(salt), iterations: ITERATIONS, hash: 'SHA-256' }, key, 256);
    return toHex(new Uint8Array(bits));
  }
  function available(email, data) { return email !== demo.email && !data.accounts.some(account => account.email === email); }
  async function register(name, email, password) {
    name = String(name || '').trim(); email = normalizeEmail(email);
    if (name.length < 2 || name.length > 120 || !/^[^\s@]+@[^\s@]+$/.test(email) || email.length > 254 || typeof password !== 'string' || password.length < 8 || password.length > 128) return { ok: false, reason: 'invalid' };
    if (!available(email, read())) return { ok: false, reason: 'duplicate' };
    const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
    const verifier = await derive(password, salt);
    // Re-read after hashing so a second submission cannot replace another record.
    const data = read();
    if (!available(email, data)) return { ok: false, reason: 'duplicate' };
    data.accounts.push({ name, email, salt, verifier }); data.pendingEmail = email;
    sessionStorage.setItem(KEY, JSON.stringify(data));
    return { ok: true, profile: { name, email } };
  }
  async function authenticate(email, password) {
    email = normalizeEmail(email);
    if (email === demo.email) return password === demo.password ? { name: demo.name, email } : null;
    const account = read().accounts.find(account => account.email === email);
    if (!account || await derive(password, account.salt) !== account.verifier) return null;
    return { name: account.name, email: account.email };
  }
  function takePendingEmail() {
    const data = read(), email = data.pendingEmail;
    if (!email || !data.accounts.some(account => account.email === email)) return '';
    data.pendingEmail = ''; sessionStorage.setItem(KEY, JSON.stringify(data));
    return email;
  }
  window.EloDemoAccounts = { demo, register, authenticate, takePendingEmail };
})();
