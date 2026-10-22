const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { testDatabaseConfig, readMigration, migrationBody, psqlRunner } = require('./helpers/migrationTestDatabase');

test('migração aditiva em PostgreSQL exclusivamente de testes', (t) => {
  const config = testDatabaseConfig(process.env);
  if (!config) {
    t.skip('AGROMARKET_TEST_DATABASE_URL não configurada; nenhuma ligação ou migração executada');
    return;
  }
  const runPsql = psqlRunner(process.env, config);
  t.diagnostic(`Destino confirmado: ${config.pg.PGHOST}:${config.pg.PGPORT}/${config.database}`);
  const version = runPsql(['--version'], { encoding: 'utf8', windowsHide: true, timeout: 10000 });
  assert.equal(version.status, 0, 'psql local necessário; não é instalado automaticamente');
  const baseline = fs.readFileSync(path.join(__dirname, '../prisma/migrations/20260528172609_init_postgres/migration.sql'), 'utf8');
  const assertions = fs.readFileSync(path.join(__dirname, 'fixtures/migration-2a.sql'), 'utf8');
  const schema = `agromarket_migration_${randomBytes(8).toString('hex')}`;
  // Name is constrained to lowercase ASCII by testDatabaseConfig, never interpolated from an arbitrary URL.
  const script = `
\\set VERBOSITY sqlstate
DO $$ BEGIN
  IF current_database() <> '${config.database}' THEN RAISE EXCEPTION 'Wrong test database'; END IF;
END $$;
BEGIN;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';
CREATE SCHEMA "${schema}";
SET LOCAL search_path TO "${schema}", pg_catalog;
${baseline}
INSERT INTO "User" (id,nome,email,senha,tipo) VALUES
  (1,'Vendedor teste','seller@example.test','not-a-real-password','vendedor'),
  (2,'Comprador teste','buyer@example.test','not-a-real-password','comprador');
INSERT INTO "Product" (id,nome,descricao,preco,quantidade,categoria,localizacao,"userId")
  VALUES (1,'Legado','Não converter',0.1,'1,000 sacos','Outros','Teste',1);
INSERT INTO "Order" (id,"productId","buyerId","sellerId",quantidade,total,status)
  VALUES (1,1,2,1,'0.5',0.05,'pendente');
CREATE TEMP TABLE before_users AS SELECT id,to_jsonb(u) AS row FROM "User" u;
CREATE TEMP TABLE before_products AS SELECT id,to_jsonb(p) AS row FROM "Product" p;
CREATE TEMP TABLE before_orders AS SELECT id,to_jsonb(o) AS row FROM "Order" o;
CREATE TEMP TABLE before_constraints AS SELECT conrelid,conname,pg_get_constraintdef(oid) AS definition
  FROM pg_constraint WHERE conrelid IN ('"User"'::regclass,'"Product"'::regclass,'"Order"'::regclass);
${migrationBody(readMigration())}
${assertions}
ROLLBACK;
`;
  // psql ignores user rc files; secrets travel only in the child environment, not argv/output.
  // Disconnect/error also rolls back the transaction: no database create/drop/reset or committed DDL.
  const result = runPsql(['-X', '--no-password', '--quiet', '-v', 'ON_ERROR_STOP=1'], {
    input: script, encoding: 'utf8', windowsHide: true, timeout: 60000
  });
  const sqlstate = result.stderr?.match(/ERROR:\s+([0-9A-Z]{5})\b/);
  if (sqlstate) t.diagnostic(`SQLSTATE: ${sqlstate[1]}`);
  // Deliberately do not print connection settings or raw server diagnostics.
  assert.equal(result.status, 0, 'Integração falhou no ambiente de testes; credenciais e diagnóstico bruto foram ocultados');
});
