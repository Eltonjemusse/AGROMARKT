const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DEMO_PRODUCTS, planProducts, missingImages, productData, localDemoConfig } = require('../scripts/lib/demoProducts');
const { seedDemoProducts } = require('../scripts/seedDemoProducts');

test('dez produtos distintos, categorias existentes, imagens locais e dados decimais coerentes', () => {
  assert.equal(DEMO_PRODUCTS.length, 10);
  assert.equal(new Set(DEMO_PRODUCTS.map((p) => p.key)).size, 10);
  for (const template of DEMO_PRODUCTS) {
    const data = productData(template, { id: 50, tipo: 'vendedor', endereco: 'Local sintético' });
    assert.equal(data.userId, 50);
    assert.equal(data.moeda, 'MZN');
    assert.equal(data.dadosEstruturadosEstado, 'validado');
    assert.equal(data.localizacao, 'Local sintético');
    assert.match(data.descricao, /fictícios/);
    assert.ok(['Cereais', 'Hortaliças', 'Tubérculos', 'Leguminosas'].includes(data.categoria));
    assert.match(data.quantidadeDisponivel, /^[1-9]\d*\.000000$/);
    assert.match(data.precoUnitario, /^[1-9]\d*\.000000$/);
    assert.equal(data.quantidade, `${template.quantidadeDisponivel} ${template.unidade}`);
    const image = fs.readFileSync(path.join(__dirname, '../../frontend/public', data.imagem), 'utf8');
    assert.match(image, /<svg\b/);
    assert.ok(image.includes(`<title>${template.nome}</title>`));
    assert.doesNotMatch(image, /(?:href|src)=["']https?:|<script|<image\b/);
  }
  assert.throws(() => productData(DEMO_PRODUCTS[0], { id: 1, tipo: 'comprador' }));
});

test('completa dez sem duplicar nomes, variantes e acentos ou exceder vendedores já preenchidos', () => {
  assert.equal(planProducts([]).length, 10);
  const legacy = [{ nome: 'TOMATE — demonstração local' }, { nome: 'Feijões secos' }];
  const plan = planProducts(legacy);
  assert.equal(plan.length, 8);
  assert.ok(!plan.some((p) => ['tomate', 'feijao'].includes(p.key)));
  assert.deepEqual(planProducts(Array.from({ length: 10 }, (_, i) => ({ nome: `Produto ${i}` }))), []);
  assert.deepEqual(planProducts(Array.from({ length: 12 }, (_, i) => ({ nome: `Produto ${i}` }))), []);
});

test('recusa produção, fallback, outro destino e falta de confirmação sem abrir ligações', () => {
  const env = { AGROMARKET_TEST_DATABASE_URL: 'postgresql://synthetic:synthetic@127.0.0.1:55432/agromarkt_test',
    AGROMARKET_TEST_DATABASE_NAME: 'agromarkt_test', AGROMARKET_TEST_DATABASE_CONFIRM: 'isolated-tests-only' };
  assert.equal(localDemoConfig(env).destination, '127.0.0.1:55432/agromarkt_test');
  for (const changes of [{ AGROMARKET_TEST_DATABASE_URL: undefined, DATABASE_URL: env.AGROMARKET_TEST_DATABASE_URL },
    { AGROMARKET_TEST_DATABASE_URL: env.AGROMARKET_TEST_DATABASE_URL.replace('127.0.0.1', 'production.invalid') },
    { AGROMARKET_TEST_DATABASE_URL: env.AGROMARKET_TEST_DATABASE_URL.replace('55432', '5432') },
    { AGROMARKET_TEST_DATABASE_URL: `${env.AGROMARKET_TEST_DATABASE_URL}?schema=other` },
    { AGROMARKET_TEST_DATABASE_NAME: 'other' }, { AGROMARKET_TEST_DATABASE_CONFIRM: '' }]) {
    assert.throws(() => localDemoConfig({ ...env, ...changes }), /Seed recusado/);
  }
});

test('só preenche imagens vazias de produtos reconhecidos sem adivinhar nomes ambíguos', () => {
  const plan = missingImages([{ id: 1, nome: 'Tomate de teste', imagem: '' },
    { id: 2, nome: 'Cebola', imagem: '/foto-existente.jpg' },
    { id: 3, nome: 'Produto desconhecido', imagem: null },
    { id: 4, nome: 'Mistura de milho e feijão', imagem: null }]);
  assert.deepEqual(plan, [{ id: 1, nome: 'Tomate de teste', anterior: '', imagem: '/images/demo-products/tomate.svg' }]);
});

function fakeDatabase() {
  const sellers = [{ id: 1, nome: 'Vendedor um', tipo: 'vendedor', produtos: [{ id: 11, nome: 'Tomate antigo', imagem: null }] },
    { id: 2, nome: 'Vendedor dois', tipo: 'vendedor', produtos: [] }];
  let nextId = 100;
  const tx = {
    $queryRaw: async () => [{ database: 'agromarkt_test' }],
    user: { findMany: async ({ where }) => { assert.deepEqual(where, { tipo: 'vendedor' }); return sellers; } },
    product: { updateMany: async ({ where, data }) => {
      assert.deepEqual(Object.keys(data), ['imagem']);
      const product = sellers.find((s) => s.id === where.userId).produtos.find((p) => p.id === where.id && p.imagem === where.imagem);
      if (!product) return { count: 0 };
      Object.assign(product, data);
      return { count: 1 };
    }, create: async ({ data }) => {
      const product = { id: nextId++, nome: data.nome, imagem: data.imagem };
      sellers.find((s) => s.id === data.userId).produtos.push(product);
      return product;
    } },
  };
  return { $transaction: async (run, options) => { assert.equal(options.isolationLevel, 'Serializable'); return run(tx); } };
}

test('pré-visualização não escreve; aplicação associa por vendedor e repetição insere zero', async () => {
  const db = fakeDatabase();
  const preview = await seedDemoProducts(db);
  assert.equal(preview.totalInserido, 0);
  assert.deepEqual(preview.resultados.map((r) => r.previstos), [9, 10]);
  const applied = await seedDemoProducts(db, { apply: true });
  assert.equal(applied.totalInserido, 19);
  assert.equal(applied.resultados[0].imagensPreenchidas, 1);
  assert.deepEqual(applied.resultados.map((r) => r.totalApos), [10, 10]);
  assert.ok(!applied.resultados[0].produtos.some((p) => p.nome.startsWith('Tomate')));
  const repeated = await seedDemoProducts(db, { apply: true });
  assert.equal(repeated.totalInserido, 0);
  assert.equal(repeated.resultados[0].imagensPreenchidas, 0);
});

test('conflito de serialização é repetido; outros erros interrompem sem fingir sucesso', async () => {
  const db = fakeDatabase();
  const original = db.$transaction;
  let attempts = 0;
  db.$transaction = (...args) => {
    if (++attempts === 1) return Promise.reject(Object.assign(new Error('simulado'), { code: 'P2034' }));
    return original(...args);
  };
  assert.equal((await seedDemoProducts(db, { apply: true })).totalInserido, 19);
  assert.equal(attempts, 2);
  db.$transaction = () => Promise.reject(Object.assign(new Error('simulado'), { code: 'P2003' }));
  await assert.rejects(() => seedDemoProducts(db, { apply: true }), { code: 'P2003' });
});
