# Histórico da EloJus

Versões mais recentes primeiro. O estado atual e as próximas ações estão no [roadmap](docs/ROADMAP.md); os registros antigos descrevem a etapa em que foram produzidos.

## Correções de uso - 21/10/2026

- O atalho de teclado "Ir para o conteúdo" mantém a peça e a rota atuais, levando apenas o foco ao conteúdo.
- "Salvar agora" aparece somente quando o texto pode ser editado; documentos aprovados ou em leitura não exibem essa ação.
- A demonstração de Sara e Administrador oculta o link de planos, que depende da sessão do escritório real.
- Sem mudança de banco, preços ou cobrança. Fluxo de duas rodadas, ajuste impeditivo e aprovação conferido com dados fictícios.

## 0.27.0 — mensal e anual

- Equipe mensal por R$ 149,90 e anual por R$ 1.558,80 antecipados, equivalente a R$ 129,90/mês; economia de R$ 240 (13,34%).
- Anual com implantação guiada de 60 minutos, acompanhamento de 30 minutos, checklist adaptado e preço-base garantido por 12 meses.
- Escolha, revisão e resumo exibem os valores, benefícios e condições da periodicidade salva; links de pagamento continuam vazios e cobrança indisponível.
- Migração amplia os códigos aceitos, preservando a preferência antiga, as permissões e os registros. Sem conversão automática da oferta anterior.
- Testes de ambas as opções, centavos, teclado, recarga, erros, isolamento, compatibilidade e telas de 1440/390/320 px; oito verificações no banco remoto com rollback.
- Detalhes e futura configuração em [Plano do escritório](docs/PLANO.md).

## 0.26.0 — plano Equipe

- Uma única oferta: R$ 129/mês para até três pessoas e R$ 19 por pessoa adicional.
- Acesso pelo menu do responsável, escolha persistida e resumo com condições.
- Catálogo central e ponto de configuração do futuro link; pagamento indisponível por padrão.
- Preferências antigas preservadas, sem assinatura, cobrança ou mudança de permissões.
- Testes de preço e navegador com PostgreSQL local, persistência, erros, isolamento e celular.
- Sem migração de banco. Detalhes em [Plano do escritório](docs/PLANO.md).

## 0.25.0 — preparação do ciclo de entrega

- Peça principal por Word, PDF ou TXT, com identificação do arquivo em cada rodada, versão, aprovação e comentário.
- Escolha explícita do conteúdo; arquivo entregue bloqueado para substituição durante revisão e após aprovação.
- Recuperação local de rascunhos pendentes, separada por conta, escritório, caso e aba.
- Central de atualizações e avisos opcionais com a aplicação aberta.
- Filtros de assuntos e navegação por pendências; localização conservadora de trechos no editor.
- Indicadores de decisão, ciclo até aprovação e espera pendente.
- Demonstração atualizada na porta 8772, preservando a prévia anterior.
- Suíte expandida e plano de operação/piloto em docs/PREPARACAO-ENTREGA.md.
- Modelos de confirmação e recuperação com identidade preta e branca, prévia local e roteiro SMTP; envio real ainda pendente da credencial e validação.
- Documentação consolidada por estado atual, evidências e prioridades; configurações e registros reais ficam fora do Git.

## Demonstração com Sara — 20/10/2026

- Atalho “Testar como Sara” na conta de Administrador do ambiente local.
- Visão “Sara · estagiária”, troca para Administrador e retorno ao escritório, com salvamento da minuta antes de trocar.
- Demonstração independente, sem cadastro por e-mail, usando casos fictícios e as regras SQL de acesso do escritório. Dados temporários em memória; autenticação e dados do Supabase preservados.

## Arquivos na área de redação — 20/10/2026

- Adicionado “Anexar Word, PDF ou TXT” acima do editor na demonstração e no escritório compartilhado. Advogados e estagiários com permissão de edição podem enviar arquivos originais, até 20 MB cada; cotas e regras existentes continuam aplicadas.
- Os anexos desses formatos aparecem junto da redação, com abertura/download na demonstração e download autenticado no Supabase. O conteúdo digitado é preservado; não há conversão automática do arquivo em texto.
- Testadas seleção e gravação dos três formatos pela visão de estagiário na demonstração, leitura por advogada, prévia de PDF e TXT. No Supabase, os três formatos foram enviados e baixados na peça fictícia ELO-0015, com SHA-256 idêntico, persistência após recarregar e minuta preservada na revisão 2.
- 17 testes locais de anexos, permissões da interface, validação e salvamento aprovados. Não houve alteração de esquema ou de permissões no banco.

## Criação guiada restrita a advogados — 20/10/2026

- Na demonstração, o convite e a seleção de tipo de peça guiada ficam disponíveis somente ao perfil de advogado. A ação de criação também verifica o perfil antes de gerar a nova peça.
- Estagiários continuam elaborando peças atribuídas, inclusive peças guiadas criadas pela advogada.
- Testados os três perfis na interface, negação da criação direta para estagiários/perfil desconhecido e criação dos dois tipos pela advogada. A opção guiada pertence a `demonstracao.html`; não existe comando equivalente no workspace compartilhado, portanto não foi necessária migração do Supabase.

## Correção do cursor no editor A4 — 20/10/2026

