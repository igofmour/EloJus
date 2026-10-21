# Plano do escritório

Atualizado em 21/10/2026, versão 0.27.0.

## Oferta exibida

Um plano **Equipe**, com duas opções de contratação para até **3 pessoas**:

| Condição | Mensal | Anual |
| --- | --- | --- |
| Código de preferência | `equipe_mensal` | `equipe_anual` |
| Valor por período | R$ 149,90/mês | R$ 1.558,80/ano, pagamento antecipado |
| Equivalente mensal | R$ 149,90 | R$ 129,90 |
| Economia frente a 12 mensalidades | — | R$ 240,00 (13,34%) |
| Orientação | Até 30 minutos | Implantação guiada de até 60 minutos |
| Acompanhamento | Suporte habitual | Uma reunião de até 30 minutos, entre o 30º e o 45º dia |
| Benefícios adicionais | Sem fidelidade anual | Checklist adaptado na implantação e preço-base garantido nos 12 meses |

Ambas incluem os mesmos recursos e suporte habitual, sem taxa obrigatória de implantação. O anual é uma contratação de 12 meses com pagamento antecipado; R$ 129,90 é o equivalente mensal, não uma cobrança recorrente nem uma oferta de 12 parcelas. Não anuncia dois meses grátis.

Pessoa adicional: R$ 19,00/mês; no anual, R$ 228,00 para 12 meses. Entradas durante o anual terão preço proporcional ao período restante, confirmado antes da contratação. A quantidade de pessoas e a proporcionalidade ainda não são contratadas nem cobradas na aplicação.

Os encontros são serviços agendados para adoção da plataforma: organização da equipe e do primeiro fluxo, checklist e revisão do uso. Não representam consultoria jurídica, migração ilimitada ou suporte exclusivo. Agendamento, entrega do checklist e acompanhamento são operacionais; não há automação de agenda nesta etapa. Regras de renovação, cancelamento e eventual reembolso precisam ser apresentadas antes de liberar a contratação.

## Escolha e persistência

O responsável acessa **Plano do escritório**, escolhe mensal ou anual, revisa e salva. As duas telas de resumo usam o catálogo central para preço, periodicidade e benefícios.

- Salva somente `offices.plan_code`, com `plan_selected_at` gerado pelo banco.
- Não ativa assinatura, teste gratuito, cobrança, renovação ou limite de usuários.
- Pagamento fica desativado, com **Contratação em breve**.
- As preferências anteriores `essencial`, `equipe` (R$ 129/mês) e `personalizado` permanecem intactas. A interface pede nova escolha; não converte preço nem periodicidade automaticamente.
- Trocar a seleção sem salvar não altera o resumo persistido. Repetir uma gravação idêntica preserva sua data.

## Links de pagamento, para configurar depois

`dist/plan-catalog.js` contém dois pontos independentes: `monthly.paymentUrl` e `annual.paymentUrl`, ambos `null`. Preencher apenas quando o checkout correspondente estiver pronto; nunca usar o mesmo checkout mensal para a opção anual. Aceita somente HTTPS sem credenciais na URL. Não colocar chaves privadas no catálogo público.

Conectar links apenas encaminha ao checkout. Confirmação de pagamento, quantidade de acessos, assinatura ativa, webhook, cancelamento, renovação, proporcionalidade e controle de vagas dependem da futura integração com o provedor.

## Banco e compatibilidade

A migração `monthly_and_annual_office_plans_v27` amplia somente `offices_plan_code_check`, mantendo os três códigos anteriores e acrescentando `equipe_mensal` e `equipe_anual`. Aplicada ao projeto EloJus em 21/10/2026. O trecho incremental está identificado ao final de `database/office-plan-selection.sql`; não reaplicar o arquivo inteiro no banco existente.

Não altera registros, RLS, permissões de atualização nem o trigger de data. A escolha anterior do escritório existente permaneceu `equipe`. O cliente aceita somente os dois novos códigos; a compatibilidade dos antigos no banco permite leitura e não representa uma assinatura.

## Verificação

- `pnpm test`: valores em centavos, economia, adicionais, catálogo, URLs, identidade verificada e confirmação de salvamento.
- `pnpm test:database`: regressões existentes e `qa/plan-billing.cjs`, que verifica migração com dados existentes, ambas as opções, repetição, anonimato, isolamento e campos protegidos.
- `qa/plan-billing-remote.sql`: oito verificações executadas localmente e no Supabase real, com identidades fictícias e ROLLBACK. Nenhum dado de teste permaneceu.
- `pnpm test:plans:browser`: navegador → cliente Supabase real → API local de QA → PostgreSQL descartável → resumo. Cobre ambos os períodos, teclado, persistência, recarga, seleção não salva, todas as preferências antigas, sessão encerrada, erros/repetição e acesso restrito ao responsável.
- Layout conferido em 1440, 390 e 320 px, sem rolagem horizontal. Evidências em `test-results/plans/`, fora do Git.

Playwright deve estar instalado no ambiente de QA. Se estiver fora do projeto, definir `ELOJUS_PLAYWRIGHT_PATH`; `ELOJUS_BROWSER_CHANNEL=msedge` ou `chrome` usa um navegador instalado. Não adiciona dependências de navegador à aplicação. A CI executa as suítes Node, PostgreSQL, exportações e scanner; o teste de navegador é local.

Para inspeção com dados fictícios: `pnpm preview:plans`, em `http://127.0.0.1:8774/planos.html`. O servidor é exclusivo de QA, aceita identidades fictícias e nunca deve ser publicado.
