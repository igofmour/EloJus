# Peças, anexos e editor — v0.23

**Estado em 20/10/2026:** atualização aplicada ao Supabase junto da v0.24, após nova autorização do responsável. Upload e download privado conferidos pela conta atual, além de 45 testes de papéis no banco real. Nenhum push ao GitHub nesta etapa.

As tentativas anteriores permaneceram pendentes. Após a nova autorização, duas confirmações expiraram; a terceira aplicação concluiu com sucesso. O histórico remoto registra `20261020142503_case_attachments_and_review_workflow_v24`. Detalhes e limites estão em [TESTES.md](TESTES.md).

O formulário de criação apresenta **Documentos da peça**, logo após cliente e área. O campo está ativo no projeto atual e permite selecionar vários arquivos, conferir nome e tamanho e remover itens antes de criar a peça. A compatibilidade com projetos ainda na v0.22 mantém o seletor desativado apenas nesses projetos antigos.

## Uso previsto

Na área **Minhas peças**, o estagiário usa **Nova peça**. A peça é atribuída automaticamente a ele, aceita documentos durante a criação e abre diretamente no editor. Administradores e revisores podem acompanhar e distribuir as entregas do escritório.

O estagiário vê apenas os casos atribuídos a ele, incluindo os que iniciou. A página não apresenta navegação de gestão da equipe ou revisão geral. O banco também aplica a restrição: esconder controles não é a barreira de segurança. Reatribuição e desativação retiram o acesso à peça e aos documentos.

Na aba **Anexos**, quem tem acesso ao caso pode baixar os originais. O envio aceita PDF, DOCX, TXT, JPG e PNG, até 20 MiB por arquivo, dez arquivos e 100 MiB por caso. A tela apresenta os limites como MB. Os arquivos não são convertidos em texto nem incorporados automaticamente à minuta.

O envio tem reserva, armazenamento e confirmação. Repetir a ação usa o mesmo identificador, evitando duplicar a peça ou o anexo após perda da resposta. Uma pendência pode ser concluída, reenviada com o mesmo arquivo ou cancelada se o objeto ainda não tiver chegado. Reservas pendentes contam nos limites. Originais confirmados não podem ser substituídos ou excluídos por esses controles.

## Peça redigida no Word ou em outro programa

Na área de redação, **Anexar Word, PDF ou TXT** abre um envio dedicado a esses formatos. Aceita Word `.docx`; arquivos antigos `.doc` devem ser salvos em `.docx` antes do envio. O arquivo fica anexado ao caso, também disponível em **Anexos**, sem substituir ou converter o conteúdo do editor.

Advogados e estagiários usam o botão conforme a permissão de edição da peça. Em leitura, os arquivos disponíveis continuam acessíveis para download, respeitando o acesso ao caso. A lista junto da redação reúne os anexos DOCX, PDF e TXT do caso; documentos de apoio continuam na área geral de anexos. Isso não cria uma categoria de documento nem uma aprovação separada do arquivo.

A demonstração mantém arquivos somente neste navegador e permite prévia de PDF/TXT; Word é aberto por download. No escritório compartilhado, os originais ficam no Storage privado e são baixados pela sessão autenticada. Envio para revisão e aprovação continuam seguindo as regras existentes da minuta.

Validação desta opção: 17 testes locais aprovados; três formatos enviados pela visão simulada de estagiário e consultados pela advogada. Com a conta real, DOCX/PDF/TXT enviados na peça fictícia ELO-0015 e baixados com SHA-256 igual aos originais. Após recarregar, arquivos e texto anterior permaneceram disponíveis. Não foi necessária migração.

## Editor e conversa

- Folhas A4 com margens normais de 2,54 cm, sem linhas internas de guia. A separação entre páginas continua visível.
- O clique abaixo do texto posiciona a escrita no final da peça.
- Adicionar, resolver e reabrir comentários atualiza apenas a conversa. O editor, a seleção e o histórico de desfazer continuam montados.
- Comentários e versões não aumentam a revisão do texto. Edições, atribuições e mudanças de etapa continuam protegidas contra sobrescrita concorrente.
- Operações que substituem o documento suspendem a edição enquanto salvam; a digitação volta após a conclusão ou erro, conforme a permissão.
- O painel de comentários cabe na altura da janela e tem rolagem própria.
- Enviar para revisão coloca a minuta em leitura para o estagiário. Solicitar ajustes libera a elaboração. Comentários impeditivos não resolvidos bloqueiam aprovação.
- DOCX e PDF usam as mesmas margens normais. Quebras e métricas de fonte podem variar entre navegador, Word e PDF.

## Testes reproduzíveis, sem Supabase

```sh
pnpm test
pnpm test:database
pnpm preview:workflow
```

O último comando abre um servidor apenas em `127.0.0.1:8769`. Use:

- Estagiária: `http://127.0.0.1:8769/index.html?persona=intern#casos`
- Administradora: `http://127.0.0.1:8769/index.html?persona=admin#casos`
- Outro estagiário: `http://127.0.0.1:8769/index.html?persona=other#casos`

São identidades fictícias, PostgreSQL em memória (PGlite) e arquivos temporários em memória. O banco executa as migrações reais, incluindo RLS e RPCs. O contrato mínimo de Auth/Storage é reproduzido pelo ambiente local; ele não implementa o serviço HTTP completo do Supabase. Reiniciar o servidor descarta os dados.

**Não publique esse servidor ou o adaptador de QA.** A escolha de perfil é deliberadamente livre para testar permissões. A aplicação publicável fica em `dist/`; os utilitários de QA ficam fora dela.

## Implantação e continuidade

O projeto atual já recebeu `database/case-workflow.sql`, `database/case-attachments.sql` e `database/review-workflow.sql`, em sequência. Não reaplicar. A função `workspace_capabilities` libera a interface conforme a versão ativa. O bucket `case-documents` é privado.

Ainda falta repetir o fluxo com duas contas confirmadas em sessões independentes. Tamanho/MIME, upload/download reais e integridade do arquivo foram conferidos com a conta atual; revogação e isolamento foram exercitados com identidades descartáveis no banco. Não há varredura antimalware ou OCR nesta implementação. Reversão após o uso exige preservar dados e arquivos.
