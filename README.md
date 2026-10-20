# EloJus

![EloJus](dist/assets/elojus-logo-v2.svg)

Plataforma de trabalho para escritórios de advocacia: organizar casos, distribuir tarefas, elaborar minutas e revisar em equipe, com identidade visual em preto e branco.

**Versão 0.21.0 · desenvolvimento / validação de piloto.** Autenticação e colaboração usam Supabase. Contratação é uma prévia sem cobrança. O produto ainda não está declarado pronto para processos reais.

## Funcionalidades e estado

| Área | Estado |
| --- | --- |
| Apresentação, login, cadastro e recuperação | Implementados; envio público de e-mails depende de SMTP |
| Escritório e responsável | Cadastro salvo e vinculado à conta autenticada |
| Planos | Essencial, Equipe e Personalizado; escolha persistida, preços a definir |
| Contratação | Resumo do escritório e plano, sem pagamento |
| Equipe | Convites por link com validade de 7 dias e permissões no banco |
| Casos e minutas | Supabase, versões, comentários e fluxo de revisão |
| Editor | A4, margens, quebras visíveis, Word e PDF |
| Anexos | Disponíveis na demonstração local; compartilhamento pendente |

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

## Organização

| Caminho | Conteúdo |
| --- | --- |
| dist/ | Fonte editável HTML/CSS/JS; não é build descartável |
| dist/assets/ | Identidade, fontes e licenças |
| dist/vendor/ | Bibliotecas locais fixadas, manifestos e licenças |
| database/ | Esquema consolidado, sem registros reais |
| qa/ | Testes SQL; exportações geradas ficam ignoradas |
| test-*.cjs | Testes Node de regras, autenticação e documentos |
| tools/ | Configuração, validação e utilitários |
| docs/ | Arquitetura, operação, prioridades e evidências |
| .github/ | CI e modelos de issues e pull requests |
| archive/ | Protótipo histórico da identidade v0.2 |
| brand/ | Wallpapers e materiais complementares da marca |

## Gestão e desenvolvimento

- [Arquitetura](docs/ARQUITETURA.md)
- [Roadmap e critérios de aceite](docs/ROADMAP.md)
- [Operação e backup](docs/OPERACAO.md)
- [Testes e pendências](docs/TESTES.md)
- [Escopo da publicação](docs/PUBLICACAO.md)
- [Contribuição](CONTRIBUTING.md) · [Segurança](SECURITY.md) · [Histórico](CHANGELOG.md)

~~~sh
pnpm test
pnpm test:exports
pnpm check:repository
~~~

A CI executa testes locais e verificação preventiva dos arquivos. Não acessa o Supabase, não envia e-mails, não aplica SQL e não publica o site.

## Limites atuais

O teste entre duas contas reais confirmadas está pendente. Não há cobrança, anexos compartilhados, IA jurídica, integração com tribunais, cálculo de prazos judiciais ou protocolo. OAB e dados profissionais são autodeclarados. Aprovação interna não equivale a validação jurídica externa.

Este repositório guarda código e estrutura; não é backup de usuários ou processos. Bibliotecas e fontes conservam suas respectivas licenças em dist/vendor e dist/assets/fonts.
