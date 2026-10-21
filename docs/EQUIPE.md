# Cadastro e gestão da equipe

Na EloJus, abra **Equipe do escritório → Cadastrar integrante** com a conta do advogado administrador.

1. Informe nome completo e e-mail de acesso.
2. Escolha Advogado(a) ou Estagiário(a). Para advogados, informe OAB e UF.
3. Escolha a permissão. Estagiários usam somente casos atribuídos. Advogados podem usar essa mesma restrição ou receber acesso a todos os casos, com gestão e revisão.
4. Salve o cadastro e compartilhe o link pessoal pelo canal do escritório.
5. A pessoa entra ou cria sua própria conta com o e-mail cadastrado, confirma o e-mail e aceita o convite. Só então aparece entre os integrantes ativos.

O cadastro não define senha para terceiros, não concede acesso antes do aceite e não ativa cobrança. O registro profissional é declarado pelo administrador; a EloJus não consulta a OAB automaticamente.

| Acesso | Casos | Revisão | Equipe |
| --- | --- | --- | --- |
| Administrador responsável | Todos; cria e distribui | Revisa, sem aprovar a própria entrega | Cadastra, edita e desativa integrantes |
| Gestão e revisão | Todos; cria e distribui | Revisa, sem aprovar a própria entrega | Consulta integrantes |
| Casos atribuídos | Apenas os atribuídos; inicia peças para si na v0.23; elabora e comenta | Envia para revisão, sem aprovar | Gestão oculta na navegação |

A criação de peças pelo estagiário depende da ativação da v0.23. Essa atualização está validada localmente e ainda não foi aplicada ao Supabase. Veja [Peças e anexos](PECAS-E-ANEXOS.md).

**Ativos** mostra integrantes com acesso. **Convites** mostra cadastros aguardando aceite, incluindo expirados. **Desativados** preserva a identidade das pessoas cujo acesso foi removido. A busca aceita nome, e-mail ou OAB; o filtro separa as funções profissionais.

“Editar cadastro” atualiza nome, função, OAB e permissão, sem trocar o e-mail da conta. “Renovar link” revoga o link anterior e gera outro válido por sete dias. “Revogar” cancela um convite. Para desativar alguém, primeiro reatribua seus casos abertos; o histórico permanece. Uma nova entrada exige outro convite e aceite.

As regras são aplicadas pelo banco, além dos controles da tela. Função profissional e permissão são campos distintos. A conta responsável pelo escritório permanece protegida contra remoção ou redução de acesso.

## Condições do ambiente atual

- O envio automático de e-mails de convite ainda não está configurado. O administrador copia e compartilha o link.
- Links com `127.0.0.1` ou `localhost` só funcionam no mesmo computador. O uso em computadores diferentes exige publicar a aplicação em um domínio acessível e configurar as URLs de Auth.
- Confirmação de novas contas e recuperação continuam sujeitas às limitações do serviço de e-mail atual do Supabase. SMTP próprio e teste com duas contas reais são pendências do piloto.
- Não existe transferência de titularidade ou inclusão de outro administrador nesta etapa.
