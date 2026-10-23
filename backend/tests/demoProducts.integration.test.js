const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { openLocalDemoDatabase } = require('../scripts/seedDemoProducts');
const { DEMO_PRODUCTS, productData } = require('../scripts/lib/demoProducts');

// Read-only verification after the explicit seed. No creation/deletion of users,
// products, orders or databases; no loading of src/server.js, dotenv or .env.
test('seed local persistido está no catálogo, detalhe e painel do vendedor', async (t) => {
  if (!process.env.AGROMARKET_TEST_DATABASE_URL) {
    t.skip('Exige a base local explicitamente configurada e seed já aplicado.');
    return;
  }
  const prisma = openLocalDemoDatabase(process.env);
  const prismaPath = require.resolve('../src/config/prisma');
  const previousModule = require.cache[prismaPath];
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
  let server;
  try {
    assert.equal((await prisma.$queryRaw`SELECT current_database() AS database`)[0].database, 'agromarkt_test');
    const sellers = await prisma.user.findMany({ where: { tipo: 'vendedor' }, include: { produtos: true } });
    assert.ok(sellers.length > 0, 'Verificação exige vendedores existentes; não cria contas.');
    const app = require('express')();
    app.use('/api/products', require('../src/routes/productRoutes'));
    server = await new Promise((resolve) => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
    const origin = `http://127.0.0.1:${server.address().port}/api/products`;
    const catalogueResponse = await fetch(origin);
    assert.equal(catalogueResponse.status, 200);
    const catalogue = await catalogueResponse.json();
    for (const seller of sellers) {
      assert.ok(seller.produtos.length >= 10, `Vendedor ${seller.id}: completar o seed antes deste teste.`);
      const token = require('jsonwebtoken').sign({ id: seller.id, tipo: seller.tipo }, process.env.JWT_SECRET, { expiresIn: '1m' });
      const mineResponse = await fetch(`${origin}/my-products`, { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(mineResponse.status, 200);
      const mine = await mineResponse.json();
      assert.equal(mine.length, seller.produtos.length);
      for (const saved of seller.produtos) {
        const item = catalogue.find((p) => p.id === saved.id);
        assert.ok(item, `Produto ${saved.id} deve estar no catálogo público`);
        assert.equal(item.userId, seller.id);
        assert.equal(item.user.id, seller.id);
        assert.ok(mine.some((p) => p.id === saved.id));
        if (!saved.imagem?.startsWith('/images/demo-products/')) continue;
        const template = DEMO_PRODUCTS.find((p) => `/images/demo-products/${p.key}.svg` === saved.imagem);
        assert.ok(template);
        const expected = productData(template, seller);
        if (saved.descricao.includes('Dados, preço e disponibilidade fictícios, apenas para demonstração.')) {
          assert.equal(saved.quantidadeDisponivel.toFixed(6), expected.quantidadeDisponivel);
          assert.equal(saved.precoUnitario.toFixed(6), expected.precoUnitario);
        }
        assert.equal(item.quantidadeDisponivel, saved.quantidadeDisponivel.toFixed(6));
        assert.equal(item.precoUnitario, saved.precoUnitario.toFixed(6));
        assert.equal(item.moeda, 'MZN');
        assert.equal(item.dadosEstruturadosEstado, 'validado');
        assert.equal(item.imagem, expected.imagem);
        const detailResponse = await fetch(`${origin}/${saved.id}`);
        assert.equal(detailResponse.status, 200);
        assert.equal((await detailResponse.json()).imagem, expected.imagem);
      }
    }
  } finally {
    if (server) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
    if (previousModule) require.cache[prismaPath] = previousModule;
    else delete require.cache[prismaPath];
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
    await prisma.$disconnect();
  }
});
