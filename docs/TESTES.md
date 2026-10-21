# Testes e evidências

Estado consolidado em **21/10/2026**, versão **0.27.0**. Os testes locais foram repetidos antes da atualização do repositório. As evidências de Supabase e navegador vêm das etapas de implementação; não são resultados da CI nem certificação de segurança.

## Verificação local atual

| Verificação | Resultado | Cobertura |
| --- | --- | --- |
| pnpm test | 79 testes aprovados | Auth, equipe, permissões da interface, salvamento/conflito, documentos, arquivos, revisão, rascunhos, avisos e métricas |
| pnpm test:database | 241 verificações anteriores + suíte de planos + 8 verificações do roteiro remoto | PostgreSQL local: 44 de escritório, 36 de equipe, 42 de peças/anexos, 45 do roteiro v24, 49 de revisão e 25 de entrega por arquivo; migração, códigos e permissões de planos |
| pnpm test:exports | Aprovado | DOCX e PDF com formatação e documento de várias páginas |
| pnpm check:repository | Sem padrões conhecidos de credenciais | Arquivos versionados e novos; revisão manual complementar |
| Modelos de e-mail | Conferidos localmente | Identidade preta e branca, links gerados pelo Supabase e ausência de scripts/rastreadores externos |

~~~sh
pnpm install --frozen-lockfile
pnpm test
pnpm test:database
pnpm test:exports
pnpm check:repository
~~~

A CI executa as quatro verificações pnpm sem credenciais, acesso ao Supabase, envio de e-mail ou implantação. O scanner é preventivo e não identifica todo possível dado pessoal ou segredo. Exportações e evidências visuais geradas permanecem fora do Git.

## Revisão de uso - 21/10/2026

- Reexecutados: 79 testes Node, suítes de PostgreSQL local, exportações DOCX/PDF, scanner do repositório e suíte de navegador dos planos em desktop e 390/320 px. A suíte do Edge foi executada fora do sandbox após o bloqueio de inicialização do navegador; somente banco e identidades fictícios.
- Navegador da aplicação: sessão existente, início e equipe carregados do Supabase, com acesso ao plano mantido para o responsável. Nenhum registro real foi alterado nesta revisão.
- Prévia local: criação pela Sara, digitação, salvamento, recarga, primeira entrega, comentário impeditivo, devolução, edição, indicação de atendimento, segunda rodada, aprovação recusada até a resolução pelo revisor e aprovação final em leitura.
- Corrigido e reproduzido: o atalho "Ir para o conteúdo" conserva a rota da peça e move o foco ao conteúdo; antes, voltava ao início.
- Corrigido e conferido nos estados editável, em revisão e aprovado: "Salvar agora" aparece apenas para texto editável.
- Corrigido: a demonstração oculta o link de planos que não possui autenticação naquele servidor. O atalho permanece disponível no escritório real. Entrada por "Testar como Sara" conferida.
- Os testes de alteração usaram a prévia descartável na porta 8772. Não substituem a validação pendente de duas contas reais, entrega de e-mails ou pagamento.

## Plano Equipe v0.27

- Navegador Edge: mensal/anual, valores com centavos, benefícios, teclado, gravação confirmada no PostgreSQL local, recarga e resumo.
- Falha de gravação e consulta, repetição após erro, sessão encerrada, seleção não salva e todos os três códigos antigos.
- Outra conta e colaborador não alteram a escolha do responsável.
- Pagamento indisponível; nenhum link externo ou cobrança nesta versão.
- Layout inspecionado em 1440 e 390 px; sem excesso horizontal também em 320 px.
- Cliente Supabase e SQL reais no ambiente local; identidades fictícias. Não representa teste de checkout.
- Oito verificações de planos executadas também no Supabase real com ROLLBACK. A escolha preexistente foi preservada e nenhuma fixture permaneceu.
- Reprodução e limites em [Plano do escritório](PLANO.md).

## Supabase: evidências já obtidas

