# Arquitetura

Frontend estático HTML/CSS/JavaScript, sem compilação obrigatória. dist é a fonte editável. Bibliotecas e fontes locais. Supabase Auth identifica a conta; Postgres armazena escritório e colaboração. Não há backend de cobrança ou IA.

~~~mermaid
flowchart LR
  A[Apresentação] --> B[Cadastro e login]
  B --> C[Escritório e plano]
  B --> D[Equipe e casos]
  D --> E[Editor A4 e revisão]
  D --> F[Supabase Auth e Postgres/RLS]
  E --> F
  E --> G[Word e PDF]
~~~

| Arquivo | Responsabilidade |
| --- | --- |
| auth.js | Sessão verificada, callbacks e rotas permitidas |
| office-api.js | Cadastro e escolha de plano |
| shared-api.js | Comandos autenticados de equipe e casos |
| shared-workspace.js / .css | Interface compartilhada |
| shared-save.js | Gravação, falha e conflito por revisão |
| rich-editor.js, paged-editor.js, rich-document.js | Editor, paginação e exportação |
| demonstracao.html, workspace-model.js | Demonstração histórica local |

## Dados e permissões

| Tabela | Conteúdo |
| --- | --- |
| offices | Escritório, responsável e plano |
| office_members | Vínculo ativo e papel |
| office_invitations | E-mail, hash do token, validade e revogação |
| office_cases | Contexto, atribuição, estado e minuta com revisão |
| case_comments | Comentários e resolução |
| case_versions | Versões preservadas |
| office_activity | Atividades registradas no servidor |

Administrador gerencia equipe e casos. Revisor cria, atribui e revisa casos do escritório. Colaborador acessa os casos atribuídos, elabora, comenta e envia para revisão.

O banco verifica identidade e vínculo ativo; metadados editáveis da conta não concedem acesso. A interface orienta, mas não é a barreira de autorização. Escritas passam por workspace_command; funções internas privilegiadas ficam em schema privado, validam identidade/escritório e fixam search_path. RLS protege leituras.

O número esperado de revisão impede sobrescrita silenciosa entre editores; conflitos preservam rascunhos. Não existe coedição de caracteres ou sincronização Realtime. Convites por link expiram em 7 dias, exigem e-mail confirmado correspondente e admitem revogação. Ainda não há envio automático desses convites por e-mail.

A aprovação interna é bloqueada para quem está atribuído ao caso e por comentários bloqueantes pendentes. Demonstrações locais não migram automaticamente para casos compartilhados. Anexos ainda não usam Storage.
