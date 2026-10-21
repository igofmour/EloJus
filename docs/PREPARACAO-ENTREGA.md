# Preparação da EloJus para entrega — v0.25

A versão melhora o ciclo de entrega e revisão e está preparada para um piloto acompanhado. A economia de tempo ainda deve ser medida com uma dupla real. Cobrança permanece desativada.

## Entrega por Word, PDF ou TXT

1. Crie a peça e atribua quem elabora e quem revisa.
2. Anexe os arquivos, na criação ou em “Anexar Word, PDF ou TXT”.
3. Abra “Escolher conteúdo da peça” e selecione o texto do editor ou um arquivo confirmado.
4. Envie para revisão com um resumo e os pontos de atenção.
5. O advogado baixa o arquivo entregue, registra os ajustes com página/trecho e devolve a peça.
6. O autor anexa a versão corrigida, escolhe-a como principal, marca os ajustes atendidos e reenvia.
7. O revisor confirma a resolução dos impeditivos e aprova. O autor não aprova sua própria entrega.

Cada rodada, versão e aprovação aponta para o arquivo exato. Comentários e respostas mantêm a referência do documento discutido mesmo depois de uma nova entrega. Os originais não são sobrescritos. A comparação automática de texto existe para minutas do editor; arquivos são apresentados para download e conferência. DOCX, PDF e TXT podem ser a peça principal; imagens ficam como apoio.

## Conversa e avisos

- Pendentes, Ajustes, Dúvidas e Todos organizam a conversa. Próximo pendente percorre os assuntos visíveis.
- Localizar trecho procura uma ocorrência exata e única no editor. Se o texto mudou ou é ambíguo, a interface avisa; não inventa uma posição.
- Atualizações abre as peças com atividade ainda não lida e respeita o acesso do usuário.
- Avisos do navegador são opcionais, com intervalo de 5, 15 ou 30 minutos. Exibem apenas a quantidade de peças com novidades.
- A aplicação precisa estar aberta. Não há push com o navegador fechado nem envio de e-mails de atividades.

## Recuperação de rascunhos

O texto ainda não confirmado pelo servidor recebe uma cópia neste navegador, separada por usuário, escritório, peça e aba. Uma aba não elimina a cópia pendente de outra. Ao reabrir um caso acessível, a pessoa pode conferir, baixar ou restaurar explicitamente a cópia. A restauração não substitui automaticamente o conteúdo do escritório. É necessário salvar.

Cópias expiram após 7 dias; Sair limpa as cópias da conta neste navegador. Revogação detectada limpa a cópia do caso/conta local pertinente. Se o armazenamento do navegador falhar, aparece um aviso; use Salvar ou baixe o TXT. Não substitui backup e não é destinado a computador compartilhado sem sessão individual.

## Indicadores do piloto

Os tempos automáticos são corridos, incluindo noites e fins de semana:

- Primeira resposta: envio até primeiro retorno observado, que pode ser um comentário.
- Decisão: envio até aprovação ou devolução da rodada.
- Ciclo: primeira entrega até aprovação final, incluindo ajustes.
- Pendentes: rodadas ainda sem decisão, com maior espera.

Os registros manuais medem elaboração, revisão, contatos externos e qualidade. Compare peças de complexidade semelhante, mantendo a qualidade. Uma primeira resposta rápida não prova uma aprovação rápida.

## Validação desta versão

- 72 testes da suíte JavaScript, incluindo autenticação, gravação, isolamento, recuperação e avisos.
- PostgreSQL local: 44 verificações de escritório, 36 de equipe, 42 de peças/anexos, 45 do roteiro remoto v24, 49 do fluxo v24 e 25 de entregas por arquivo.
- Supabase: 25 verificações novas em transação descartável, encerrada com ROLLBACK; preservados 7 casos e 4 anexos existentes.
- Migrações aplicadas: `file_based_review_and_immutable_sources_v25` e `file_review_composite_reference_indexes`.
- Word/PDF: testes de exportação aprovados.
- Navegador: criação pela Sara, anexos DOCX/PDF/TXT, entrega do Word, ajuste impeditivo, segunda rodada em PDF, referência ao Word original e aprovação por outro papel.
- Dados de demonstração usam PostgreSQL local com as regras SQL. Isso não equivale a dois usuários reais autenticados em dispositivos diferentes.

