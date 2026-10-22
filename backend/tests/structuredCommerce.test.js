const test = require('node:test');
const assert = require('node:assert/strict');
const { prepareStructuredProduct, prepareStructuredOrder, rejectSnapshotInput,
  serializeProduct, serializeOrder } = require('../src/utils/structuredCommerce');

const input = { quantidadeDisponivel: '12.500000', unidade: 'kg', precoUnitario: '0.200000', moeda: 'MZN' };
const product = { id: 10, userId: 2, nome: 'Tomate', ...prepareStructuredProduct(input) };

test('produto estruturado exige conjunto completo e strings decimais', () => {
  for (const key of Object.keys(input)) {
    const body = { ...input }; delete body[key];
    assert.throws(() => prepareStructuredProduct(body));
  }
  for (const value of [1, null, '', true, [], {}, '1.0000001']) {
    assert.throws(() => prepareStructuredProduct({ ...input, precoUnitario: value }));
  }
  assert.equal(prepareStructuredProduct(input).quantidade, '12.5 kg');
  assert.equal(prepareStructuredProduct({ ...input, quantidadeDisponivel: '0' }).quantidadeDisponivel, '0.000000');
});

test('campos legados mistos devem corresponder aos campos novos', () => {
  assert.equal(prepareStructuredProduct({ ...input, preco: 0.2, quantidade: '12.5 kg' }).precoUnitario, '0.200000');
  assert.equal(prepareStructuredProduct({ ...input, preco: '0.200000', quantidade: '12.500000' }).unidade, 'kg');
  for (const legacy of [{ preco: 0.3 }, { preco: '0.2000001' }, { quantidade: '13 kg' }]) {
    assert.throws(() => prepareStructuredProduct({ ...input, ...legacy }));
  }
});

test('edição parcial moderna sincroniza projeções; legado sozinho não desatualiza dados', () => {
  const edited = prepareStructuredProduct({ precoUnitario: '1.25' }, product);
  assert.equal(edited.preco, 1.25);
  assert.equal(edited.quantidadeDisponivel, '12.500000');
  assert.equal(prepareStructuredProduct({ preco: product.preco, quantidade: product.quantidade }, product), null);
  assert.throws(() => prepareStructuredProduct({ preco: 3 }, product));
  assert.throws(() => prepareStructuredProduct({ quantidade: '40 kg' }, product));
});

test('snapshots e total são derivados do produto e da quantidade, não do cliente', () => {
  const order = prepareStructuredOrder({ quantidadeNumerica: '0.125' }, product);
  assert.equal(order.totalDecimal, '0.03');
  assert.equal(order.precoUnitarioSnapshot, '0.200000');
  assert.equal(order.nomeProdutoSnapshot, 'Tomate');
  assert.equal(order.moedaSnapshot, 'MZN');
  for (const body of [{ quantidade: '1' }, { unidade: 'saco' }, { moeda: 'USD' }, { total: '0.04' }, { precoUnitario: '0.3' }]) {
    assert.throws(() => prepareStructuredOrder({ quantidadeNumerica: '0.125', ...body }, product));
  }
  for (const key of ['precoUnitarioSnapshot', 'nomeProdutoSnapshot', 'totalDecimal', 'versaoCalculo', 'dadosEstruturadosEstado']) {
    assert.throws(() => rejectSnapshotInput({ [key]: 'client' }, { creating: true }));
    assert.throws(() => rejectSnapshotInput({ [key]: 'client' }));
  }
  assert.throws(() => rejectSnapshotInput({ quantidadeNumerica: '2' }));
});

test('serialização mantém decimais fixos e deixa o legado e snapshots desconhecidos intactos', () => {
  assert.equal(serializeProduct(product).precoUnitario, '0.200000');
  const order = serializeOrder({ ...prepareStructuredOrder({ quantidade: '0.125' }, product), product });
  assert.equal(order.quantidadeNumerica, '0.125000');
  assert.equal(order.product.quantidadeDisponivel, '12.500000');
  assert.equal(order.totalDecimal, '0.03');
  assert.deepEqual(serializeProduct({ preco: 1.5, quantidade: '2 sacos', unidade: null }), { preco: 1.5, quantidade: '2 sacos', unidade: null });
});
