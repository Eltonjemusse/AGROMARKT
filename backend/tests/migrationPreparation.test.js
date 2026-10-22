const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { testDatabaseConfig, readMigration, migrationBody, psqlEnvironment, psqlRunner } = require('./helpers/migrationTestDatabase');

function environment() {
  return {
    AGROMARKET_TEST_DATABASE_URL: 'postgresql://test:fixture@127.0.0.1:5432/agromarket_test_fixture',
    AGROMARKET_TEST_DATABASE_NAME: 'agromarket_test_fixture',
    AGROMARKET_TEST_DATABASE_CONFIRM: 'isolated-tests-only'
  };
}

test('integração não usa DATABASE_URL como fallback', () => {
  assert.equal(testDatabaseConfig({ DATABASE_URL: 'postgresql://do-not-use/production' }), null);
  assert.equal(testDatabaseConfig({}), null);
});

test('ligação de teste exige identidade local, nome exato e confirmação', () => {
  assert.equal(testDatabaseConfig(environment()).database, 'agromarket_test_fixture');
  const authorized = testDatabaseConfig({ ...environment(),
    AGROMARKET_TEST_DATABASE_URL: 'postgresql://test:fixture@127.0.0.1:55432/agromarkt_test',
    AGROMARKET_TEST_DATABASE_NAME: 'agromarkt_test'
  });
  assert.equal(authorized.pg.PGHOST, '127.0.0.1');
  assert.equal(authorized.pg.PGPORT, '55432');
  assert.equal(authorized.database, 'agromarkt_test');
  for (const change of [
    { AGROMARKET_TEST_DATABASE_URL: 'not-a-url' },
    { AGROMARKET_TEST_DATABASE_URL: 'postgresql://test:fixture@remote.invalid/agromarket_test_fixture' },
    { AGROMARKET_TEST_DATABASE_URL: 'postgresql://test:fixture@localhost/production' },
    { AGROMARKET_TEST_DATABASE_URL: 'postgresql://test:fixture@localhost/agromarkt_production' },
    { AGROMARKET_TEST_DATABASE_URL: environment().AGROMARKET_TEST_DATABASE_URL + '?options=-csearch_path=public' },
    { AGROMARKET_TEST_DATABASE_URL: environment().AGROMARKET_TEST_DATABASE_URL + '?sslmode=invalid' },
    { AGROMARKET_TEST_DATABASE_NAME: 'agromarket_test_other' },
    { AGROMARKET_TEST_DATABASE_CONFIRM: undefined },
    { AGROMARKET_TEST_DATABASE_CONFIRM: 'production' }
  ]) {
    assert.throws(() => testDatabaseConfig({ ...environment(), ...change }), /Configuração de integração recusada/);
  }
});

test('processo psql não herda ligação/configuração PostgreSQL de produção', () => {
  const config = testDatabaseConfig(environment());
  const env = psqlEnvironment({ PGHOST: 'do-not-use', PGSERVICE: 'production', PGOPTIONS: 'unsafe',
    DATABASE_URL: 'do-not-use', PATH: 'fixture-path', ...environment() }, config);
  assert.equal(env.PGHOST, '127.0.0.1');
  assert.equal(env.PGDATABASE, 'agromarket_test_fixture');
  assert.equal(env.PGSERVICE, undefined);
  assert.equal(env.PGOPTIONS, undefined);
  assert.equal(env.DATABASE_URL, undefined);
  assert.equal(env.AGROMARKET_TEST_DATABASE_URL, undefined);
  assert.equal(env.PATH, 'fixture-path');
});