## Antes de abrir comercialmente

| Item | Critério de conclusão | Dependência |
| --- | --- | --- |
| Publicação | HTTPS, domínio escolhido e URLs de retorno restritas ao domínio publicado | Hospedagem/domínio definidos pelo responsável |
| E-mails de acesso | Cadastro, confirmação e recuperação testados em endereços externos | Modelos prontos; SMTP provisório aguarda credencial e validação. Serviço transacional e domínio autenticado antes do lançamento |
| Autenticação | Rever proteção contra senhas vazadas no painel e políticas da conta | Recurso disponível no plano Supabase; sem contratar upgrade automaticamente |
| Uso real | Advogado e estagiário confirmados completam duas rodadas em dispositivos separados | Segunda conta real e disponibilidade da dupla |
| Operação | Backup de banco e arquivos, restauração demonstrada e procedimento de incidentes | Definição de responsável, retenção e ambiente de restauração |
| Dados e atendimento | Termos, privacidade, atendimento e rotinas de exclusão/retenção aprovados | Decisões comerciais e revisão profissional |
| Piloto | 10 a 20 peças comparáveis, registrando espera, retrabalho e contatos fora da plataforma | Equipe participante e observações reais |
| Cobrança | Oferta e preços definidos; checkout e cancelamento validados separadamente | Decisão posterior; nenhuma cobrança ativada |

Convites da equipe usam links compartilhados pelo administrador. O SMTP de autenticação não ativa envio automático desses convites. Configuração e roteiro de e-mails em [AUTH-SETUP.md](../AUTH-SETUP.md).

## Roteiro de aceite com a dupla

Use inicialmente dados fictícios. O administrador convida o estagiário; ele aceita com sua própria conta. O estagiário deve visualizar somente os casos atribuídos. Teste uma peça no editor e outra por arquivo, uma dúvida que impeça avançar, devolução, correção, comparação e aprovação. Confira a versão final em outro dispositivo. Remova ou reatribua um acesso de teste e confirme a restrição do caso e dos arquivos. Registre as dificuldades; não trate passagem em testes técnicos como prova de economia de tempo.

## Demonstração local e falha controlada

Execute `pnpm preview:sara` e abra `http://127.0.0.1:8772/index.html?persona=intern#inicio`. O Administrador local pode usar “Testar como Sara”. A porta 8771 anterior foi preservada; a atualizada está em 8772. Não publique o servidor de QA.

Somente o adaptador de QA aceita `failSave=1` na query da URL para simular falha de gravação. Ele mantém as leituras e recusa `save_case` sem enviar o texto ao banco. Remover o parâmetro e reabrir o mesmo caso permite verificar a recuperação da cópia local. Essa opção não existe na aplicação autenticada.

### Conferências adicionais

O roteiro remoto v24 foi repetido sobre a v25: 45 verificações de regressão aprovadas, totalizando 70 verificações remotas nesta entrega. O arquivo principal foi selecionado pela conta real na peça técnica fictícia, persistiu após recarregar e voltou ao texto do editor ao final. Os downloads DOCX, PDF e TXT na prévia tiveram hashes SHA-256 idênticos aos arquivos de entrada. A simulação de falha de gravação preservou o rascunho; a restauração explícita foi salva e conferida após recarregar. Filtros de dúvidas, localização de trecho único e navegação por pendência também foram conferidos na interface.

A checagem preventiva de credenciais agora inclui arquivos novos ainda não versionados: 384 arquivos verificados nesta revisão. Isso não equivale a uma auditoria externa de segurança.

O advisor do Supabase não apontou novos avisos de segurança nas mudanças. Permanece o aviso anterior de [proteção contra senhas vazadas desativada](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Os índices compostos novos foram conferidos; os avisos restantes de desempenho são índices ainda sem uso observado e duas políticas permissivas de leitura já existentes em offices. Não foram removidas políticas de acesso para apenas silenciar avisos.
