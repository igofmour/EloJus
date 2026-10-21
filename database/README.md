# Esquema do banco

Referências SQL consolidadas para um projeto Supabase **vazio**, sem registros reais ou senhas.

1. office-registration.sql: escritório, responsável e RLS.
2. office-plan-selection.sql: plano e data de escolha, sem cobrança.
3. shared-office.sql: membros, convites, casos, comentários, versões e atividades.
4. team-registration.sql: migração incremental `team_registration_v22`; dados profissionais, cadastro administrativo, edição e renovação de convites. Aplicada após a v0.21, uma única vez.
5. case-workflow.sql: criação de peças pelo colaborador para si, comentários idempotentes e revisão do texto independente dos comentários.
6. case-attachments.sql: metadados, RPCs e bucket privado com políticas de acesso por caso.
7. review-workflow.sql: revisor, agrupamento de peças, prioridade, rodadas, respostas, leitura de atualizações e registros do piloto.

**Itens 5, 6 e 7 aplicados no projeto EloJus em 20/10/2026**, na migração `20261020142503_case_attachments_and_review_workflow_v24`, após autorização do responsável. Naquela etapa, `workspace_capabilities` retornava 24; a evolução v0.25 descrita abaixo elevou a capacidade atual para 25. Os seis casos anteriores foram preservados. Uma migração complementar, `case_attachment_office_case_index`, acrescentou o índice composto dos anexos após a inspeção de desempenho; a referência consolidada já o inclui.

O item 7 renomeia a implementação privada v0.23 e retira sua execução direta do papel autenticado, preservando o caminho público protegido. **Não executar isoladamente nem reaplicar no projeto atual.** As referências são destinadas à reprodução do esquema em um banco vazio; o histórico remoto é a fonte das migrações já aplicadas.

`pnpm test:database` executa todas as referências em PostgreSQL/WASM local e aplica os roteiros de QA com rollback. `qa/case-workflow-policies.sql` inclui objetos fictícios de Storage e deve ser usado **apenas nesse banco local**. Upload/download do serviço HTTP real foram validados com um TXT fictício e a conta atual.

`qa/review-workflow.cjs` usa uma instância descartável separada, encerrada ao final. Verifica também anonimato, identidade ausente, revisor designado, reatribuição entre autor/revisor, isolamento de casos relacionados, idempotência e tabelas do piloto. Escritas seguem a ordem de bloqueio escritório → peça; tabelas novas têm RLS e somente leitura direta para `authenticated`. RPCs públicas usam `security invoker`; validações privilegiadas ficam no schema privado com `search_path` vazio.

Não reaplicar sobre banco existente: tabelas e políticas já podem estar criadas. Não confundir estes arquivos com o histórico remoto de migrações. Alterações futuras exigem migração incremental revisada e homologação.

Requer Supabase Auth e papéis padrão. As referências a service_role em GRANT não são credenciais. O roteiro remoto atual é `qa/review-workflow-remote.sql`: 45 verificações na v0.24, com identidades e escritório descartáveis, `ROLLBACK` e nenhuma manipulação direta de objetos do Storage. O fluxo completo entre papéis é testado sem representar duas sessões reais de Auth.

O cadastro da equipe também é coberto por `qa/team-registration-policies.sql`. `qa/shared-office-policies.sql` conserva o contrato de envio da v0.21–v0.23 e é executado localmente antes da evolução v0.24. Não executar esse roteiro antigo diretamente sobre a v0.24, que exige revisor e resumo no envio.

qa/legacy guarda testes anteriores à equipe compartilhada; exigem o esquema daquele estágio. O novo trigger de membros exige identidade autenticada ao criar escritórios.

## v0.25 — entrega por arquivo

8. `file-review.sql`: peça principal em arquivo, versões e rodadas vinculadas ao original, referência imutável dos comentários e seleção protegida por permissões/revisão.
9. `file-review-indexes.sql`: índices que cobrem as referências compostas. Remove somente os quatro índices simples criados no item 8; não remove registros.

Ambas aplicadas ao projeto EloJus. `workspace_capabilities` agora retorna 25. Preservados 7 casos e 4 anexos. O roteiro `qa/file-review-remote.sql` passou em 25 cenários com ROLLBACK. Ele usa metadados de arquivos fictícios para verificar regras; não escreve em `storage.objects` nem substitui testes HTTP de upload/download. A validação no navegador é descrita no [plano de entrega](../docs/PREPARACAO-ENTREGA.md).

## v0.27 — opções mensal e anual

Migração `monthly_and_annual_office_plans_v27`, aplicada em 21/10/2026 ao projeto EloJus. Amplia somente `offices_plan_code_check` para aceitar `equipe_mensal` e `equipe_anual`, preservando os códigos anteriores, registros, RLS e grants. O trecho incremental está identificado ao final de `office-plan-selection.sql`; o arquivo completo continua destinado a banco vazio.

`qa/plan-billing.cjs` valida a migração sobre o esquema anterior com escolha já salva, além das permissões e de ambos os novos códigos. `qa/plan-billing-remote.sql` passou em oito verificações locais e remotas, encerradas com ROLLBACK. O escritório existente manteve `equipe`; nenhuma fixture permaneceu. O diagnóstico de segurança manteve somente o aviso preexistente de proteção contra senhas vazadas desativada.
