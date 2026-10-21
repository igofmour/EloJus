'use strict';
// Visualização local dos modelos. Não carrega credenciais nem envia e-mails.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const port = Number(process.argv[2] || 8773);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Porta inválida.');
const origin = `http://127.0.0.1:${port}`;
const templates = require('../emails/templates.json');
const root = path.resolve(__dirname, '../emails');
const page = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>EloJus · Prévia dos e-mails</title>
<style>*{box-sizing:border-box}body{margin:0;background:#f2f2f2;color:#171717;font-family:Arial,sans-serif}header{background:#111;color:#fff;padding:24px 32px;display:flex;gap:24px;align-items:center;justify-content:space-between;flex-wrap:wrap}header strong{font-size:28px;letter-spacing:-1px}header span{font-size:13px;color:#ccc}main{max-width:1320px;margin:auto;padding:32px 20px;display:grid;grid-template-columns:1fr 1fr;gap:24px}h1{font:32px Georgia,serif;grid-column:1/-1;margin:0}h2{font-size:15px;margin:0 0 12px}iframe{border:1px solid #ddd;width:100%;height:790px;background:#fff}p{font-size:13px;line-height:1.6;color:#555}@media(max-width:800px){main{grid-template-columns:1fr}header{padding:24px 20px}}</style>
<header><strong>EloJus</strong><span>PRÉVIA LOCAL · NÃO ENVIA MENSAGENS</span></header><main><h1>O próximo passo chega por e-mail.</h1>
<section><h2>Confirmação de cadastro</h2><p>Assunto: ${templates.confirmation.subject}</p><iframe title="E-mail de confirmação" src="/confirmation" sandbox=""></iframe></section>
<section><h2>Recuperação de senha</h2><p>Assunto: ${templates.recovery.subject}</p><iframe title="E-mail de recuperação" src="/recovery" sandbox=""></iframe></section></main></html>`;
http.createServer((req, res) => {
  if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host)) { res.writeHead(403); return res.end(); }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; frame-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'");
  const route = new URL(req.url, origin).pathname;
  let body;
  if (route === '/') body = page;
  else if (['/confirmation', '/recovery'].includes(route)) {
    body = fs.readFileSync(path.join(root, templates[route.slice(1)].file), 'utf8')
      .replace(/{{\s*\.ConfirmationURL\s*}}/g, `${origin}/link-de-exemplo`);
  } else if (route === '/link-de-exemplo') {
    body = '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>EloJus · Exemplo</title><p>Este é apenas um exemplo visual. Nenhuma conta ou senha foi alterada.</p></html>';
  } else { res.writeHead(404); return res.end(); }
  res.end(req.method === 'HEAD' ? undefined : body);
}).listen(port, '127.0.0.1', () => console.log(`Prévia local dos e-mails: ${origin}`));
