'use strict';
const fs = require('node:fs');
const path = require('node:path');

function configuration(env) {
  let url;
  try { url = new URL(env.ELO_SUPABASE_URL); } catch { throw new Error('Informe ELO_SUPABASE_URL válida.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Use a origem HTTPS do projeto, sem credenciais, caminho ou parâmetros.');
  }
  const key = env.ELO_SUPABASE_PUBLISHABLE_KEY || '';
  if (!/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(key) || /SUBSTITUA/i.test(key)) {
    throw new Error('Use somente a chave publishable do projeto. Chaves administrativas são recusadas.');
  }
  const pending = env.ELO_EMAIL_SETUP_PENDING ?? 'true';
  if (!['true', 'false'].includes(pending)) throw new Error('ELO_EMAIL_SETUP_PENDING deve ser true ou false.');
  return { url: url.origin, publishableKey: key, storageKey: 'elojus-auth-' + url.hostname.split('.')[0], emailSetupPending: pending === 'true' };
}

if (require.main === module) {
  try {
    const config = configuration(process.env);
    const target = path.resolve(__dirname, '../dist/auth-config.js');
    const flag = process.argv.includes('--force') ? 'w' : 'wx';
    fs.writeFileSync(target, '// Configuração pública local. Gerada; não versionar.\nwindow.EloAuthConfig = Object.freeze(' + JSON.stringify(config, null, 2) + ');\n', { flag });
    console.log('Configuração criada em dist/auth-config.js (ignorada pelo Git).');
  } catch (error) {
    console.error(error.code === 'EEXIST' ? 'Configuração existente preservada. Use --force somente para substituí-la conscientemente.' : error.message);
    process.exitCode = 1;
  }
}
module.exports = { configuration };
