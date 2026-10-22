const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomBytes } = require('node:crypto');
const { testDatabaseConfig, psqlRunner } = require('./helpers/migrationTestDatabase');

test('HTTP e persistência dos dados estruturados na base local autorizada', async (t) => {
  const config = testDatabaseConfig(process.env);
  if (!config) { t.skip('Sem ligação específica de testes; nenhuma base contactada'); return; }
  assert.equal(config.pg.PGHOST, '127.0.0.1');
  assert.equal(config.pg.PGPORT, '55432');
  assert.equal(config.database, 'agromarkt_test');
  const run = psqlRunner(process.env, config);
  const preflight = run(['-X', '--no-password', '-At', '-v', 'ON_ERROR_STOP=1', '-c',
    "SELECT json_build_object('database',current_database(),'completed',(SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL));"],
  { encoding: 'utf8', windowsHide: true, timeout: 15000 });
  assert.equal(preflight.status, 0, 'Base de testes deve estar migrada; não executar o ensaio de base vazia');
  assert.deepEqual(JSON.parse(preflight.stdout.trim()), { database: 'agromarkt_test', completed: 2 });

  // The isolated generator must not embed project .env paths in the client.
  const generated = fs.readFileSync(require.resolve('.prisma/client'), 'utf8');
  const paths = JSON.parse(generated.match(/"relativeEnvPaths":\s*(\{[^}]*\})/)[1]);
  assert.ok(Object.values(paths).every((value) => value === null));
  const previousDatabase = process.env.DATABASE_URL;
  const previousSecret = process.env.JWT_SECRET;
  delete process.env.DATABASE_URL;
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.AGROMARKET_TEST_DATABASE_URL } } });
  const prismaPath = require.resolve('../src/config/prisma');
  const previousModule = require.cache[prismaPath];
  // Inject only the explicitly configured test client; never evaluate config/prisma.js.
  require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
  const prefix = `it_2a3_${randomBytes(8).toString('hex')}`;
  const userIds = [];
  const accounts = {};
  let server;
  let count = 0;
  try {
    const actual = await prisma.$queryRaw`SELECT current_database() AS database`;
    assert.equal(actual[0].database, 'agromarkt_test');
    for (const [role, tipo] of [['seller', 'vendedor'], ['buyer', 'comprador'], ['other', 'vendedor'], ['admin', 'admin']]) {
      const user = await prisma.user.create({ data: {
        nome: `${prefix}_${role}`, email: `${prefix}.${role}@example.test`, senha: 'synthetic-not-a-login', tipo
      } });
      userIds.push(user.id);
      accounts[role] = { ...user, token: require('jsonwebtoken').sign({ id: user.id, tipo }, process.env.JWT_SECRET, { expiresIn: '10m' }) };
    }
    const app = require('express')();
    app.use(require('express').json());
    app.use('/api/auth', require('../src/routes/authRoutes'));
    app.use('/api/products', require('../src/routes/productRoutes'));
    app.use('/api/orders', require('../src/routes/orderRoutes'));
    app.use('/api/admin', require('../src/routes/adminRoutes'));
    server = await new Promise((resolve) => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
    const base = `http://127.0.0.1:${server.address().port}/api`;
    async function http(method, route, role, body) {
      const headers = {};
      if (role) headers.Authorization = `Bearer ${accounts[role].token}`;
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      const response = await fetch(base + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      const data = await response.json();
      return { status: response.status, data };
    }
    function input(extra = {}) {
      return { nome: `${prefix}_product_${++count}`, descricao: 'Produto sintético', categoria: 'Outros',
        localizacao: 'Teste isolado', quantidadeDisponivel: '12.500000', unidade: 'kg',
        precoUnitario: '0.200000', moeda: 'MZN', ...extra };
    }
    async function product(extra = {}, role = 'seller') {
      const result = await http('POST', '/products', role, input(extra));
      assert.equal(result.status, 201, result.data.message);
      return result.data.product;
    }

    await t.test('autenticação, tipos públicos e permissões de publicação/edição mantidos', async () => {
      assert.equal((await http('POST', '/products', null, input())).status, 401);
      assert.equal((await http('POST', '/products', 'buyer', input())).status, 403);
      assert.equal((await http('POST', '/auth/register', null, { nome: prefix, email: `${prefix}@example.test`, senha: 'synthetic', tipo: 'admin' })).status, 400);
      const p = await product({ userId: accounts.other.id, user: { connect: { id: accounts.other.id } } });
      assert.equal(p.userId, accounts.seller.id);
      assert.equal((await http('PUT', `/products/${p.id}`, 'other', { nome: `${prefix}_foreign` })).status, 403);
      const edited = await http('PUT', `/products/${p.id}`, 'admin', { nome: `${prefix}_admin`, userId: accounts.other.id,
        user: { connect: { id: accounts.other.id } }, orders: { deleteMany: {} }, createdAt: '2030-01-01' });
      assert.equal(edited.status, 200);
      assert.equal(edited.data.product.userId, accounts.seller.id);
      assert.equal((await product({}, 'admin')).userId, accounts.admin.id);
    });

    await t.test('criação exige dados completos/coerentes e texto decimal válido', async () => {
      for (const key of ['quantidadeDisponivel', 'unidade', 'precoUnitario', 'moeda']) {
        const body = input(); delete body[key];
        assert.equal((await http('POST', '/products', 'seller', body)).status, 400, key);
      }
      for (const extra of [{ precoUnitario: 0.2 }, { precoUnitario: '0' }, { quantidadeDisponivel: [] },
        { quantidadeDisponivel: '1.0000001' }, { unidade: 'saco', quantidadeDisponivel: '1.5' },
        { moeda: 'USD' }, { preco: 0.3 }, { quantidade: 'outro texto' }]) {
        assert.equal((await http('POST', '/products', 'seller', input(extra))).status, 400);
      }
      const p = await product({ quantidade: '12.5 kg', preco: 0.2 });
      assert.equal(p.quantidadeDisponivel, '12.500000');
      assert.equal(p.precoUnitario, '0.200000');
      assert.equal(p.preco, 0.2);
      const saved = await prisma.product.findUnique({ where: { id: p.id } });
      assert.equal(saved.quantidadeDisponivel.toFixed(6), '12.500000');
      assert.equal(saved.precoUnitario.toFixed(6), '0.200000');
      assert.equal(saved.dadosEstruturadosEstado, 'validado');
    });

    await t.test('listagem, detalhe, meus produtos e admin serializam decimais como strings', async () => {
      const p = await product();
      for (const [route, role] of [['/products', null], ['/products/my-products', 'seller'], ['/admin/products', 'admin']]) {
        const result = await http('GET', route, role);
        assert.equal(result.status, 200);
        const item = result.data.find((row) => row.id === p.id);
        assert.equal(item.precoUnitario, '0.200000');
        assert.equal(item.quantidadeDisponivel, '12.500000');
      }
      assert.equal((await http('GET', `/products/${p.id}`, null)).data.precoUnitario, '0.200000');
    });

    await t.test('edição mantém os dois contratos sincronizados e impede bypass legado', async () => {
      const p = await product();
      assert.equal((await http('PUT', `/products/${p.id}`, 'seller', { preco: 0.3 })).status, 400);
      assert.equal((await http('PUT', `/products/${p.id}`, 'seller', { quantidade: '100 kg' })).status, 400);
      const echo = await http('PUT', `/products/${p.id}`, 'seller', { nome: `${prefix}_metadata`, preco: p.preco, quantidade: p.quantidade });
      assert.equal(echo.status, 200);
      assert.equal(echo.data.product.precoUnitario, '0.200000');
      const edited = await http('PUT', `/products/${p.id}`, 'seller', { precoUnitario: '1.250000', quantidadeDisponivel: '20' });
      assert.equal(edited.status, 200);
      assert.equal(edited.data.product.preco, 1.25);
      assert.equal(edited.data.product.quantidade, '20 kg');
      assert.equal(edited.data.product.quantidadeDisponivel, '20.000000');
      assert.equal((await http('PUT', `/products/${p.id}`, 'seller', { precoUnitario: '2', preco: 3 })).status, 400);
      const saved = await prisma.product.findUnique({ where: { id: p.id } });
      assert.equal(saved.precoUnitario.toFixed(6), '1.250000');
      assert.equal(saved.quantidadeDisponivel.toFixed(6), '20.000000');
    });

    await t.test('encomenda fracionada guarda snapshots do servidor e arredonda só o total', async () => {
      const p = await product();
      const created = await http('POST', '/orders', 'buyer', { productId: p.id, quantidadeNumerica: '0.125', buyerId: accounts.other.id, sellerId: accounts.other.id });
      assert.equal(created.status, 201, created.data.message);
      const o = created.data.order;
      assert.equal(o.buyerId, accounts.buyer.id);
      assert.equal(o.sellerId, accounts.seller.id);
      assert.equal(o.quantidadeNumerica, '0.125000');
      assert.equal(o.precoUnitarioSnapshot, '0.200000');
      assert.equal(o.totalDecimal, '0.03');
      assert.equal(o.unidadeSnapshot, 'kg');
      assert.equal(o.moedaSnapshot, 'MZN');
      assert.equal(o.nomeProdutoSnapshot, p.nome);
      assert.equal(o.status, 'pendente');
      const saved = await prisma.order.findUnique({ where: { id: o.id } });
      assert.equal(saved.totalDecimal.toFixed(2), '0.03');
      assert.equal(saved.quantidadeNumerica.toFixed(6), '0.125000');
      for (const role of ['buyer', 'other', 'admin']) {
        const legacyShape = await http('POST', '/orders', role, { productId: p.id, quantidade: '0.5' });
        assert.equal(legacyShape.status, 201);
        assert.equal(legacyShape.data.order.totalDecimal, '0.10');
      }
      assert.equal((await http('POST', '/orders', 'seller', { productId: p.id, quantidadeNumerica: '1' })).status, 400);
    });

    await t.test('entradas contraditórias e snapshots enviados pelo cliente são rejeitados', async () => {
      const p = await product();
      for (const extra of [{ quantidadeNumerica: 1 }, { quantidadeNumerica: true }, { quantidadeNumerica: '0' },
        { quantidadeNumerica: '0.0000001' }, { quantidadeNumerica: '0.000001' }, { quantidade: '2' }, { moeda: 'USD' }, { unidade: 'saco' },
        { precoUnitario: '7' }, { total: 99 }, { totalDecimal: '1' }, { nomeProdutoSnapshot: 'inventado' },
        { precoUnitarioSnapshot: '7' }, { dadosEstruturadosEstado: 'validado' }]) {
        const r = await http('POST', '/orders', 'buyer', { productId: p.id, quantidadeNumerica: '1', ...extra });
        assert.equal(r.status, 400, r.data.message);
      }
      const sack = await product({ unidade: 'saco', quantidadeDisponivel: '2' });
      assert.equal((await http('POST', '/orders', 'buyer', { productId: sack.id, quantidadeNumerica: '0.5' })).status, 400);
      const valid = await http('POST', '/orders', 'buyer', { productId: sack.id, quantidadeNumerica: '2' });
      assert.equal(valid.status, 201);
      assert.equal(valid.data.order.unidadeSnapshot, 'saco');
    });

    await t.test('snapshots ficam imutáveis após editar produto e alterar estado', async () => {
      const p = await product();
      const o = (await http('POST', '/orders', 'buyer', { productId: p.id, quantidadeNumerica: '1' })).data.order;
      assert.equal((await http('PUT', `/products/${p.id}`, 'seller', { nome: `${prefix}_new_name`, precoUnitario: '0.4' })).status, 200);
      assert.equal((await http('PUT', `/orders/${o.id}/status`, 'buyer', { status: 'aceite' })).status, 403);
      assert.equal((await http('PUT', `/orders/${o.id}/status`, 'other', { status: 'aceite' })).status, 403);
      assert.equal((await http('PUT', `/orders/${o.id}/status`, 'seller', { status: 'aceite', totalDecimal: '99' })).status, 400);
      assert.equal((await http('PUT', `/orders/${o.id}/status`, 'seller', { status: 'aceite' })).status, 200);
      assert.equal((await http('PUT', `/orders/${o.id}/status`, 'admin', { status: 'pendente' })).status, 200);
      for (const [route, role] of [['/orders/my', 'buyer'], ['/orders/received', 'seller']]) {
        const result = await http('GET', route, role);
        const item = result.data.find((row) => row.id === o.id);
        assert.equal(item.nomeProdutoSnapshot, p.nome);
        assert.equal(item.precoUnitarioSnapshot, '0.200000');
        assert.equal(item.totalDecimal, '0.20');
        assert.equal(item.product.precoUnitario, '0.400000');
      }
      const outsider = await http('GET', '/orders/my', 'other');
      assert.equal(outsider.data.some((row) => row.id === o.id), false);
    });

    await t.test('legado continua consultável e não inventa dados estruturados', async () => {
      const body = input({ quantidade: '1,000 sacos', preco: 2 });
      for (const key of ['quantidadeDisponivel', 'unidade', 'precoUnitario', 'moeda']) delete body[key];
      const result = await http('POST', '/products', 'seller', body);
      assert.equal(result.status, 201);
      const p = result.data.product;
      assert.equal(p.quantidade, '1,000 sacos');
      assert.equal(p.unidade, null);
      assert.equal(p.dadosEstruturadosEstado, null);
      assert.equal((await http('GET', `/products/${p.id}`, null)).status, 200);
      const denied = await http('POST', '/orders', 'buyer', { productId: p.id, quantidadeNumerica: '1' });
      assert.equal(denied.status, 409);
      assert.match(denied.data.message, /dados estruturados completos/);
      const old = await http('POST', '/orders', 'buyer', { productId: p.id, quantidade: '0.5' });
      assert.equal(old.status, 201);
      assert.equal(old.data.order.total, 1);
      assert.equal(old.data.order.totalDecimal, null);
      assert.equal(old.data.order.nomeProdutoSnapshot, null);
      assert.equal((await http('PUT', `/products/${p.id}`, 'seller', { preco: 3 })).status, 200);
      await prisma.product.update({ where: { id: p.id }, data: { unidade: 'kg', dadosEstruturadosEstado: 'pendente_revisao' } });
      assert.equal((await http('GET', `/products/${p.id}`, null)).status, 200);
      assert.equal((await http('POST', '/orders', 'buyer', { productId: p.id, quantidade: '1' })).status, 409);
    });

    await t.test('precisão máxima persiste sem usar Float como fonte comercial', async () => {
      const p = await product({ quantidadeDisponivel: '999999999999.999999', precoUnitario: '999999999999.999999' });
      const result = await http('POST', '/orders', 'buyer', { productId: p.id, quantidadeNumerica: '999999999999.999999' });
      assert.equal(result.status, 201, result.data.message);
      assert.equal(result.data.order.totalDecimal, '999999999999999998000000.00');
      const stored = await prisma.order.findUnique({ where: { id: result.data.order.id } });
      assert.equal(stored.totalDecimal.toFixed(2), '999999999999999998000000.00');
    });

    await t.test('pendentes não reservam/comparam/descontam disponibilidade', async () => {
      const p = await product({ quantidadeDisponivel: '0' });
      for (let index = 0; index < 2; index++) {
        const r = await http('POST', '/orders', 'buyer', { productId: p.id, quantidadeNumerica: '100' });
        assert.equal(r.status, 201);
        assert.equal(r.data.order.status, 'pendente');
      }
      const saved = await prisma.product.findUnique({ where: { id: p.id } });
      assert.equal(saved.quantidadeDisponivel.toFixed(6), '0.000000');
    });
  } finally {
    if (server) await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
    try {
      if (userIds.length) {
        const ownedProducts = await prisma.product.findMany({ where: { userId: { in: userIds }, nome: { startsWith: prefix } }, select: { id: true } });
        const ids = ownedProducts.map((row) => row.id);
        // Only synthetic records belonging to the users created by this run.
        await prisma.$transaction([
          prisma.order.deleteMany({ where: { buyerId: { in: userIds }, productId: { in: ids } } }),
          prisma.product.deleteMany({ where: { id: { in: ids }, userId: { in: userIds }, nome: { startsWith: prefix } } }),
          prisma.user.deleteMany({ where: { id: { in: userIds }, email: { startsWith: prefix } } })
        ]);
        assert.equal(await prisma.user.count({ where: { id: { in: userIds } } }), 0);
        assert.equal(await prisma.product.count({ where: { id: { in: ids } } }), 0);
        t.diagnostic('Limpeza confirmada: apenas utilizadores/produtos/encomendas sintéticos deste ensaio');
      }
    } finally {
      await prisma.$disconnect();
      if (previousModule) require.cache[prismaPath] = previousModule; else delete require.cache[prismaPath];
      if (previousDatabase === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousDatabase;
      if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret;
    }
  }
});
