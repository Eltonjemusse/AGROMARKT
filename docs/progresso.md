# Progresso do AgroMarket

## Objetivo e plano

Plataforma para aproximar agricultores/vendedores e compradores de produtos agrícolas, com catálogo, encomendas e administração.

1. **Segurança:** corrigir permissões, campos editáveis e validações. Concluir com ações indevidas e entradas inválidas rejeitadas e testadas. A fase 1A cobre apenas registo e edição de produtos.
2. **Dados e encomendas:** separar quantidade/unidade, melhorar valores monetários, controlar stock e estados, usar transações e preservar histórico. Concluir com totais corretos, stock consistente e histórico preservado.
3. **Funcionalidades:** recuperação de senha, perfil/configurações, páginas institucionais e imagens; definir relatórios. Concluir com fluxos completos e links funcionais.
4. **Interface:** uniformizar português, moeda, formulários e rodapés; melhorar erros, acessibilidade e utilização no telemóvel. Concluir com percursos principais verificados por teclado e em vários ecrãs.
5. **Preparação operacional:** atualizar documentação, confirmar hospedagem/configurações, verificações automáticas e cópias de segurança. Concluir com instalação reproduzível e verificações aprovadas antes de uma publicação autorizada.

## Fase 1A

- Ramo: `melhorias-agromarkt`. Commit local da fase 1A: `8dfcfad76556a73b09b08705913b5bae3c0f1488`. Sem push ou deploy.
- Registo público limitado a `comprador` e `vendedor`, conforme o frontend; omissão mantém `comprador`. `admin`, tipos desconhecidos e campos obrigatórios sem texto válido devolvem HTTP 400.
- Edição limitada a nome, descrição, preço, quantidade, categoria, imagem e localização. Identidade, proprietário, relações e datas internas são ignorados, incluindo operações aninhadas nesses campos. Mantém autorização de proprietário ou administrador e preserva campos omitidos. Preço enviado deve ser finito e positivo; aceita número ou texto numérico.
- Revisão do diff: não foi encontrado um defeito adicional no âmbito da fase 1A. Reforçados os testes de compatibilidade do registo, operações aninhadas e tentativas de contornar a autorização pelo corpo do pedido.
- Testes: `npm.cmd test` no backend, 26 testes aprovados. Prisma, bcrypt e JWT simulados; nenhuma configuração de ligação à base de dados é carregada. `git diff --check` aprovado.
- Limitações: testes dos controladores, sem integração HTTP/base de dados. Validação completa dos outros campos, login, contas e tokens existentes ficam fora desta fase. Nenhuma alteração ao esquema ou frontend.

## Fase 1B

- Só vendedores e administradores podem publicar produtos; compradores precisam de passar para vendedor numa etapa posterior. Vendedores podem comprar produtos alheios. Mantido o acesso administrativo e a autorização de proprietário/admin para edição.
- Criação de produto exige campos obrigatórios em texto não vazio e preço finito e positivo; imagem opcional deve ser texto ou nula. A quantidade do produto continua textual, sem interpretação como stock.
- IDs de produtos e encomendas validados antes de consultar/escrever, como inteiros positivos dentro do limite de Prisma Int, incluindo a remoção administrativa de produto.
- Encomendas aceitam quantidades numéricas positivas e fracionadas. Texto numérico decimal é aceite para compatibilidade com o formulário atual; booleanos, arrays, objetos, vazios, zero, negativos e não finitos são rejeitados com HTTP 400.
- Comprador vem da autenticação; vendedor e preço vêm do produto. Não são permitidas compras de produtos próprios, incluindo por admin. O preço guardado e o total calculado devem ser finitos e positivos. Campos do cliente como comprador, vendedor, preço, total e estado inicial não controlam a encomenda criada.
- Estados permitidos: `pendente`, `aceite`, `rejeitado`, `entregue`. Só o vendedor da encomenda ou admin podem alterar o estado; nenhuma nova transição foi imposta. Consultas continuam limitadas às compras/vendas da conta autenticada.
- Regra confirmada para futura implementação: stock descontado apenas na confirmação pelo vendedor; pendentes não reservam stock. Esta fase não lê a quantidade textual como stock, não a compara com a encomenda e não desconta nem reserva stock.
- Verificação: `npm.cmd test` no backend, **39 testes aprovados, zero falhas**, incluindo os 26 anteriores; `git diff --check` aprovado. Dependências de persistência simuladas, sem carregar Prisma, `.env` ou dados de produção. Testes cobrem permissões, corpos/IDs/preços/quantidades/estados inválidos, frações, totais inválidos e filtros de consulta.
- Fase 1B concluída e revista, sem defeitos adicionais de autorização/validação identificados no diff. Testes repetidos: 39 aprovados. Commit local desta fase: `fix: validar permissoes e encomendas`; sem push ou deploy. Sem alteração de esquema, frontend ou base de dados. Testes limitados aos controladores e validações; integração HTTP/base de dados não executada. Valores monetários continuam em Float.

## Pendências e produção

- Implementar conversão de comprador para vendedor.
- Implementar unidade estruturada e adaptar a interface para quantidades fracionadas com unidade explícita.
- Definir e implementar transições de estado, controlo de stock na confirmação e preservação do histórico nas remoções.
- Resolver os erros de lint existentes no frontend: a execução anterior de `npm.cmd run lint` registou 5 erros e 1 aviso relacionados com hooks; não foram corrigidos nesta fase.
- **A produção ainda não recebeu estas correções.**
- Antes da publicação, verificar a legitimidade das contas administrativas existentes e avaliar os tokens já emitidos. Essa verificação continua pendente: não consultar nem alterar dados de produção nesta etapa.
