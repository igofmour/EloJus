# Roadmap gerencial

Atualizado em **21/10/2026**, versão **0.27.0**. Objetivo: reduzir busca de contexto, interrupções e retrabalho entre quem elabora e quem revisa. Prioridades propostas, sem contratar serviços ou atribuir prazos e responsáveis automaticamente.

## Situação atual

| Frente | Entrega disponível | Validação e limite |
| --- | --- | --- |
| Equipe e acesso | Cadastro profissional, convites, gestão e isolamento por atribuição | Regras validadas no banco; duas contas reais pendentes |
| Elaboração | Editor A4, rascunhos recuperáveis e anexos privados | Digitação, persistência e upload/download conferidos |
| Entrega | Editor ou Word/PDF/TXT como principal, resumo e rodadas | Original preservado; fluxos por papel testados |
| Revisão | Revisor, retorno combinado, ajustes, respostas, comparação e aprovação | Ciclo exercitado no banco e na prévia com Sara |
| Organização | Filtros por ação, conversa por assunto e atualizações por peça | Avisos opcionais exigem aplicação aberta |
| Indicadores | Espera, decisão, ciclo, esforço manual e contatos externos | Sem conclusão sobre produtividade antes de observar uma dupla |
| E-mails de acesso | Modelos e configuração SMTP preparados | Credencial, salvamento e entrega real pendentes |

O esquema v0.25 está ativo no Supabase. [Evidências e limites dos testes](TESTES.md). Não reaplicar arquivos de referência SQL sobre o banco já migrado.

O plano Equipe tem opções mensal e anual na versão 0.27: [preços, configuração e limites](PLANO.md). A escolha continua sem ativar assinatura.

## Próximas ações, em ordem

| Ordem / ID | Prioridade | Ação | Critério de conclusão |
| --- | --- | --- | --- |
| 1 · EJ-01 | P0 | Concluir SMTP de teste e preparar envio de produção | Confirmação e recuperação recebidas em endereços externos; senha anterior e link reutilizado recusados. Para lançamento: serviço transacional e domínio autenticado |
| 2 · EJ-02 | P0 | Validar duas contas reais | Advogado e estagiário completam convite, atribuição, anexo, duas rodadas, conflito, aprovação e revogação em sessões independentes |
| 3 · EJ-04 | P0 | Preparar operação e recuperação | Homologação separada, HTTPS, monitoramento, backup de banco/arquivos e restauração ensaiada |
| 4 · EJ-05 | P0 | Definir tratamento dos dados e atendimento | Termos, privacidade, retenção, exclusão e responsabilidades revisados profissionalmente |
| 5 · EJ-11 | P0 | Observar uma dupla em piloto acompanhado | Referência anterior e 10 a 20 peças comparáveis, registrando espera, tempo ativo, devoluções, contatos externos e qualidade |
| 6 · EJ-08 | P1 | Ampliar qualidade de uso | E2E atualizado, acessibilidade, celular, documentos longos e carga com evidência de aceite |
| 7 · EJ-03 | P1 | Completar ciclo de vida dos anexos | Retenção/exclusão, recuperação e perda de acesso. Upload/download e isolamento já ativos |
| 8 · EJ-07 | P1 | Completar governança da equipe | Transferência de administração e desligamento com histórico e acesso revogado verificados |
| 9 · EJ-09 | P1 | Completar auditoria operacional | Eventos, retenção, acesso e logs sem credenciais ou conteúdo sigiloso |
| 10 · EJ-06 | P1 | Preparar contratação comercial | Oferta Equipe exibida; definir provedor, checkout, confirmação de pagamento e cancelamento. Cobrança permanece desativada |
| 11 · EJ-10 | P2 | Avaliar coedição e novos avisos | Necessidade confirmada no piloto. Não há coedição de caracteres nem avisos com navegador fechado |

Convites da equipe são compartilhados por link. SMTP de autenticação não ativa envio automático desses convites. A prévia Sara ajuda na demonstração, mas não conclui EJ-02.

## Como avaliar o piloto

1. Combinar janelas de revisão e prazo interno de retorno; registrar dúvidas no assunto da peça.
2. Comparar peças de complexidade semelhante, usando a rotina anterior como referência.
3. Separar espera por resposta de tempo efetivamente gasto redigindo ou revisando.
4. Registrar contatos fora da EloJus, retrabalho e qualidade. Definir metas numéricas após medir a referência.

## Rotina de gestão

Uma issue por entrega ou defeito, com problema, escopo, critério de aceite e evidência. Estados sugeridos: **A fazer → Em andamento → Em revisão → Concluído**. Os IDs acima são referências internas, não números de issues já criadas.

Usar branches curtas e PRs com impacto, testes e eventual migração. CI aprovada não equivale a implantação ou aceite operacional. GitHub Projects e proteção de branch não são configurados por estes documentos.

Antes da abertura comercial, concluir as dependências P0 ou delimitar formalmente o piloto com os responsáveis. Cobrança, tribunais e IA dependem de decisões próprias.
