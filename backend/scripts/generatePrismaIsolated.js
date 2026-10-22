const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

// Generate the installed client without reading project .env/config or connecting.
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'agromarket-generate-'));
const schemaFile = path.join(temporary, 'schema.prisma');
try {
  const output = path.resolve(__dirname, '../node_modules/.prisma/client').replace(/\\/g, '/');
  const generator = require.resolve('@prisma/client/generator-build').replace(/\\/g, '/');
  const schema = fs.readFileSync(path.join(__dirname, '../prisma/schema.prisma'), 'utf8')
    .replace('provider = "prisma-client-js"', `provider = ${JSON.stringify(`node ${generator}`)}\n  output = ${JSON.stringify(output)}`);
  fs.writeFileSync(schemaFile, schema);
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    !/^(DATABASE_URL|DIRECT_URL|SHADOW_DATABASE_URL|PG|DOTENV_|NODE_OPTIONS)/i.test(key)));
  env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/generation_only';
  env.CHECKPOINT_DISABLE = '1';
  env.PRISMA_GENERATE_SKIP_AUTOINSTALL = '1';
  const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'generate', '--schema', schemaFile], {
    cwd: temporary, env, encoding: 'utf8', windowsHide: true, timeout: 60000
  });
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  if (result.error) throw result.error;
  process.exitCode = result.status;
} finally {
  fs.unlinkSync(schemaFile);
  try { fs.rmdirSync(temporary); } catch (error) {
    if (error.code !== 'EBUSY') throw error;
    console.warn('Pasta temporária vazia ainda bloqueada pelo Windows; nenhum dado de ligação foi guardado');
  }
}
