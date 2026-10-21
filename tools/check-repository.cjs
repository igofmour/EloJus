'use strict';
// Verificação preventiva de arquivos versionados. Não substitui revisão de segurança.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const staged = process.argv.includes('--staged');
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
const denied = /(^|\/)(node_modules|\.pnpm-store|\.openai|\.codex|\.agents|backups|private)(\/|$)|(^|\/)\.env(?!\.example$)|^dist\/auth-config\.js$|(^|\/)preview-|\.(?:dump|backup|pem|key|p12|pfx|zip)$/i;
const patterns = [
  ['chave privada', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['token GitHub', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{35,})\b/],
  ['chave Supabase administrativa', /\bsb_secret_[A-Za-z0-9_-]{20,}\b/],
  ['configuração ativa Supabase', /\bsb_publishable_[A-Za-z0-9_-]{20,}\b/],
  ['JWT persistido', /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/],
  ['credencial em URL', /(?:postgres(?:ql)?|https?):\/\/[^\s/:]+:[^\s/@]+@/]
];
const problems = [];
for (const file of files) {
  if (denied.test(file)) problems.push(file + ': arquivo privado ou gerado');
  if (!/\.(?:js|cjs|mjs|json|html|css|md|sql|ya?ml|py|txt|svg)$/.test(file) && file !== '.env.example') continue;
  let data;
  try {
    data = staged ? execFileSync('git', ['show', ':' + file], { cwd: root, maxBuffer: 16 * 1024 * 1024 }) : fs.readFileSync(path.join(root, file));
  } catch {
    problems.push(file + ': leitura falhou; conteúdo não exibido');
    continue;
  }
  const source = data.toString('utf8');
  for (const [name, pattern] of patterns) {
    // Uma URL explicitamente fictícia usada para testar a recusa de credenciais.
    const reviewed = file === 'test-config.cjs' ? source.replace('https://' + 'user:pass@example.com', '') : source;
    if (pattern.test(reviewed)) problems.push(file + ': ' + name);
  }
}
if (!files.length) problems.push('Nenhum arquivo versionado para verificar.');
if (problems.length) { console.error(problems.join('\n')); process.exitCode = 1; }
else console.log('Verificação preventiva aprovada: ' + files.length + ' arquivos, sem padrões de credenciais detectados.');
