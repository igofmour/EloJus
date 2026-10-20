const test = require('node:test');
const assert = require('node:assert/strict');
const { configuration } = require('./tools/configure-auth.cjs');
const valid = { ELO_SUPABASE_URL: 'https://example.supabase.co', ELO_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_' + 'x'.repeat(24) };
test('configuração aceita apenas chave pública e mantém SMTP pendente por padrão', () => {
  const config = configuration(valid);
  assert.equal(config.url, valid.ELO_SUPABASE_URL);
  assert.equal(config.emailSetupPending, true);
  assert.equal(configuration({ ...valid, ELO_EMAIL_SETUP_PENDING: 'false' }).emailSetupPending, false);
});
test('configuração recusa chaves administrativas, placeholders e origens inseguras', () => {
  for (const key of ['sb_secret_' + 'x'.repeat(24), 'eyJfake.jwt.token', 'sb_publishable_SUBSTITUA', '']) {
    assert.throws(() => configuration({ ...valid, ELO_SUPABASE_PUBLISHABLE_KEY: key }));
  }
  for (const url of ['http://example.com', 'https://user:pass@example.com', 'https://example.com/path', 'https://example.com/?token=abc']) {
    assert.throws(() => configuration({ ...valid, ELO_SUPABASE_URL: url }));
  }
  assert.throws(() => configuration({ ...valid, ELO_EMAIL_SETUP_PENDING: 'talvez' }));
});
