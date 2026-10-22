# Progresso do AgroMarket

## Objetivo e plano

Plataforma para aproximar agricultores/vendedores e compradores de produtos agrícolas, com catálogo, encomendas e administração.

1. **Segurança:** corrigir permissões, campos editáveis e validações. Concluir com ações indevidas e entradas inválidas rejeitadas e testadas. A fase 1A cobre apenas registo e edição de produtos.
2. **Dados e encomendas:** separar quantidade/unidade, melhorar valores monetários, controlar stock e estados, usar transações e preservar histórico. Concluir com totais corretos, stock consistente e histórico preservado.
3. **Funcionalidades:** recuperação de senha, perfil/configurações, páginas institucionais e imagens; definir relatórios. Concluir com fluxos completos e links funcionais.
4. **Interface:** uniformizar português, moeda, formulários e rodapés; melhorar erros, acessibilidade e utilização no telemóvel. Concluir com percursos principais verificados por teclado e em vários ecrãs.
5. **Preparação operacional:** atualizar documentação, confirmar hospedagem/configurações, verificações automáticas e cópias de segurança. Concluir com instalação reproduzível e verificações aprovadas antes de uma publicação autorizada.

## Fase 1A

- Ramo: `melhorias-agromarkt`. Alterações locais, sem commit, push ou deploy.
- Registo público limitado a `comprador` e `vendedor`, conforme o frontend; omissão mantém `comprador`. `admin`, tipos desconhecidos e campos obrigatórios sem texto válido devolvem HTTP 400.
- Edição limitada a nome, descrição, preço, quantidade, categoria, imagem e localização. Identidade, proprietário, relações e datas internas são ignorados, incluindo operações aninhadas nesses campos. Mantém autorização de proprietário ou administrador e preserva campos omitidos. Preço enviado deve ser finito e positivo; aceita número ou texto numérico.
- Revisão do diff: não foi encontrado um defeito adicional no âmbito da fase 1A. Reforçados os testes de compatibilidade do registo, operações aninhadas e tentativas de contornar a autorização pelo corpo do pedido.
- Testes: `npm.cmd test` no backend, 26 testes aprovados. Prisma, bcrypt e JWT simulados; nenhuma configuração de ligação à base de dados é carregada. `git diff --check` aprovado.
- Limitações: testes dos controladores, sem integração HTTP/base de dados. Validação completa dos outros campos, login, contas e tokens existentes ficam fora desta fase. Nenhuma alteração ao esquema ou frontend.

## Pendências e produção

- Definir e aplicar permissões de publicação de produtos.
- Validar quantidades, totais e transições de estado das encomendas.
- Implementar controlo de stock e preservar histórico nas remoções.
- Resolver os erros de lint existentes no frontend: a execução anterior de `npm.cmd run lint` registou 5 erros e 1 aviso relacionados com hooks; não foram corrigidos nesta fase.
- **A produção ainda não recebeu estas correções.**
- Antes da publicação, verificar a legitimidade das contas administrativas existentes e avaliar os tokens já emitidos. Essa verificação continua pendente: não consultar nem alterar dados de produção nesta etapa.