test('transporte Docker só aceita o contentor e mapeamento local autorizados', () => {
  const env = { ...environment(), AGROMARKET_TEST_CONTAINER: 'agromarkt-postgres-test',
    AGROMARKET_TEST_DATABASE_URL: 'postgresql://test:fixture@127.0.0.1:55432/agromarkt_test',
    AGROMARKET_TEST_DATABASE_NAME: 'agromarkt_test' };
  const config = testDatabaseConfig(env);
  const calls = [];
  const spawn = (binary, args, options) => {
    calls.push({ binary, args, options });
    return { status: 0, stdout: JSON.stringify({ running: true, ports: { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '55432' }] } }) };
  };
  psqlRunner(env, config, spawn)(['--version'], {});
  assert.equal(calls[0].args[0], 'inspect');
  assert.equal(calls[1].args[0], 'exec');
  assert.equal(calls[1].options.env.PGPORT, '5432');
  assert.equal(calls[1].options.env.PGDATABASE, 'agromarkt_test');
  assert.equal(calls[1].args.includes('fixture'), false);
  assert.equal(calls[1].args.includes('PGPASSWORD'), true);
  assert.throws(() => psqlRunner({ ...env, AGROMARKET_TEST_CONTAINER: 'other' }, config, spawn));
  assert.throws(() => psqlRunner(env, { ...config, pg: { ...config.pg, PGPORT: '5432' } }, spawn));
  for (const metadata of [{ running: false }, { running: true, ports: { '5432/tcp': [{ HostIp: '0.0.0.0', HostPort: '55432' }] } }]) {
    assert.throws(() => psqlRunner(env, config, () => ({ status: 0, stdout: JSON.stringify(metadata) })));
  }
});

test('migração é aditiva, transacional e preserva o histórico anterior', () => {
  const sql = readMigration();
  const body = migrationBody(sql);
  const executable = body.replace(/--[^\n]*/g, '');
  assert.doesNotMatch(executable, /\b(DROP|DELETE|UPDATE|INSERT|TRUNCATE|ALTER\s+COLUMN|ALTER\s+TYPE)\b/i);
  assert.doesNotMatch(executable, /\bDEFAULT\b/i);
  assert.equal((executable.match(/ADD COLUMN/g) || []).length, 13);
  assert.equal((executable.match(/CREATE TYPE/g) || []).length, 2);
  assert.match(executable, /"Product_structured_coherence"/);
  assert.match(executable, /"Order_structured_coherence"/);
  assert.match(executable, /"Order_validated_total_matches"/);
  const directories = fs.readdirSync(path.join(__dirname, '../prisma/migrations')).filter((name) => /^\d/.test(name)).sort();
  assert.deepEqual(directories, ['20260528172609_init_postgres', '20261022140000_add_structured_commercial_fields']);
  assert.throws(() => migrationBody('SELECT 1;'));
});

test('migração corresponde aos campos opcionais e enums do esquema', () => {
  const sql = readMigration();
  const schema = fs.readFileSync(path.join(__dirname, '../prisma/schema.prisma'), 'utf8');
  const tables = { Product: sql.match(/ALTER TABLE "Product"([\s\S]*?);/)[1], Order: sql.match(/ALTER TABLE "Order"([\s\S]*?);/)[1] };
  for (const [table, additions] of Object.entries(tables)) {
    const model = schema.match(new RegExp(`model ${table} \\{([\\s\\S]*?)\\n\\}`))[1];
    for (const [, name, type, precision, scale] of additions.matchAll(/ADD COLUMN "(\w+)" (DECIMAL\((\d+),(\d+)\)|CHAR\(3\)|TEXT|"\w+")/g)) {
      const line = model.split('\n').find((value) => new RegExp(`^\\s*${name}\\s`).test(value));
      assert.ok(line?.includes('?'), `${table}.${name}`);
      if (precision) assert.ok(line.includes(`@db.Decimal(${precision}, ${scale})`));
      if (type === 'CHAR(3)') assert.ok(line.includes('@db.Char(3)'));
    }
  }
  for (const name of ['Unidade', 'DadosEstruturadosEstado']) {
    const entries = schema.match(new RegExp(`enum ${name} \\{([^}]+)\\}`))[1].trim().split(/\s+/);
    for (const entry of entries) assert.ok(sql.includes(`'${entry}'`));
  }
});
