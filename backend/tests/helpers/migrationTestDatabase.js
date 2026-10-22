const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// No dotenv, PrismaClient or fallback to DATABASE_URL.
function testDatabaseConfig(env) {
  const raw = env.AGROMARKET_TEST_DATABASE_URL;
  if (!raw) return null;
  const fail = () => { throw new Error('Configuração de integração recusada: requer PostgreSQL local de testes, nome confirmado e autorização explícita'); };
  let url;
  try { url = new URL(raw); } catch { return fail(); }
  let database;
  try { database = decodeURIComponent(url.pathname.slice(1)); } catch { return fail(); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      !(database === 'agromarkt_test' || /^agromarket_test(?:_[a-z0-9_]+)?$/.test(database)) ||
      env.AGROMARKET_TEST_DATABASE_NAME !== database ||
      env.AGROMARKET_TEST_DATABASE_CONFIRM !== 'isolated-tests-only' ||
      !url.username || url.hash ||
      [...url.searchParams.keys()].some((key) => key !== 'sslmode') ||
      (url.searchParams.has('sslmode') && !['disable', 'prefer', 'require', 'verify-ca', 'verify-full'].includes(url.searchParams.get('sslmode')))) {
    return fail();
  }
  try {
    return {
      database,
      pg: {
        PGHOST: url.hostname === '[::1]' ? '::1' : url.hostname,
        PGPORT: url.port || '5432', PGDATABASE: database,
        PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password),
        PGSSLMODE: url.searchParams.get('sslmode') || 'prefer', PGCONNECT_TIMEOUT: '5'
      }
    };
  } catch { return fail(); }
}

function readMigration() {
  return fs.readFileSync(path.join(__dirname, '../../prisma/migrations/20261022140000_add_structured_commercial_fields/migration.sql'), 'utf8');
}

function migrationBody(sql) {
  if (!/^BEGIN;\s/.test(sql) || !/COMMIT;\s*$/.test(sql)) throw new Error('A migração deve ter uma única transação explícita');
  // Only replace the outer transaction: test DDL and fixtures share one ROLLBACK.
  return sql.replace(/^BEGIN;\s*/, '').replace(/COMMIT;\s*$/, '');
}

function psqlEnvironment(env, config) {
  // Prevent inherited PG* settings, service files or production URLs influencing psql.
  const clean = Object.fromEntries(Object.entries(env).filter(([key]) => !/^PG|DATABASE_URL|AGROMARKET_TEST_DATABASE_/i.test(key)));
  return { ...clean, ...config.pg, PGPASSFILE: path.join(__dirname, '__no_password_file__') };
}

function psqlRunner(env, config, spawn = spawnSync) {
  const container = env.AGROMARKET_TEST_CONTAINER;
  const clean = psqlEnvironment(env, config);
  if (!container) {
    return (args, options) => spawn(env.AGROMARKET_TEST_PSQL || 'psql', args, { ...options, env: clean });
  }
  // Only the explicitly authorized container/endpoint may use this transport.
  if (container !== 'agromarkt-postgres-test' || config.database !== 'agromarkt_test' ||
      config.pg.PGHOST !== '127.0.0.1' || config.pg.PGPORT !== '55432') {
    throw new Error('Transporte Docker recusado: destino não autorizado');
  }
  const docker = env.AGROMARKET_TEST_DOCKER || 'docker';
  const inspected = spawn(docker, ['inspect', '--format',
    '{"running":{{.State.Running}},"ports":{{json .NetworkSettings.Ports}}}', container],
  { encoding: 'utf8', windowsHide: true, timeout: 10000 });
  let metadata;
  try { metadata = JSON.parse(inspected.stdout); } catch { /* Refuse without metadata. */ }
  const bindings = metadata?.ports?.['5432/tcp'];
  if (inspected.status !== 0 || metadata?.running !== true || bindings?.length !== 1 ||
      bindings[0].HostIp !== '127.0.0.1' || bindings[0].HostPort !== '55432') {
    throw new Error('Transporte Docker recusado: mapeamento local exclusivo não confirmado');
  }
  // The mapping above proves this is the same PostgreSQL endpoint supplied by the user.
  // Inside that container the same server listens on loopback:5432.
  const internal = { ...clean, PGHOST: '127.0.0.1', PGPORT: '5432', PGPASSFILE: '/__no_password_file__' };
  const keys = Object.keys(config.pg).concat('PGPASSFILE');
  const forwarded = keys.flatMap((key) => ['--env', key]);
  return (args, options) => spawn(docker, ['exec', '--interactive', ...forwarded, container, 'psql', ...args],
    { ...options, env: internal });
}

module.exports = { testDatabaseConfig, readMigration, migrationBody, psqlEnvironment, psqlRunner };
