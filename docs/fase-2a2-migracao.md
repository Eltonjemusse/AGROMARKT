# Preparação da migração 2A.2

Migração ensaiada com sucesso numa transação de testes com ROLLBACK e, posteriormente, aplicada por Prisma migrate deploy **apenas na base descartável local autorizada** `127.0.0.1:55432/agromarkt_test`. Não integra novos campos nos controladores/formulários, não converte legado e não implementa stock. Commit 2A.1: `b60e059` (`feat: preparar quantidades e valores decimais`). Os ficheiros da migração/integração continuam sem commit.

## Migração e compatibilidade

Ficheiro: `backend/prisma/migrations/20261022140000_add_structured_commercial_fields/migration.sql`.

- Vem depois de `20260528172609_init_postgres`, que permanece inalterada. `migration_lock.toml` continua com provider PostgreSQL.
- Acrescenta os dois enums e 13 colunas opcionais do `schema.prisma`. Não altera tipos, colunas, dados, chaves ou relações antigas. Não usa defaults, UPDATE, conversão de dados ou preenchimento automático de unidades/moeda/histórico/estado.
- Transação explícita BEGIN/COMMIT: os enums, campos e CHECKs são aplicados em conjunto ou revertidos. Não usa IF NOT EXISTS para esconder divergências. Deve ser aplicada uma única vez pelo gestor de migrações, após confirmação do destino.
- As colunas novas aceitam NULL. As escritas dos controladores atuais continuam válidas porque não preenchem campos estruturados. Gerar e ativar um cliente Prisma que conhece campos novos antes de aplicar o esquema pode fazer falhar leituras: respeitar a ordem abaixo.
- Os CHECKs são SQL personalizado, não representado integralmente pelo schema Prisma. Preservar este SQL em futuras migrações; não usar db push/pull para substituir a revisão do histórico.

## Restrições preparadas

- Disponibilidade não negativa; preço unitário e quantidade da encomenda positivos; total positivo. Limites finitos dos NUMERIC(18,6)/NUMERIC(30,2), incluindo rejeição explícita por limite superior de NaN. Zero de disponibilidade não significa reserva ou desconto de stock.
- MZN quando moeda é preenchida; quatro unidades fixas. Quantidades armazenadas em unidade/saco exigem inteiros; kg/litro permitem frações. Não existe conversão de peso de saco.
- Estado NULL exige todos os novos campos comerciais/históricos NULL. `pendente_revisao` permite evidência parcial, sem inventar os valores em falta; valores presentes continuam sujeitos às validações individuais. `validado` exige todos os campos completos.
- Numa encomenda validada, total = round(quantidade × preço unitário, 2). Nomes e versão de cálculo preenchidos não podem ser vazios. Em evidência parcial, o total conhecido pode ser mantido sem reconstruir um preço desconhecido.
- Não altera os estados antigos da encomenda nem impõe transições. Não compara disponibilidade com quantidade encomendada.

**Limite da validação SQL de escala:** PostgreSQL aplica o arredondamento de NUMERIC(p,s) antes dos CHECKs. Estes garantem a escala guardada, mas não conseguem detetar as casas já perdidas: por exemplo, `1.1234567` numa coluna NUMERIC(18,6) é guardado como `1.123457`. Isto também pode esconder uma fração minúscula antes da verificação de unidade inteira. A rejeição de excesso significativo na entrada pertence às funções puras de 2A.1, a integrar posteriormente; não alegar que o CHECK rejeita toda a entrada excessiva. Não mudar o tipo SQL para contornar esta limitação, pois deixaria de corresponder ao esquema aprovado.

## Testes preparados e isolamento

Ficheiros:

- `backend/tests/migrationPreparation.test.js`: guardas de ligação, ausência de fallback, estrutura aditiva, campos/enums e ordem do histórico; não liga a base alguma.
- `backend/tests/helpers/migrationTestDatabase.js`: preparação da ligação exclusivamente de testes e leitura da migração, sem dotenv ou PrismaClient.
- `backend/tests/migration.integration.test.js` e `fixtures/migration-2a.sql`: integração real através de psql, sem dependências novas ou instalação automática.

