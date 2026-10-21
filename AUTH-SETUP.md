# Autenticação e configuração

1. Prepare um projeto Supabase de desenvolvimento/homologação separado.
2. Em banco vazio, siga a ordem de [database/README.md](database/README.md). Não reaplique esses SQL em um banco já migrado.
3. Copie .env.example para .env. Informe origem HTTPS e chave publishable e execute pnpm configure:auth. O arquivo dist/auth-config.js gerado fica fora do Git.
4. Nunca use secret, service_role, senha do banco ou token de sessão no frontend. A chave publishable é pública; RLS e permissões protegem os registros. [Documentação oficial](https://supabase.com/docs/guides/getting-started/api-keys).

## Retornos locais

Em Authentication → URL Configuration:

- Site URL: http://127.0.0.1:8768
- Redirect URLs: http://127.0.0.1:8768/login.html**
- Redirect URLs: http://127.0.0.1:8768/redefinir-senha.html**

Mantenha confirmação de e-mail obrigatória. O cliente usa PKCE e permite somente destinos internos. Em produção, configurar domínio HTTPS e retornos restritos ao domínio; não copiar curingas amplos de desenvolvimento.

## SMTP pendente

Ainda não existe provedor SMTP configurado para lançamento público. Escolher serviço e domínio remetente, validar DNS, guardar credenciais somente no painel seguro e testar confirmação e recuperação. Após validação, definir ELO_EMAIL_SETUP_PENDING=false e gerar novamente a configuração.

Não desabilitar confirmação para contornar envio. O serviço padrão tem restrições; consulte [SMTP no Supabase](https://supabase.com/docs/guides/auth/auth-smtp).

### Teste provisório sem domínio próprio

É possível usar o SMTP de uma conta Gmail escolhida pelo responsável para os testes internos. Isso não valida a entrega de e-mails em produção: o Supabase alerta que provedores pessoais podem prejudicar a entregabilidade. Antes do lançamento, migrar para serviço transacional com domínio autenticado.

Em Authentication → Emails → SMTP Settings, preparar:

| Campo | Valor |
| --- | --- |
| Sender email address | Endereço completo da conta Gmail escolhida |
| Sender name | EloJus |
| Host | smtp.gmail.com |
| Port number | 465 (TLS implícito) |
| Username | Mesmo endereço completo da conta Gmail |
| Password | Senha de app, inserida pelo responsável diretamente no painel |

O responsável deve ativar a verificação em duas etapas e criar uma senha de app na conta Google. Não usar a senha normal, não colar a credencial em conversas e não adicioná-la ao repositório, ao frontend ou ao arquivo `.env` da aplicação. A credencial fica somente na configuração segura de SMTP do Supabase. Se a opção de senha de app estiver indisponível, não reduzir a segurança da conta; escolher um provedor compatível. Ao migrar de provedor, validar o novo envio e revogar a senha de app antiga no Google.

Referências: [SMTP do Google](https://support.google.com/a/answer/176600?hl=pt-BR), [senhas de app](https://support.google.com/mail/answer/185833?hl=pt-BR).

### Modelos dos e-mails

Os arquivos `emails/confirmacao.html` e `emails/recuperacao.html` contêm os modelos em português, com identidade preta e branca e sem imagens ou rastreadores externos. Os assuntos estão em `emails/templates.json`. Copiar o conteúdo integral para os modelos **Confirm sign up** e **Reset password** em Authentication → Emails → Templates.

Prévia local: executar `pnpm preview:emails` e abrir `http://127.0.0.1:8773`. Essa página não envia mensagens nem usa links de autenticação reais. O painel pode exigir SMTP personalizado ativo antes de permitir editar os modelos.

Preservar `{{ .ConfirmationURL }}` no botão e no endereço alternativo: o Supabase gera o link de verificação com o destino solicitado pela aplicação. Não substituí-lo por uma URL fixa de login ou redefinição. O fluxo usa PKCE, portanto o link deve ser aberto no mesmo navegador e perfil em que o cadastro ou a recuperação começou. Desativar rastreamento de cliques no provedor, se houver. [Modelos oficiais do Supabase](https://supabase.com/docs/guides/auth/auth-email-templates).

### Validação com duas contas reais

Usar a aplicação real em `http://127.0.0.1:8768`, com o servidor ativo. As prévias de Sara em outras portas usam identidades fictícias e não verificam envio ou autenticação real. Links locais só funcionam no computador que executa a EloJus; não tentar concluí-los no celular.

1. Manter a conta administradora existente. Cadastrar a segunda conta com endereço distinto e senha digitada pelo próprio usuário. Conferir remetente, assunto e entrega do e-mail (inclusive spam), abrir o link no mesmo navegador e concluir o login.
2. Sair da segunda conta, solicitar recuperação, abrir o novo e-mail e definir uma senha nova diretamente no formulário. Confirmar que a nova senha funciona, a antiga é recusada e o link consumido não pode ser usado novamente.
3. Entrar como administrador, convidar a segunda conta para o escritório como estagiário e aceitar o convite nessa conta. O convite da equipe continua usando o fluxo existente da EloJus; configurar SMTP de autenticação não cria envio automático de convites do escritório.
4. Usar perfis/navegadores separados para sessões simultâneas, ou sair antes de alternar as contas. Testar atribuição de caso, anexos, envio para revisão, ajustes e aprovação; confirmar que o estagiário não vê casos de terceiros.
5. Registrar apenas resultados e horários, sem senhas, links de acesso ou tokens. Só após entrega e fluxos reais aprovados, definir `ELO_EMAIL_SETUP_PENDING=false` e executar `pnpm configure:auth --force`.

Uma resposta de sucesso da recuperação não prova entrega na caixa postal. O roteiro permanece pendente até a validação do destinatário e dos acessos reais.

## Verificar

Testar cadastro confirmado, login, persistência, logout, recuperação, rejeição da senha antiga e de link consumido. Repetir convite e colaboração com uma segunda conta confirmada em sessão independente.

node tools/check-auth-config.cjs consulta opções públicas do Auth configurado; exige rede e não roda na CI. Revisar política de senhas e proteção contra senhas vazadas no ambiente de lançamento. Nenhuma assinatura ou upgrade está automatizado.

Veja evidências e pendências em [docs/TESTES.md](docs/TESTES.md).
