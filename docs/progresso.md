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

## Fase 2A.1

- Implementadas funções puras em `commercialDecimals.js`, usando apenas Decimal do runtime Prisma 5.22.0 instalado (cliente e CLI). Cópia isolada com precisão 40, sem Number/parseFloat nos cálculos comerciais.
- Definições para novos cálculos: quantidade/preço Decimal(18,6), total Decimal(30,2), MZN e ROUND_HALF_UP apenas no total final. kg/litro permitem frações até seis casas significativas; unidade/saco só inteiros. Não presumir peso de saco.
- Validação de texto decimal canónico, rejeição de excesso de escala significativo, valores fora dos limites e total arredondado para zero. Zeros finais excedentes são normalizados sem perda. Limites técnicos e configuração comercial explícita `maxTotal: null` documentados em `fase-2a-dados.md`; nenhum teto comercial inventado.
- Preparados campos opcionais e enums no `schema.prisma`, mantendo campos/relações antigos e sem defaults, migração, geração de cliente ou preenchimento de dados. Unidade definida por quatro códigos fixos e sincronização enum/validação testada.
- `npm.cmd test`: **57 testes aprovados, zero falhas**. Validação estática do esquema aprovada em pasta temporária com URL fictícia e sem carregar `.env`/configuração do projeto; `git diff --check` aprovado.
- Controladores, contratos e frontend continuam os da 1B. A 2A.2 deve integrar os decimais/formulários e preparar ensaios de migração isolada. Não foi implementado stock, conversão de legado ou acesso a produção. Entrega local 2A.1: `feat: preparar quantidades e valores decimais`, sem push ou deploy. Os dois documentos de planeamento foram preservados e atualizados.

## Preparação da migração 2A.2

- Migração SQL aditiva e transacional preparada após a inicial PostgreSQL, com enums/13 campos opcionais e CHECKs de limites, positividade, unidades inteiras e coerência condicional. Sem defaults, backfill ou alterações a relações/colunas antigas.
- Testes de integração usam apenas `AGROMARKET_TEST_DATABASE_URL` e confirmação explícita de uma base local de testes; sem fallback, criação/reset de base ou .env. Todo o DDL de teste pertence a uma transação revertida.
- Verificação inicial da preparação: 57 testes anteriores e 5 de preparação aprovados; nessa altura a integração ficou SKIP por falta de ligação. O ensaio real posterior está registado abaixo.
- Procedimento e limites documentados em [fase-2a2-migracao.md](fase-2a2-migracao.md), incluindo o arredondamento NUMERIC antes dos CHECKs e ordem esquema → cliente → backend → frontend.
- Ficheiros desta preparação sem commit. Nada aplicado a bases, sem integração dos novos campos, conversão de legado, stock, push ou deploy.

## Ensaio real PostgreSQL da migração 2A.2

- Base local descartável expressamente autorizada: `127.0.0.1:55432/agromarkt_test`. Contentor `agromarkt-postgres-test` em execução, com mapeamento exclusivo de `127.0.0.1:55432` para `5432/tcp` confirmado antes do SQL. Não se acedeu a produção.
- Ligação configurada apenas no ambiente do processo com as variáveis específicas de testes, nome exato e confirmação explícita. Sem alteração de `.env`, sem fallback para DATABASE_URL e sem guardar/apresentar credenciais.
- Ajustado o teste para aceitar exatamente o nome autorizado `agromarkt_test`. Como não existe psql no Windows, acrescentado transporte pelo psql já instalado no mesmo contentor: só aceita esse contentor/destino e verifica o mapeamento antes de usar o endpoint interno equivalente. Sem instalar ferramentas nem criar bases.
- Executado `node --test tests/migrationPreparation.test.js`: **6 testes aprovados, zero falhas, zero ignorados**, incluindo as proteções do transporte Docker.
- Executado `node --test tests/migration.integration.test.js` com a configuração específica: **1 integração real aprovada, zero falhas, zero ignorados**. O servidor confirmou o nome da base antes de qualquer DDL. A migração inicial, fixtures sintéticas legadas e corpo da migração aditiva correram num esquema único dentro de uma transação, terminada com ROLLBACK.
- Verificados dados antigos integrais, relações/restrições anteriores, campos novos nulos e sem defaults, escritas legadas/estruturadas, coerência completa/parcial, unidades, positividade, NaN/overflow, totais e persistência exata NUMERIC(18,6)/NUMERIC(30,2). Confirmado também o arredondamento de escala do PostgreSQL; a rejeição do excesso significativo na entrada continua nos validadores puros.
- Nenhuma correção ao SQL foi necessária. Alterados apenas helper/testes de integração/preparação e documentação. `git diff --check` aprovado. Os 57 testes anteriores não foram repetidos neste ensaio, pois o código comercial e o esquema não foram alterados.
- A migração não ficou aplicada permanentemente; não foi ensaiado migrate deploy ou `_prisma_migrations`. Geração/ativação do cliente, contratos/backend/frontend, conversão de legado, stock e transições continuam pendentes. Sem commit, push ou deploy.

## Validação operacional Prisma da migração 2A.2