A integração exige simultaneamente:

1. `AGROMARKET_TEST_DATABASE_URL`, preenchida pelo operador através do mecanismo de segredos do seu ambiente. Nunca usar DATABASE_URL como alternativa.
2. `AGROMARKET_TEST_DATABASE_NAME` exatamente igual ao nome da URL. São aceites o nome expressamente autorizado `agromarkt_test`, ou os nomes anteriores `agromarket_test`/`agromarket_test_<sufixo>` com letras minúsculas, números e sublinhados.
3. `AGROMARKET_TEST_DATABASE_CONFIRM=isolated-tests-only`, depois de confirmar que a base é descartável, dedicada a testes e não contém dados reais.
4. Host local (`localhost`, `127.0.0.1`, `::1`); não usar túnel para produção. URLs remotas e parâmetros arbitrários de ligação são recusados. A única opção de URL aceite é sslmode válido.
5. psql no PATH ou caminho explícito em `AGROMARKET_TEST_PSQL`. Alternativamente, `AGROMARKET_TEST_CONTAINER=agromarkt-postgres-test` usa o psql já existente no contentor; `AGROMARKET_TEST_DOCKER` pode indicar o executável Docker. Este transporte só aceita `127.0.0.1:55432/agromarkt_test` e exige inspeção bem-sucedida de contentor em execução com mapeamento exclusivo `127.0.0.1:55432 → 5432/tcp`. Depois usa o mesmo servidor por `127.0.0.1:5432` dentro desse contentor. Não cria/inicia/puxa contentores. A conta deve poder criar esquemas/tabelas; a base é fornecida separadamente, nunca criada pelo teste.

Sem a variável URL, o teste fica SKIP antes de procurar psql ou ligar. Uma URL presente com guardas incompletas/incorretas provoca falha, não uma tentativa de ligação. O teste não carrega .env/.psqlrc, remove variáveis PG* herdadas, não usa .pgpass real e passa credenciais apenas pelo ambiente do processo filho, sem as imprimir ou colocar em argumentos. As mensagens brutas do servidor são ocultadas. O destino é conferido com current_database() antes de qualquer DDL.

Após validação do destino, cria um esquema de nome aleatório numa única transação. Reproduz a migração inicial, insere fixtures sintéticas, executa o corpo da nova migração e verifica os dados/restrições. Retira apenas o BEGIN/COMMIT externo da nova migração para incluir tudo no mesmo ROLLBACK final. Nunca cria/apaga/reinicializa a base, nunca faz DROP de esquemas e não deixa DDL ou dados confirmados. Erro, timeout ou desconexão também revertem a transação.

Cobertura preparada: comparação integral dos dados antigos, colunas novas NULL e sem defaults, relações/restrições antigas intactas, escrita pelo contrato legado, dados completos/parciais, unidades, rejeição de valores negativos/zero/NaN/overflow, snapshots incompletos, totais inconsistentes e persistência textual exata dos decimais. Inclui teste que demonstra honestamente o arredondamento de escala feito pelo PostgreSQL.

Para executar, na pasta backend, depois de configurar explicitamente o ambiente dedicado:

```powershell
npm.cmd test
node --test tests/migrationPreparation.test.js tests/migration.integration.test.js
```

Verificação inicial: 57 testes locais e 5 de preparação aprovados; nessa altura a integração ficou SKIP por falta de ligação. Depois, 6 testes de preparação e 1 integração real passaram, sem falhas/ignorados, no destino local autorizado. Sintaxe SQL, CHECKs, legado e decimais foram exercitados dentro da transação revertida. O ensaio operacional Prisma e a repetição dos testes foram concluídos posteriormente, como descrito abaixo; não foi necessário alterar a migração.

## Ensaio operacional concluído: migrate deploy

