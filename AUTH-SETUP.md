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

## Verificar

Testar cadastro confirmado, login, persistência, logout, recuperação, rejeição da senha antiga e de link consumido. Repetir convite e colaboração com uma segunda conta confirmada em sessão independente.

node tools/check-auth-config.cjs consulta opções públicas do Auth configurado; exige rede e não roda na CI. Revisar política de senhas e proteção contra senhas vazadas no ambiente de lançamento. Nenhuma assinatura ou upgrade está automatizado.

Veja evidências e pendências em [docs/TESTES.md](docs/TESTES.md).
