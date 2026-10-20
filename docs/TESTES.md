# Testes e evidências

~~~sh
pnpm install --frozen-lockfile
pnpm test
pnpm test:exports
pnpm check:repository
~~~

Testes locais simulam Auth/adaptadores, validam regras, concorrência e exportações fictícias. docx e jszip são dependências fixadas no projeto. Saídas de exportação em qa são ignoradas pelo Git.

A CI executa a suíte local e verificação preventiva sem credenciais ou acesso ao Supabase. O scanner detecta padrões conhecidos; não garante ausência de todo segredo ou dado pessoal.

## Evidências anteriores da v0.21

- 44 verificações SQL de autorização passaram no Supabase com fixtures temporárias e ROLLBACK.
- Navegador: caso, persistência, comentário, versão, exportação e conflito entre duas abas da mesma conta.
- O proprietário confirmou cadastro, redefinição e entrada com nova senha.

São registros da implementação em desenvolvimento, não resultados da CI nem certificação de segurança.

## Pendências

- Duas contas reais confirmadas em sessões independentes.
- SMTP público, rejeição da senha anterior e reutilização do link real de recuperação.
- Restauração, carga, produção, acessibilidade completa e E2E automatizado atualizado.
- Revisão dos avisos de senha vazada e políticas SELECT sobrepostas de offices.

qa/shared-office-policies.sql é o roteiro atual de autorização, para homologação com privilégios de fixtures. Não fornecer chave administrativa ao navegador. qa/legacy guarda verificações de esquemas anteriores.

test-demo.cjs é um roteiro Playwright histórico na porta 8765, não o E2E atual. pnpm test:legacy executa somente a lógica histórica sem navegador.