- Corrigido o cursor que aparecia no alto à direita ao abrir uma peça vazia ou apagar todo o texto. A primeira margem superior agora é espaço do contêiner; as exclusões continuam reservando as margens entre páginas.
- Mantidos A4, margens de 2,54 cm, zoom e conteúdo original. Recursos de paginação versionados nas páginas compartilhada e de demonstração para atualizar o cache.
- Navegador: cursor conferido nos quatro níveis de zoom; digitação e limpeza exercitadas. Documento longo com 1.106 fragmentos de texto respeitou as margens; formatação, desfazer/refazer, prévia e redução de páginas aprovados.

## Ativação da v0.24 — Supabase, 20/10/2026

- Aplicada `20261020142503_case_attachments_and_review_workflow_v24`, preservando os seis casos existentes; capacidades do banco confirmadas na versão 24.
- Bucket de documentos privado e RLS habilitado em todas as tabelas novas. Índice composto dos anexos acrescentado por migração complementar.
- 45 verificações do fluxo completo entre papéis aprovadas no Supabase, com rollback e nenhuma identidade fictícia permanente.
- Conta atual: criação da peça fictícia ELO-0015, upload/download real de TXT com SHA-256 idêntico, texto e conversa persistentes.
- O responsável optou por concluir com a conta atual e testes de papéis no banco. Duas sessões reais continuam pendentes; nenhum envio de e-mail, cobrança ou push ao GitHub nesta etapa.

## 0.24.0 — central de revisão e colaboração (20/10/2026; banco validado localmente)

- Mesa por ação para estagiários e central do advogado, com filtros, prioridade justificada, retorno combinado e ordenação por prazo. Consulta paginada evita ocultar peças antigas, comentários e versões.
- Revisor definido, diferente de quem elabora; peças agrupadas por caso sem ampliar o acesso do estagiário.
- Entrega com resumo, pontos de atenção, versão preservada e rodadas idempotentes.
- Dúvidas, ajustes e observações em assuntos com respostas; indicação de atendimento pelo autor separada da resolução pelo revisor.
- Comparação textual com inclusões/exclusões e seleção automática da rodada anterior; histórico de resumos e devolutivas.
- Atualizações agrupadas por peça, leitura por usuário e indicadores de espera. Registro manual do piloto para tempo ativo, contatos externos e qualidade.
- Regras de revisão, reatribuição, remoção de acesso e isolamento verificadas no banco local. Compatibilidade mantida com a v0.22 remota.
- A ativação dos esquemas v0.23/v0.24 continua pendente por decisão anterior do responsável; nenhuma nova migração remota aplicada nesta entrega.

## 0.23.0 — peças, anexos e editor (local, ainda sem migração remota)

- Seção “Documentos da peça” visível no formulário de criação, com formatos, limites e estado explícito de ativação. Permite selecionar novamente o mesmo arquivo após removê-lo. O envio permanece desativado no banco anterior.
- Estagiário inicia peça para si e abre diretamente o editor; navegação mostra apenas suas entregas.
- Anexos privados por caso com reserva, upload, confirmação, repetição segura e download autenticado.
- Folha A4 sem guias internas, margens normais de 2,54 cm e área branca clicável para continuar a escrita.
- Comentários preservam o editor e o desfazer; painel lateral ajustado à altura da janela.
- Comentários não alteram a revisão do texto; ações de mudança de etapa preservam o salvamento pendente.
- Prévia com dois perfis e PostgreSQL em memória; banco real mantido sem alterações por solicitação do responsável.

## 0.22.0 — cadastro e gestão da equipe

- Área “Equipe do escritório” com busca, filtro por função, ativos, convites e desativados.
- Cadastro pelo administrador: nome, e-mail, advogado/estagiário, OAB/UF e permissão de casos.
- Perfil profissional persistido no convite e no vínculo aceito no Supabase. Cada pessoa usa sua própria conta.
- Edição de cadastro, renovação de link, revogação e nova entrada após desativação; histórico preservado.
- Estagiários limitados aos casos atribuídos; gerenciamento da equipe exclusivo do administrador, validado no banco.
- 47 testes locais e 80 verificações SQL com fixtures desfeitas. SMTP e validação com duas contas reais continuam pendentes.

## 0.21.0 — escritório compartilhado

- Convites por link, equipe e permissões reais no banco.
- Casos, minutas, comentários, versões e atividades no Supabase.
- Controle de revisão contra sobrescrita concorrente; editor A4 e Word/PDF.
- Preparação GitHub: documentação, roadmap, configuração protegida, testes portáteis e CI. Sem implantação ou alteração comercial.

## 0.15–0.20 — entrada do escritório

- Apresentação, cadastro vinculado ao responsável e planos provisórios persistidos.
- Resumo de contratação sem preços definidos ou cobrança.

## 0.10–0.14 — autenticação

- Login, cadastro, recuperação e redefinição com Supabase Auth, confirmação e PKCE.

## 0.3–0.9 — editor e demonstração

- Distribuição, elaboração, revisão, comentários e versões locais.
- Construção guiada, anexos locais, edição contínua, peça completa e A4.

## 0.1–0.2 — protótipo e identidade

- Primeiro fluxo demonstrativo, marca vetorial, visual monocromático e fontes locais.
