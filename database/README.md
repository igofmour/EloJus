# Esquema do banco

Referências SQL consolidadas para um projeto Supabase **vazio**, sem registros reais ou senhas.

1. office-registration.sql: escritório, responsável e RLS.
2. office-plan-selection.sql: plano e data de escolha, sem cobrança.
3. shared-office.sql: membros, convites, casos, comentários, versões e atividades.

Não reaplicar sobre banco existente: tabelas e políticas já podem estar criadas. Não confundir estes arquivos com o histórico remoto de migrações. Alterações futuras exigem migração incremental revisada e homologação.

Requer Supabase Auth e papéis padrão. As referências a service_role em GRANT não são credenciais. O teste atual é qa/shared-office-policies.sql, com fixtures fictícias e ROLLBACK, para homologação.

qa/legacy guarda testes anteriores à equipe compartilhada; exigem o esquema daquele estágio. O novo trigger de membros exige identidade autenticada ao criar escritórios.
