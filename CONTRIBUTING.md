# Desenvolvimento

1. Leia README, arquitetura e roadmap. Abra issue com escopo e critério de aceite.
2. Use branch curta. Preserve preto e branco e separe demonstração de recursos compartilhados.
3. Instale com lockfile; use configuração de desenvolvimento e fixtures fictícias.
4. Execute testes e scanner. Mudanças visuais exigem inspeção no navegador.
5. Abra PR com problema, resultado, validação e impacto no banco; sem dados pessoais ou credenciais.

Schema existente exige migração incremental. Não reaplicar referências em produção. Mudanças de acesso precisam de testes negativos entre papéis e escritórios. Manter dependências fixadas e licenças.

A CI não implanta nem cobra. Branch protegida/revisão obrigatória precisam de configuração administrativa separada; estes arquivos não significam que as regras já estejam ativadas.
