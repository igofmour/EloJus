"""Activate the local v0.3 prototype, retaining the previous entry point."""
from pathlib import Path
import shutil

root = Path(__file__).resolve().parents[1]
backup = root / 'archive' / 'identity-v0.2'
backup.mkdir(parents=True, exist_ok=True)
for name in ['index.html', 'app.js', 'style.css', 'identity.css']:
    destination = backup / name
    if not destination.exists():
        shutil.copy2(root / 'dist' / name, destination)

html = '''<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="EloJus: uma mesa de trabalho para delegar, elaborar e revisar com contexto. Demonstração local com casos e documentos fictícios.">
  <meta name="theme-color" content="#111111">
  <title>EloJus — sua mesa de trabalho</title>
  <link rel="icon" href="assets/elojus-icon-v2.svg" type="image/svg+xml">
  <link rel="stylesheet" href="workspace.css?v=0.3.2">
</head>
<body>
  <a class="skip-link" href="#mainContent">Ir para o conteúdo</a>
  <aside class="app-sidebar">
    <a class="app-brand" href="#inicio" data-action="home" aria-label="EloJus — início"><img src="assets/elojus-logo-v2-white.svg" alt="EloJus" width="166" height="43"><small>TRABALHO JURÍDICO EM CONJUNTO</small></a>
    <div class="office-switch"><span class="avatar">EA</span><div><strong>Escritório Aurora</strong><small>Equipe de demonstração</small></div></div>
    <p class="nav-heading">ESPAÇO DE TRABALHO</p>
    <nav id="sidebarNav" aria-label="Navegação principal"></nav>
    <p class="nav-heading recent-heading">EM ANDAMENTO</p>
    <div id="recentCases"></div>
    <div class="sidebar-bottom"><span>O CONTEXTO CONECTA.</span><p class="brand-motto">Entre uma pessoa<br>e o próximo passo.</p><a href="identidade.html">Identidade visual ↗</a><button type="button" data-action="reset">↺ Reiniciar demonstração</button></div>
  </aside>
  <div class="app-shell">
    <header class="app-topbar"><div class="breadcrumb" id="breadcrumb"></div><div class="profile-control"><label for="role">SIMULAR VISÃO</label><select id="role" aria-label="Simular visão"><option value="marina">Marina · advogada</option><option value="lucas">Lucas · estagiário</option><option value="clara">Clara · estagiária</option></select><span class="avatar" id="userAvatar">MA</span></div></header>
    <div class="demo-strip"><span><i aria-hidden="true"></i>Demonstração · casos e documentos fictícios</span><span>Perfis simulados. Sem autenticação, IA ou validação jurídica.</span></div>
    <main id="mainContent" class="main-content" tabindex="-1"></main>
    <footer class="app-footer">Salvo somente neste navegador. Não insira dados reais ou sigilosos. Entregas são internas; nenhum prazo judicial é calculado e nenhum documento é enviado ou protocolado.</footer>
  </div>
  <div id="notice" role="status" aria-live="polite"></div>
  <dialog id="workspaceDialog" aria-label="Detalhes do caso"></dialog>
  <script src="workspace-model.js?v=0.3.2"></script>
  <script src="workspace.js?v=0.3.2"></script>
</body>
</html>
'''
(root / 'dist' / 'index.html').write_text(html, encoding='utf-8')
print('Local workspace v0.3 activated. Previous entry point retained in archive/identity-v0.2.')
