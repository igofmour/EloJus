# Operação e continuidade

## Ambientes

O servidor local usa porta 8768 e serve apenas dist. Homologação e produção devem ter configuração, projetos Supabase e retornos separados. CI não usa o banco real. Publicar código no GitHub não implanta o site.

## Backup

Git guarda código e estrutura. Registros, usuários Auth, anexos e armazenamento do navegador exigem backup próprio, controle de acesso e restauração validada. Não usar issues, commits ou capturas como backup desses dados.

Antes de mudar o banco: registrar estado/migrações, preparar backup, ensaiar em homologação, revisar RLS, aplicar migração incremental e testar. Não reaplicar SQL consolidado em projeto existente.

## Credenciais e incidentes

Credenciais administrativas ficam em gerenciador seguro ou no serviço correspondente; nunca em exemplos, logs ou tickets. auth-config.js contém apenas configuração pública do frontend.

Se houver exposição: revogar/rotacionar no provedor, conter acesso, avaliar impacto e tratar histórico Git. Apagar somente o arquivo atual não revoga credenciais. Registrar incidente em canal privado apropriado.

## Release

1. Definir escopo e critérios de aceite.
2. Testar e revisar diffs, dependências e arquivos versionados.
3. Conferir navegador, sessões e permissões em homologação.
4. Atualizar CHANGELOG e aprovar implantação em etapa própria.
5. Registrar versão, responsável e evidência de recuperação quando aplicável.

tools/activate-workspace.py é um gerador histórico da v0.3 que sobrescreve a entrada: não executar para preparar a versão atual. Bundles em dist/vendor já permitem executar o site; regeneração deve preservar versões e licenças.