- Destino confirmado novamente: `127.0.0.1:55432/agromarkt_test`, contentor `agromarkt-postgres-test`, PostgreSQL 16.15. Antes da aplicação, consultas de leitura confirmaram ausência de relações/enums de utilizador: o ensaio anterior não deixou tabelas. Nenhuma limpeza foi necessária ou executada.
- Acrescentado `tests/prismaDeploy.integration.test.js`, de execução explícita e com confirmação adicional `AGROMARKET_TEST_DEPLOY_CONFIRM=apply-versioned-migrations-local-only`. Recusa base não vazia, nunca cria/apaga/reinicializa bases e não integra o npm test normal.
- Prisma instalado 5.22.0 executado numa pasta temporária isolada, com cópias binárias das migrações e esquema que referencia apenas `AGROMARKET_TEST_DATABASE_URL`. Não copiou/carregou o `.env`, `prisma.config.ts` ou configuração de produção; as credenciais ficaram só no processo.
- Primeiro `migrate deploy --schema schema.prisma`: aprovado; migrações `20260528172609_init_postgres` e `20261022140000_add_structured_commercial_fields` aplicadas permanentemente apenas na base local descartável autorizada.
- `_prisma_migrations`: exatamente duas entradas concluídas, sem rolled_back_at/logs de erro, passos aplicados positivos e checksums SHA-256 iguais aos ficheiros versionados. `migrate status`: base atualizada.
- Segundo `migrate deploy`: sem migrações pendentes. Histórico completo, catálogo de colunas/enums/restrições e contagens de dados permaneceram iguais. As tabelas User/Product/Order ficaram vazias.
- `migrate diff --from-schema-datasource schema.prisma --to-schema-datamodel schema.prisma --exit-code`: exit 0, sem diferenças nos objetos modelados pelo Prisma. Os 13 CHECKs SQL personalizados foram verificados separadamente no catálogo; não são representados integralmente pelo Prisma.
- Testes reais desta etapa: **57 testes locais + 6 de preparação + 1 integração sintética com ROLLBACK + 1 ensaio operacional Prisma = 65 aprovados, zero falhas e zero ignorados**. `git diff --check` aprovado. Nenhuma migração precisou de correção.
- Atualizados o procedimento e este progresso; o novo teste operacional fica sem commit. Os ficheiros anteriores pendentes foram preservados. Sem acesso a produção, conversão de dados reais, alterações de API/frontend/stock, geração do cliente, commit, push ou deploy da aplicação.

## Fase 2A.3 — integração do backend

- Fase 2A.2 guardada em commit local `923acc6` (`test: validar migracao comercial em PostgreSQL`), apenas com os nove ficheiros correspondentes. Implementação 2A.3 deixada sem commit para revisão.
- Cliente Prisma 5.22.0 atualizado por geração isolada, sem carregar .env ou ligação real. Script repetível `npm.cmd run generate:isolated`; artefactos em node_modules, não versionados.
- Controladores usam validações/cálculos decimais no fluxo estruturado e devolvem novas quantidades/preços/totais como strings fixas. Quatro campos comerciais coerentes exigidos; projeções legadas sincronizadas; contradições e mudanças comerciais apenas pelo legado são rejeitadas. Contrato antigo mantém-se temporariamente.
- Encomendas estruturadas obtêm participantes/dados comerciais no servidor, guardam snapshots e não permitem a sua alteração. Produto antigo incompleto continua consultável, mas pedido estruturado devolve HTTP 409; não há conversão nem histórico inventado. Produtos em revisão não geram novas encomendas.
- Permissões 1A/1B mantidas. Pendentes não reservam/comparam/descontam disponibilidade; nenhum stock/transição foi implementado. Frontend não foi alterado.
- Testes: 62 locais, 6 de preparação/proteções e 11 HTTP/persistência real (10 subtestes e um exterior) na base local autorizada; dados sintéticos identificáveis e limpeza restrita ao próprio ensaio, confirmada. `git diff --check` aprovado. Não repetido o ensaio de base vazia.
- Contratos, compatibilidade temporária, tipos, snapshots, limites e ordem de ativação em [fase-2a3-backend.md](fase-2a3-backend.md). O legado continua Float sem snapshots, enquanto o fluxo estruturado usa Decimal exato; campos antigos são apenas projeções neste último.
- Pendentes frontend/ativação coordenada, fim do contrato legado, limites comerciais, stock/concorrência/idempotência (2B), transições/preservação nas remoções (2C). Sem produção, alteração de .env, push ou deploy.

## Pendências e produção

- Implementar conversão de comprador para vendedor.
- Implementar unidade estruturada e adaptar a interface para quantidades fracionadas com unidade explícita.
- Definir e implementar transições de estado, controlo de stock na confirmação e preservação do histórico nas remoções.
- Resolver os erros de lint existentes no frontend: a execução anterior de `npm.cmd run lint` registou 5 erros e 1 aviso relacionados com hooks; não foram corrigidos nesta fase.
- **A produção ainda não recebeu estas correções.**
- Antes da publicação, verificar a legitimidade das contas administrativas existentes e avaliar os tokens já emitidos. Essa verificação continua pendente: não consultar nem alterar dados de produção nesta etapa.
