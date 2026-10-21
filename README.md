# EloJus

![EloJus](dist/assets/elojus-logo-v2.svg)

Plataforma de trabalho para escritórios de advocacia: organizar casos, distribuir tarefas, elaborar minutas e revisar em equipe, com identidade visual em preto e branco.

**Versão 0.26.0 · validação para piloto.** O esquema v0.25 está ativo no Supabase desde 20/10/2026. Autenticação, anexos e colaboração foram conferidos com a conta atual; permissões e revisão entre papéis passaram em testes no banco real. Ainda faltam SMTP validado e o fluxo com duas contas reais. Contratação continua sem cobrança.

## Leitura rápida

- **Plano e futuro link de pagamento:** [configuração e limites](docs/PLANO.md).
- **O que mudou:** [histórico da versão](CHANGELOG.md).
- **O que falta e em qual ordem:** [roadmap gerencial](docs/ROADMAP.md).
- **Como operar e validar a entrega:** [plano de entrega](docs/PREPARACAO-ENTREGA.md) e [evidências dos testes](docs/TESTES.md).
- **Como configurar o acesso e os e-mails:** [autenticação e SMTP](AUTH-SETUP.md).

## Funcionalidades e estado

| Área | Estado |
| --- | --- |
| Apresentação, login, cadastro e recuperação | Implementados; envio público de e-mails depende de SMTP |
| Escritório e responsável | Cadastro salvo e vinculado à conta autenticada |
| Plano | Equipe: R$ 129/mês para até 3 pessoas, R$ 19 por adicional; escolha persistida |
| Contratação | Resumo do escritório, preço e condições; pagamento indisponível, link a configurar |
| Equipe | Cadastro de advogados e estagiários pelo administrador, OAB/UF, convites, edição e desativação com permissões no banco |
| Casos e minutas | Supabase, versões, comentários e fluxo de revisão |
| Editor | A4, margens, quebras visíveis, Word e PDF |
| Peças do estagiário e anexos privados | Ativos; upload/download real conferido e permissões testadas no banco |
| Central de revisão | Filtros, ordenação por prazo/prioridade e consulta de todas as peças acessíveis; compatível com o banco anterior |
| Revisor, rodadas e conversa por assunto | Ativos; fluxo de ajustes/aprovação e isolamento testados no banco real |
| Comparação e indicadores | Ativos; indicadores aguardam observações de uma dupla real |
| Entrega por arquivo | Word, PDF ou TXT como peça principal; cada rodada preserva o original |
| Rascunhos e avisos | Recuperação local por conta/peça e avisos opcionais com a aplicação aberta |
| E-mails de acesso | Modelos prontos em português; SMTP e entrega real ainda pendentes |

Consulte o [plano de entrega e operação](docs/PREPARACAO-ENTREGA.md) para os fluxos novos, evidências de validação e dependências antes da abertura comercial.

## Executar localmente

Requisitos: Node.js 22 ou superior, pnpm 11.25.0 e Python 3 para o servidor estático.

~~~sh
pnpm install --frozen-lockfile
~~~

Copie .env.example para .env. Preencha URL e chave **publishable** do seu projeto Supabase, configure o banco seguindo [AUTH-SETUP.md](AUTH-SETUP.md) e execute:

~~~sh
pnpm configure:auth
python -m http.server 8768 --bind 127.0.0.1 --directory dist
~~~

Abra [a apresentação local](http://127.0.0.1:8768/apresentacao.html). O comando de configuração preserva auth-config.js existente; substituição exige --force. Sirva apenas dist, nunca a raiz com .env.

Páginas públicas podem ser visualizadas sem configurar Supabase. Login e escritório compartilhado exigem configuração válida.

Para testar a v0.25 com perfis fictícios e PostgreSQL local em memória, use `pnpm preview:workflow` e abra [a prévia do estagiário](http://127.0.0.1:8769/index.html?persona=intern#casos). Use `?persona=admin#revisoes` para a central do advogado. Outra porta: `node qa/workflow-preview.cjs 8770`. Esse servidor é exclusivo de QA, descarta os dados ao encerrar e não deve ser publicado.

Para a demonstração **Sara · estagiária**, execute `pnpm preview:sara` e mantenha o servidor principal na porta 8768. Na conta de Administrador local, clique em **Testar como Sara**. A prévia abre na porta 8772 e permite alternar entre Administrador e Sara e voltar ao escritório. Não exige e-mail ou senha e não altera a sessão nem os dados do Supabase. Usa usuários e casos fictícios, com as mesmas regras SQL de acesso; documentos e alterações duram apenas enquanto o processo estiver aberto. A porta 8772 é exclusiva desse ambiente, ligado somente a `127.0.0.1`; ele não deve ser publicado. O atalho não aparece em domínios publicados.

## Organização

| Caminho | Conteúdo |
| --- | --- |
| dist/ | Fonte editável HTML/CSS/JS; não é build descartável |
| dist/assets/ | Identidade, fontes e licenças |
| dist/vendor/ | Bibliotecas locais fixadas, manifestos e licenças |
| database/ | Esquema consolidado, sem registros reais |
| emails/ | Modelos de confirmação e recuperação; sem credenciais ou links reais |
| qa/ | Testes SQL; exportações geradas ficam ignoradas |
| test-*.cjs | Testes Node de regras, autenticação e documentos |
| tools/ | Configuração, validação e utilitários |
| docs/ | Arquitetura, operação, prioridades e evidências |
| .github/ | CI e modelos de issues e pull requests |
| archive/ | Protótipo histórico da identidade v0.2 |
| brand/ | Wallpapers e materiais complementares da marca |

## Gestão e desenvolvimento

- [Arquitetura](docs/ARQUITETURA.md)
- [Cadastro e gestão da equipe](docs/EQUIPE.md)
- [Peças, anexos e editor — ativação e testes locais](docs/PECAS-E-ANEXOS.md)
- [Roadmap e critérios de aceite](docs/ROADMAP.md)
- [Operação e backup](docs/OPERACAO.md)
- [Testes e pendências](docs/TESTES.md)
- [Escopo da publicação](docs/PUBLICACAO.md)
- [Contribuição](CONTRIBUTING.md) · [Segurança](SECURITY.md) · [Histórico](CHANGELOG.md)

~~~sh
pnpm test
pnpm test:database
pnpm test:exports
pnpm check:repository
~~~

A CI executa testes locais e verificação preventiva dos arquivos. Não acessa o Supabase, não envia e-mails, não aplica SQL e não publica o site.

## Limites atuais

O teste entre duas contas reais confirmadas está pendente. O SMTP provisório foi preparado, mas o salvamento da credencial e a entrega dos e-mails ainda precisam ser confirmados. Para conferir os modelos sem enviar mensagens, execute `pnpm preview:emails` e abra `http://127.0.0.1:8773`.

Não há cobrança, IA jurídica, integração com tribunais, cálculo de prazos judiciais ou protocolo. OAB e dados profissionais são autodeclarados. Aprovação interna não equivale a validação jurídica externa. Os indicadores distinguem espera por resposta de esforço ativo; não demonstram economia de tempo antes de um piloto real. Convites do escritório são compartilhados por link; configurar SMTP de autenticação não ativa envio automático desses convites.

Este repositório guarda código e estrutura; não é backup de usuários ou processos. Bibliotecas e fontes conservam suas respectivas licenças em dist/vendor e dist/assets/fonts.