Teste explícito: `backend/tests/prismaDeploy.integration.test.js`. Além das variáveis de ligação específicas acima, exige `AGROMARKET_TEST_DEPLOY_CONFIRM=apply-versioned-migrations-local-only`. **Este teste aplica migrações permanentemente** apenas no destino local autorizado e exige que a base esteja inicialmente vazia. Não deve ser repetido agora sobre a base já migrada: a proteção vai recusá-la, sem limpar nada. O segundo deploy necessário à verificação de idempotência é executado dentro do mesmo ensaio.

Preflight de leitura: PostgreSQL **16.15**, base `agromarkt_test`, sem tabelas/vistas/sequências/enums de utilizador, e mapeamento exclusivo confirmado. Nenhuma limpeza/reset foi executada.

O teste criou uma pasta operacional temporária fora do projeto com `schema.prisma`, `migrations/migration_lock.toml` e cópias byte a byte das duas migrações. A única alteração na cópia de schema foi trocar `env("DATABASE_URL")` por `env("AGROMARKET_TEST_DATABASE_URL")`. A variável foi definida apenas no processo; não foi escrito um .env ou uma URL no esquema temporário. A pasta não continha prisma.config.ts/package.json do projeto. As variáveis de ligação de produção herdadas foram removidas do processo CLI. A CLI usada foi a instalada no projeto, Prisma **5.22.0**.

Comandos realmente executados a partir dessa pasta temporária, pelo teste:

```powershell
node D:\AgroMarket\backend\node_modules\prisma\build\index.js migrate deploy --schema schema.prisma
node D:\AgroMarket\backend\node_modules\prisma\build\index.js migrate status --schema schema.prisma
node D:\AgroMarket\backend\node_modules\prisma\build\index.js migrate deploy --schema schema.prisma
node D:\AgroMarket\backend\node_modules\prisma\build\index.js migrate diff --from-schema-datasource schema.prisma --to-schema-datamodel schema.prisma --exit-code
```

Resultados reais:

| Verificação | Resultado |
| --- | --- |
| Primeiro deploy | exit 0, duas migrações aplicadas permanentemente na base local |
| Histórico | `20260528172609_init_postgres` e `20261022140000_add_structured_commercial_fields`, ambas concluídas; checksums dos ficheiros confirmados, sem tentativa falhada/revertida |
| migrate status | exit 0, Database schema is up to date |
| Segundo deploy | exit 0, No pending migrations to apply |
| Idempotência | IDs/checksums/datas/logs/passos do histórico, catálogo de colunas/enums/restrições e contagens iguais antes/depois do segundo deploy |
| Comparação de leitura | diff exit 0; nenhuma diferença entre os objetos modelados no schema e a base |
| CHECKs não modelados | 13 CHECKs personalizados presentes no catálogo; não depender do diff Prisma para esta verificação |
| Dados da aplicação | User, Product e Order vazias; não foi semeado dado permanente |

Não foi usada base sombra: o diff compara a datasource da cópia isolada com o datamodel, sem executar o SQL do diff. Não se usou db push, db pull, reset, resolve ou correção manual para esconder diferenças. As migrações SQL permaneceram inalteradas.

Testes executados nesta validação:

```powershell
# Com configuração de testes e confirmação adicional só no processo:
node --test tests/prismaDeploy.integration.test.js
# Sem qualquer configuração de produção:
npm.cmd test
node --test tests/migrationPreparation.test.js
# Com a configuração específica de testes, sem confirmação de deploy permanente:
node --test tests/migration.integration.test.js
```

**65 testes aprovados: 57 locais, 6 de preparação, 1 integração com ROLLBACK e 1 operacional Prisma. Zero falhas e zero ignorados.** A integração sintética voltou a passar mesmo com o esquema público já migrado, pois usa um esquema aleatório e transação revertida. `git diff --check` aprovado. A pasta temporária do ensaio Prisma foi removida após as verificações; a base local permanece com o esquema migrado e histórico concluído.

## Procedimento futuro de aplicação

O procedimento foi ensaiado com sucesso na base local acima. A aplicação noutros ambientes, especialmente produção, continua a exigir autorização própria e as verificações correspondentes.