- Esquema v0.25 ativo; migrações registradas em [database/README.md](../database/README.md).
- 45 verificações de revisão e 25 de entrega por arquivo executadas no banco real, em transações encerradas com ROLLBACK. Identidades e escritórios fictícios não permaneceram no banco.
- Cobertura: identidade ausente/anônima, isolamento entre escritórios e por atribuição, revisor designado, ausência de autorrevisão, reatribuição, revogação e impedimento de escrita durante revisão/após aprovação.
- Entrega idempotente com resumo, versões e rodadas; ajuste impeditivo, devolução, atendimento pelo autor, resolução pelo revisor e aprovação em segunda rodada.
- Peça principal vinculada ao arquivo original; comentários, versões e aprovação preservam essa referência. Testes SQL de arquivo usam metadados fictícios e não representam upload HTTP.
- Upload/download HTTP real de TXT, DOCX e PDF pela conta atual, em peça fictícia: SHA-256 idêntico aos originais e persistência após recarregar. Sete peças e quatro anexos existentes foram preservados na atualização v0.25.
- Inspeções anteriores mantiveram pendentes os avisos de proteção contra senhas vazadas e de políticas SELECT sobrepostas em offices. Nenhum upgrade foi contratado.

**Limite:** papéis autenticados temporários no SQL não equivalem a duas contas confirmadas entrando pelo Supabase Auth. O teste com duas sessões reais continua pendente.

## Navegador: evidências já obtidas

| Cenário | Evidência | Ambiente |
| --- | --- | --- |
| Criação e salvamento | Abertura direta do editor, texto e conversa preservados após recarregar | Conta atual, aplicação real na porta 8768 |
| Editor A4 | Cursor em peça vazia, digitação/limpeza nos quatro níveis de zoom, formatação, desfazer/refazer e paginação | Editor e documentos fictícios |
| Comentários | Escrita e desfazer preservados; resolução/reabertura; conversa persistente | Aplicação real e prévia local |
| Conflito | Sobrescrita recusada, rascunho mantido e carregamento explícito da versão remota | Abas e prévia de colaboração |
| Sara e administrador | Criação atribuída à Sara, lista restrita e salvamento antes de trocar a visão | PostgreSQL local, atualmente na porta 8772 |
| Ciclo por arquivo | Word entregue, ajuste impeditivo, segunda rodada em PDF, referência ao Word e aprovação pelo revisor | Prévia com dois papéis fictícios |
| Acesso | Cadastro, recuperação e entrada com nova senha confirmados pelo responsável em etapa anterior | Uma conta real |
| E-mails | Modelos conferidos na prévia; Auth consultado com confirmação obrigatória | Prévia na porta 8773; envio ainda não validado |

Avisos nativos permanecem opcionais e desligados por padrão. Agrupamento e intervalos passaram em testes locais; não foi concedida permissão de notificação no navegador do usuário. Não há avisos com a aplicação fechada.

## Como escolher o roteiro

- **qa/local-postgres.cjs:** aplica referências em PostgreSQL/WASM descartável, verificando contratos na ordem das versões.
- **qa/review-workflow.cjs e qa/file-review.cjs:** instâncias locais independentes para revisão e entrega por arquivo.
- **qa/review-workflow-remote.sql e qa/file-review-remote.sql:** homologação remota com privilégios de fixtures e rollback; total de 70 verificações. Não são migrações.
- **qa/case-workflow-policies.sql:** inclui objetos fictícios de Storage; exclusivo do banco local.
- **qa/shared-office-policies.sql:** contrato anterior à revisão v0.24; não executar diretamente sobre o esquema atual.
- **qa/workflow-preview.cjs:** interface com papéis fictícios, arquivos e banco em memória, somente loopback. Não serve configuração de Auth nem deve ser publicado.
- **test-demo.cjs, qa/legacy e pnpm test:legacy:** referências históricas, não o E2E atual.

## Pendências para aceite operacional

1. Concluir SMTP e comprovar recebimento da confirmação/recuperação em endereços externos.
2. Validar nova senha, rejeição da antiga e impossibilidade de reutilizar o link real de recuperação.
3. Duas contas confirmadas: convite por link, atribuição, anexos, ajustes, aprovação, conflito e revogação em sessões independentes.
4. Ensaiar restauração de banco e arquivos; validar carga, produção HTTPS e acompanhamento de falhas.
5. Ampliar acessibilidade, celular e automação E2E atualizada.
6. Observar a dupla e medir ganho de tempo com referência comparável, sem confundir espera com esforço ativo.

Roteiro de aceite em [preparação da entrega](PREPARACAO-ENTREGA.md); prioridades em [roadmap](ROADMAP.md).
