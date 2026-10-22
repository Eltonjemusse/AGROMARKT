const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { testDatabaseConfig, psqlRunner, readMigration } = require('./helpers/migrationTestDatabase');

// This operational test intentionally persists versioned migrations ONLY when
// explicitly authorized. It does not create/reset/clean databases or seed rows.
test('Prisma deploy permanente, histórico, repetição e diff na base local autorizada', (t) => {
  const config = testDatabaseConfig(process.env);
  if (!config) {
    t.skip('Sem configuração explícita de testes; nenhuma ligação executada');
    return;
  }
  assert.equal(process.env.AGROMARKET_TEST_DEPLOY_CONFIRM, 'apply-versioned-migrations-local-only',
    'Aplicação permanente exige confirmação específica, além da configuração de testes');
  assert.equal(config.pg.PGHOST, '127.0.0.1');
  assert.equal(config.pg.PGPORT, '55432');
  assert.equal(config.database, 'agromarkt_test');
  const runPsql = psqlRunner(process.env, config);
  function query(sql) {
    const result = runPsql(['-X', '--no-password', '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql], {
      encoding: 'utf8', windowsHide: true, timeout: 20000
    });
    assert.equal(result.status, 0, 'Verificação PostgreSQL falhou; diagnóstico bruto ocultado');
    return JSON.parse(result.stdout.trim());
  }
  const initial = query(`SELECT json_build_object('database',current_database(),
    'relations',(SELECT coalesce(json_agg(n.nspname||'.'||c.relname),'[]'::json)
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname !~ '^pg_'
      AND c.relkind IN ('r','p','v','m','S','f')),
    'enums',(SELECT coalesce(json_agg(t.typname),'[]'::json) FROM pg_type t
      JOIN pg_namespace n ON n.oid=t.typnamespace WHERE t.typtype='e'
      AND n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname !~ '^pg_'));`);
  assert.equal(initial.database, config.database);
  assert.deepEqual(initial.relations, [], 'Base não vazia: parar e informar; não há limpeza automática');
  assert.deepEqual(initial.enums, [], 'Enums inesperados: parar sem limpeza');
  t.diagnostic('Preflight aprovado: 127.0.0.1:55432/agromarkt_test sem relações/enums de utilizador');

  const names = ['20260528172609_init_postgres', '20261022140000_add_structured_commercial_fields'];
  const source = path.join(__dirname, '../prisma');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'agromarket-prisma-deploy-'));
  const files = [];
  const directories = [];
  function write(relative, content) {
    const destination = path.join(temporary, relative);
    fs.writeFileSync(destination, content);
    files.push(destination);
  }
  try {
    const migrations = path.join(temporary, 'migrations');
    fs.mkdirSync(migrations);
    directories.push(migrations);
    const schema = fs.readFileSync(path.join(source, 'schema.prisma'), 'utf8');
    assert.ok(schema.includes('env("DATABASE_URL")'));
    write('schema.prisma', schema.replace('env("DATABASE_URL")', 'env("AGROMARKET_TEST_DATABASE_URL")'));
    write('migrations/migration_lock.toml', fs.readFileSync(path.join(source, 'migrations/migration_lock.toml')));
    const checksums = {};
    for (const name of names) {
      const sql = fs.readFileSync(path.join(source, 'migrations', name, 'migration.sql'));
      checksums[name] = createHash('sha256').update(sql).digest('hex');
      const directory = path.join(migrations, name);
      fs.mkdirSync(directory);
      directories.push(directory);
      write(`migrations/${name}/migration.sql`, sql);
    }
    // No project .env, prisma.config.ts, package.json or generated client in cwd.
    const isolated = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      !/^(PG|DATABASE_URL$|DIRECT_URL$|SHADOW_DATABASE_URL$|DOTENV_|NODE_OPTIONS$|PRISMA_CONFIG)/i.test(key)));
    isolated.AGROMARKET_TEST_DATABASE_URL = process.env.AGROMARKET_TEST_DATABASE_URL;
    isolated.CHECKPOINT_DISABLE = '1';
    isolated.PRISMA_HIDE_UPDATE_MESSAGE = 'true';
    const cli = require.resolve('prisma/build/index.js');
    assert.equal(require('prisma/package.json').version, '5.22.0');
    function prisma(args, label) {
      const result = spawnSync(process.execPath, [cli, ...args], {
        cwd: temporary, env: isolated, encoding: 'utf8', windowsHide: true, timeout: 60000
      });
      // Do not expose a URI/password if an engine fails to connect.
      const code = `${result.stdout || ''}\n${result.stderr || ''}`.match(/\bP\d{4}\b/);
      if (code) t.diagnostic(`${label}: ${code[0]}`);
      assert.equal(result.status, 0, `${label} falhou; nenhuma correção/limpeza automática será executada`);
      t.diagnostic(`${label}: exit 0`);
      return result;
    }
    prisma(['migrate', 'deploy', '--schema', 'schema.prisma'], 'Primeiro migrate deploy');

    function history() {
      return query(`SELECT coalesce(json_agg(row_to_json(m) ORDER BY migration_name),'[]'::json)
        FROM (SELECT id,migration_name,checksum,started_at::text,finished_at::text,
          rolled_back_at::text,applied_steps_count,logs FROM public._prisma_migrations) m;`);
    }
    const before = history();
    assert.equal(before.length, 2);
    assert.deepEqual(before.map((row) => row.migration_name), names);
    for (const row of before) {
      assert.ok(row.finished_at);
      assert.equal(row.rolled_back_at, null);
      assert.equal(row.checksum, checksums[row.migration_name]);
      assert.ok(row.applied_steps_count > 0);
      assert.ok(row.logs === null || row.logs === '');
    }
    t.diagnostic('_prisma_migrations: duas entradas concluídas, checksums correspondentes, sem falhas/rollback');

    function catalog() {
      return query(`SELECT json_build_object(
        'columns',(SELECT json_agg(row_to_json(c) ORDER BY table_name,ordinal_position) FROM
          (SELECT table_name,column_name,ordinal_position,data_type,udt_name,is_nullable,column_default,numeric_precision,numeric_scale
           FROM information_schema.columns WHERE table_schema='public') c),
        'constraints',(SELECT json_agg(row_to_json(c) ORDER BY table_name,conname) FROM
          (SELECT r.relname AS table_name,c.conname,c.contype,pg_get_constraintdef(c.oid) AS definition
           FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace
           WHERE n.nspname='public') c),
        'enums',(SELECT json_agg(row_to_json(e) ORDER BY typname,enumsortorder) FROM
          (SELECT t.typname,e.enumlabel,e.enumsortorder FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
           JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public') e),
        'rows',json_build_object('users',(SELECT count(*) FROM public."User"),
          'products',(SELECT count(*) FROM public."Product"),'orders',(SELECT count(*) FROM public."Order")));`);
    }
    const schemaBefore = catalog();
    assert.deepEqual(schemaBefore.rows, { users: 0, products: 0, orders: 0 });
    const expectedChecks = [...readMigration().matchAll(/ADD CONSTRAINT "([^"]+)"/g)].map((match) => match[1]).sort();
    assert.equal(expectedChecks.length, 13);
    assert.deepEqual(schemaBefore.constraints.filter((row) => row.contype === 'c').map((row) => row.conname).sort(), expectedChecks);
    t.diagnostic('13 CHECKs SQL presentes; User/Product/Order vazias');

    const status = prisma(['migrate', 'status', '--schema', 'schema.prisma'], 'migrate status');
    assert.match(status.stdout, /Database schema is up to date/i);
    const repeated = prisma(['migrate', 'deploy', '--schema', 'schema.prisma'], 'Segundo migrate deploy');
    assert.match(repeated.stdout, /No pending migrations to apply/i);
    assert.deepEqual(history(), before, 'Segundo deploy não pode modificar o histórico');
    assert.deepEqual(catalog(), schemaBefore, 'Segundo deploy não pode modificar esquema ou dados');
    t.diagnostic('Segundo deploy: nenhuma pendência; histórico, catálogo e contagens inalterados');

    // Introspection/diff only; no shadow database, SQL execution or schema changes.
    prisma(['migrate', 'diff', '--from-schema-datasource', 'schema.prisma',
      '--to-schema-datamodel', 'schema.prisma', '--exit-code'], 'migrate diff somente leitura');
    assert.deepEqual(history(), before);
    assert.deepEqual(catalog(), schemaBefore);
    t.diagnostic('Diff vazio para os objetos modelados pelo Prisma; CHECKs customizados confirmados no catálogo');
  } finally {
    // Remove only the exact files/directories created above, never recursively.
    for (const file of files.reverse()) fs.unlinkSync(file);
    for (const directory of directories.reverse()) fs.rmdirSync(directory);
    fs.rmdirSync(temporary);
  }
});