1. Rever SQL, código e CHECKs; confirmar versão PostgreSQL, permissões, destino e histórico aplicado. Verificar a presença/checksum da migração inicial. Se houver drift ou tabelas sem histórico correspondente, parar e investigar, sem forçar baseline ou marcar migrações como aplicadas.
2. Registar contagens e uma cópia de segurança consistente; ensaiar restauração em ambiente separado. Não usar dados reais nos testes deste repositório. Definir responsáveis, janela de manutenção e tempo máximo de bloqueio aceitável: os ALTER TABLE/CHECKs podem bloquear e varrer as tabelas.
3. Executar a integração dedicada acima; só avançar com resultado real aprovado. Ensaiar também o gestor Prisma e a sua recuperação de falha numa base de testes fornecida pelo operador, sem reset/criação automática.
4. **Esquema primeiro:** numa pasta operacional controlada, fora do projeto e sem .env, preparar cópia revista de schema/migrations/migration_lock. Usar a CLI instalada/pinada 5.22.0 e fornecer a ligação explicitamente pelo mecanismo autorizado. Só nesse ambiente confirmado aplicar `prisma migrate deploy` com `--schema` explícito. Não usar migrate dev, db push, db pull ou reset. Não aplicar o SQL manualmente e depois repetir a mesma migração pelo Prisma.
5. Confirmar conclusão da transação e registo no histórico, colunas/enums/CHECKs e conservação dos dados antigos. Não preencher campos novos nem marcar registos como validados. Se a migração falhar, seguir a recuperação abaixo antes de repetir.
6. **Cliente Prisma depois do esquema:** gerar o cliente a partir do schema revisto num build controlado e fictício/sem ligação real. Geração não é migração. Só ativar esse cliente contra uma base em que a migração já esteja concluída; preservar artefacto do cliente anterior para recuperação.
7. **Backend depois do cliente:** nesta etapa manter os controladores antigos. Numa entrega posterior, integrar funções decimais/snapshots/validação coerente e serialização em strings, com ativação controlada e testes. Não escrever dados novos incompletos com `validado`.
8. **Frontend depois do backend compatível:** numa entrega posterior, adaptar número/unidade/moeda, step e envio de strings. Manter novas funcionalidades desligadas até o backend e os formulários estarem prontos. A preparação atual não muda contratos nem ativa qualquer fluxo novo.

Não há migração de legado ou stock neste procedimento. Essas operações terão plano e autorização separados. As definições de MZN/unidades só passam a ser exigidas nas novas escritas estruturadas futuras; o legado permanece intacto.

## Recuperação

- Se o SQL falhar antes do COMMIT, a transação reverte as alterações. Confirmar o estado real no ambiente autorizado e o registo de falha do gestor Prisma antes de repetir; não editar migrações antigas ou usar reset.
- Se o gestor tiver deixado uma tentativa falhada, a resolução do histórico é manual e só depois de comprovar o rollback. Não marcar como aplicada uma migração incompleta nem usar resolve às cegas.
- Após aplicação bem-sucedida, preferir manter os campos opcionais e recuar a aplicação/cliente para os artefactos anteriores. Não apagar colunas/enums: são compatíveis com o legado e podem conter dados novos.
- Se já existirem escritas estruturadas posteriores, pausar os fluxos afetados e preservar/reconciliar esse delta antes de restaurar uma cópia. Um downgrade não pode perder unidades, snapshots ou precisão; não restaurar por cima de encomendas novas sem plano aprovado.
- Uma falha de CHECK devido a drift/dados inesperados exige investigação isolada. Não desativar restrições nem inventar dados para fazer a migração passar.

## Bloqueios e próximos passos

A base de testes foi fornecida/confirmada, a integração real foi aprovada e o ensaio pelo gestor Prisma foi concluído, incluindo histórico, repetição e diff de leitura. Faltam geração/ativação do cliente e integração futura dos contratos/controladores/formulários. Não se procuraram credenciais em .env nem se contactou produção. A migração e os testes continuam pendentes para revisão, sem commit; revisão/conversão do legado, stock e transições continuam fora desta etapa.
