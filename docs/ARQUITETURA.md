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
| team-management.js / .css | Diretório, filtros e formulários de cadastro profissional e permissão |
| review-model.js | Ordenação, filtros, assuntos, comparação de texto e métricas de espera |
| review-ui.js / review-workspace.css | Central, resumo de entrega, conversa, rodadas e indicadores |
| case-files.js / delivery-ui.js / writing-files.js | Anexos e escolha da peça principal, com referência ao original entregue |
| draft-recovery.js | Cópias locais de texto pendente, isoladas por conta, escritório, caso e aba |
| workspace-notices.js | Avisos opcionais e agrupados enquanto a aplicação estiver aberta |
| shared-save.js | Gravação, falha e conflito por revisão |
| rich-editor.js, paged-editor.js, rich-document.js | Editor, paginação e exportação |
| demonstracao.html, workspace-model.js | Demonstração histórica local |

## Dados e permissões

| Tabela | Conteúdo |
| --- | --- |
| offices | Escritório, responsável e plano |
| office_members | Vínculo, papel, nome, função profissional e OAB/UF |
| office_invitations | Dados do cadastro pendente, e-mail, hash do token, validade e revogação |
| office_cases | Contexto, atribuição, estado e minuta com revisão |
| case_comments | Comentários e resolução |
| case_versions | Versões preservadas |
| office_activity | Atividades registradas no servidor |

Administrador gerencia equipe e casos. Revisor cria, atribui e revisa casos do escritório. Colaborador acessa os casos atribuídos, elabora, comenta e envia para revisão.

Função profissional e permissão são distintas: advogados podem ter acesso restrito ou de revisão; estagiários sempre têm acesso restrito. O administrador salva o cadastro pendente com `register_member`; o aceite confirmado transfere os dados para o vínculo. `update_member` preserva o e-mail da conta; `renew_invite` revoga o link anterior. A migração v0.22 preserva o contrato anterior de casos e convites e usa a mesma ordem de bloqueio de escritório/convite ao aceitar ou renovar.

O banco verifica identidade e vínculo ativo; metadados editáveis da conta não concedem acesso. A interface orienta, mas não é a barreira de autorização. Escritas passam por workspace_command; funções internas privilegiadas ficam em schema privado, validam identidade/escritório e fixam search_path. RLS protege leituras.

O número esperado de revisão impede sobrescrita silenciosa entre editores; conflitos preservam rascunhos. Não existe coedição de caracteres ou sincronização Realtime. Convites por link expiram em 7 dias, exigem e-mail confirmado correspondente e admitem revogação. Ainda não há envio automático desses convites por e-mail.

A aprovação interna é bloqueada para quem está atribuído ao caso e por comentários bloqueantes pendentes. Demonstrações locais não migram automaticamente para casos compartilhados. Anexos em Storage privado e o fluxo de revisão v0.24 estão ativos no Supabase desde 20/10/2026.


## Peças e anexos v0.23 — ativos no Supabase

`case_attachments` reserva e confirma os arquivos por caso. `attachment_command` valida membro ativo, atribuição, etapa, formato e cotas. O bucket privado `case-documents` permite inserção apenas para reservas do autor e leitura conforme o acesso atual ao caso; não há política de substituição ou exclusão. Download usa sessão autenticada, sem URL pública.

Comentários e versões não incrementam a revisão do texto. Comentários são idempotentes e atualizam apenas o painel da conversa; mudanças de etapa e atribuição continuam usando revisão esperada. O cliente consulta `workspace_capabilities` antes de ativar a criação pelo colaborador e os anexos.

A prévia `qa/workflow-preview.cjs` usa somente loopback, PostgreSQL em memória e identidades fictícias. Não integra Auth/Storage remotos nem deve ser publicada. Detalhes em [Peças e anexos](PECAS-E-ANEXOS.md).

## Colaboração v0.24 — ativa no Supabase

`office_cases` continua representando a unidade de elaboração e revisão (peça). O novo `office_matters` agrupa várias peças sob um caso. O acesso do colaborador continua por atribuição da peça; conhecer o caso relacionado não concede acesso às demais peças.

Cada peça pode ter revisor, prazo de retorno e prioridade justificada. `case_review_rounds` preserva resumo, atenção, destino e versão a cada envio, com ID estável para repetir requisições sem duplicar rodadas. A aprovação e a devolução são reservadas ao revisor indicado ou administrador e não podem ser decisões do próprio autor. Ajustes impeditivos continuam impedindo a aprovação até resolução.

`case_comments` distingue dúvida, ajuste e observação, com respostas ligadas ao assunto original. Atendimento indicado pelo autor não é resolução. A conversa não altera a revisão do texto; conflitos de documento continuam protegidos pelo salvamento existente.

`case_review_reads` registra leitura somente da própria conta. `review_signals` respeita RLS e reúne pendências por peça; não envia notificações externas. Atualizações usam a consulta periódica já existente, sem coedição em tempo real. `case_pilot_entries` guarda um registro manual por peça, acessível aos gestores, para comparar grupos com e sem a plataforma.

Os indicadores mostram tempo corrido até a primeira resposta e dados declarados de esforço ativo separadamente. Mediana de espera não equivale a tempo de revisão nem comprova ganho de produtividade. A comparação textual preserva inclusões/exclusões, mas exige conferência adicional de formatação e documento completo.

## Entrega v0.25 e e-mails de acesso

A escolha entre editor e arquivo principal é explícita. Versões, rodadas, aprovação e comentários mantêm o identificador do arquivo entregue; uma nova rodada não troca o documento referido por conversas anteriores. A fonte fica bloqueada durante revisão e após aprovação. Arquivos não são convertidos automaticamente em texto.

Rascunhos ainda não confirmados pelo servidor podem ser recuperados neste navegador, com isolamento por conta/escritório/peça/aba, expiração e restauração explícita. Não substituem backup. Indicadores separam primeira resposta, decisão, ciclo e espera pendente.

Os modelos de confirmação e recuperação ficam em `emails/`. O Supabase gera o link e envia a mensagem pelo SMTP configurado no painel. Credenciais não passam pelo frontend nem são versionadas. Os convites do escritório continuam por link; não há e-mail automático de atividades. Ver [configuração de autenticação](../AUTH-SETUP.md).
