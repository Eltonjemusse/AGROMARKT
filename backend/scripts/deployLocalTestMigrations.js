const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { testDatabaseConfig, psqlRunner } = require('../tests/helpers/migrationTestDatabase');

// Explicit operation on the already authorized local disposable database only.
function deploy() {
  const config = testDatabaseConfig(process.env);
  if (!config || config.pg.PGHOST !== '127.0.0.1' || config.pg.PGPORT !== '55432' || config.database !== 'agromarkt_test' ||
      process.env.AGROMARKET_TEST_DEPLOY_CONFIRM !== 'apply-versioned-migrations-local-only') {
    throw new Error('Deploy recusado: exige destino local autorizado e confirmação específica.');
  }
  const run = psqlRunner(process.env, config);
  const query = (sql) => {
    const result = run(['-X', '--no-password', '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', windowsHide: true, timeout: 20000 });
    if (result.status !== 0) throw new Error('Verificação PostgreSQL falhou; diagnóstico bruto ocultado.');
    return JSON.parse(result.stdout.trim());
  };
  const counts = () => query(`SELECT json_build_object('database',current_database(), 'users',(SELECT count(*) FROM "User"),
    'products',(SELECT count(*) FROM "Product"),'orders',(SELECT count(*) FROM "Order"));`);
  const initial = counts();
  if (initial.database !== 'agromarkt_test') throw new Error('Destino recusado.');
  console.log('Destino confirmado: 127.0.0.1:55432/agromarkt_test; sem limpeza/reset.');
  const source = path.resolve(__dirname, '../prisma');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'agromarket-local-deploy-'));
  const files = [];
  const directories = [];
  const write = (relative, data) => { const file = path.join(temporary, relative); fs.writeFileSync(file, data); files.push(file); };
  try {
    fs.mkdirSync(path.join(temporary, 'migrations'));
    directories.push(path.join(temporary, 'migrations'));
    write('schema.prisma', fs.readFileSync(path.join(source, 'schema.prisma'), 'utf8')
      .replace('env("DATABASE_URL")', 'env("AGROMARKET_TEST_DATABASE_URL")'));
    write('migrations/migration_lock.toml', fs.readFileSync(path.join(source, 'migrations/migration_lock.toml')));
    const names = fs.readdirSync(path.join(source, 'migrations')).filter((name) => /^\d+_/.test(name)).sort();
    const checksums = {};
    for (const name of names) {
      const directory = path.join(temporary, 'migrations', name);
      fs.mkdirSync(directory); directories.push(directory);
      const sql = fs.readFileSync(path.join(source, 'migrations', name, 'migration.sql'));
      checksums[name] = createHash('sha256').update(sql).digest('hex');
      write(`migrations/${name}/migration.sql`, sql);
    }
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      !/^(PG|DATABASE_URL$|DIRECT_URL$|SHADOW_DATABASE_URL$|DOTENV_|NODE_OPTIONS$|PRISMA_CONFIG)/i.test(key)));
    env.CHECKPOINT_DISABLE = '1'; env.PRISMA_HIDE_UPDATE_MESSAGE = 'true';
    const cli = (args) => {
      const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), ...args], {
        cwd: temporary, env, encoding: 'utf8', windowsHide: true, timeout: 60000
      });
      if (result.status !== 0) throw new Error(`Prisma ${args.slice(0, 2).join(' ')} falhou; diagnóstico bruto ocultado.`);
      console.log(`Prisma ${args.slice(0, 2).join(' ')}: exit 0`);
    };
    const history = () => query(`SELECT coalesce(json_agg(row_to_json(m) ORDER BY migration_name),'[]'::json)
      FROM (SELECT id,migration_name,checksum,finished_at::text,rolled_back_at::text,logs FROM "_prisma_migrations") m;`);
    const before = history();
    if (before.some((row) => !row.finished_at || row.rolled_back_at || row.logs || checksums[row.migration_name] !== row.checksum)) {
      throw new Error('Histórico divergente/incompleto: parar sem correções automáticas.');
    }
    cli(['migrate', 'deploy', '--schema', 'schema.prisma']);
    const applied = history();
    if (applied.length !== names.length || applied.some((row) => !row.finished_at || row.rolled_back_at || row.logs || checksums[row.migration_name] !== row.checksum)) {
      throw new Error('Histórico aplicado não corresponde aos ficheiros.');
    }
    cli(['migrate', 'status', '--schema', 'schema.prisma']);
    cli(['migrate', 'deploy', '--schema', 'schema.prisma']);
    if (JSON.stringify(history()) !== JSON.stringify(applied) || JSON.stringify(counts()) !== JSON.stringify(initial)) {
      throw new Error('Histórico ou contagens alterados de forma inesperada.');
    }
    cli(['migrate', 'diff', '--from-schema-datasource', 'schema.prisma', '--to-schema-datamodel', 'schema.prisma', '--exit-code']);
    console.log(`${applied.length} migrações concluídas; repetição sem alterações; contagens preservadas; esquema compatível.`);
  } finally {
    for (const file of files.reverse()) fs.unlinkSync(file);
    for (const directory of directories.reverse()) fs.rmdirSync(directory);
    fs.rmdirSync(temporary);
  }
}

try { deploy(); } catch (error) { console.error(error.message); process.exitCode = 1; }
