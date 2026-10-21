# Plano do escritório

Atualizado em 21/10/2026, versão 0.26.0.

## Oferta exibida

Uma opção, **Equipe**, por **R$ 129/mês por escritório**, com até **3 pessoas**. Cada pessoa adicional custa **R$ 19/mês**. Exemplos: quatro pessoas por R$ 148 e cinco por R$ 167. Mensal, sem fidelidade, sem implantação obrigatória e com orientação inicial de até 30 minutos incluída.

O responsável acessa **Plano do escritório** no menu do ambiente, seleciona, revisa e salva. A página de contratação mostra os dados do escritório, o preço-base e a regra para pessoas adicionais. O número de vagas ainda não é contratado ou cobrado nesta etapa.

## Estado da contratação

- Escolher o plano salva somente `offices.plan_code = equipe`, com a data fornecida pelo banco.
- Não ativa assinatura, teste gratuito, cobrança, renovação, limite de usuários ou cotas de armazenamento.
- O botão de pagamento fica desativado, com a informação **Contratação em breve**.
- Preferências antigas `essencial` e `personalizado` permanecem no banco. A interface pede uma nova confirmação antes de substituí-las pela opção atual. Uma escolha anterior `equipe` continua como preferência, sem representar aceite de cobrança.
- O preço é a oferta inicial para validação comercial. Não há anual, descontos automáticos ou reajustes programados.

## Onde configurar o pagamento depois

O catálogo fica em `dist/plan-catalog.js`. Os valores estão em centavos e alimentam as páginas de plano e contratação. `paymentUrl` está `null`.

Quando o meio de pagamento estiver definido, preencher `paymentUrl` com a URL HTTPS do checkout correspondente ao plano e atualizar a versão do recurso nas páginas. URLs vazias, inválidas, com credenciais ou sem HTTPS mantêm a ação indisponível. Não colocar chaves privadas nesse arquivo público.

O link funciona como encaminhamento ao checkout. O provedor deverá confirmar quantidade de acessos, total, recorrência e condições. Conectar o link **não** implementa confirmação de pagamento, assinatura ativa, webhook, cancelamento ou controle de vagas na EloJus. Essas integrações dependem do meio escolhido e ficam para a próxima etapa.

## Banco e compatibilidade

Nenhuma migração necessária. A alteração usa o código `equipe`, já aceito pelo esquema, e mantém as políticas e a API de seleção existentes. A API da aplicação recusa novas escolhas dos planos retirados; o banco conserva os códigos antigos para compatibilidade. Não há novas permissões ou acesso a dados de outros escritórios.

## Verificação

`pnpm test` inclui preço, limites de entrada, configuração de pagamento e leitura das preferências antigas. `pnpm test:database` verifica o esquema consolidado e permissões da plataforma.

`pnpm test:plans:browser` usa Playwright e `qa/plans-preview.cjs`: navegador, cliente Supabase real, API local de teste e PostgreSQL em memória. Autenticação e dados são fictícios; não se conecta ao projeto remoto. Verifica seleção, falha de salvamento, persistência, recarga, resumo, ausência de pagamento, escolha antiga, sessão encerrada, isolamento do responsável, erro de conexão e larguras de 1440, 390 e 320 px.

Requer Playwright instalado no ambiente de QA. Se estiver fora do projeto, indicar o caminho do pacote em `ELOJUS_PLAYWRIGHT_PATH`; `ELOJUS_BROWSER_CHANNEL=msedge` ou `chrome` permite usar um navegador instalado. Não adiciona dependências de navegador à aplicação. Evidências ficam em `test-results/plans/`, ignorado pelo Git.

Para inspeção manual: `pnpm preview:plans`, em `http://127.0.0.1:8774/planos.html`. O servidor é exclusivo de testes, aceita identidades fictícias e nunca deve ser publicado. A CI executa a suíte Node e PostgreSQL; a inspeção de navegador é separada.
