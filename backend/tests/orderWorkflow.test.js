const test = require('node:test');
const assert = require('node:assert/strict');
const { validatedOrderQuantity } = require('../src/utils/orderWorkflow');

const order = { quantidadeNumerica: '0.125000', unidadeSnapshot: 'kg', precoUnitarioSnapshot: '0.200000',
  moedaSnapshot: 'MZN', totalDecimal: '0.03', nomeProdutoSnapshot: 'Tomate',
  versaoCalculo: 'decimal-v1-half-up-2', dadosEstruturadosEstado: 'validado' };
test('aceitação valida os snapshots exatos sem substituir pelo produto atual', () => {
  assert.equal(validatedOrderQuantity(order), '0.125000');
});
test('aceitação bloqueia histórico incompleto, total incoerente e versão desconhecida', () => {
  for (const patch of [{ quantidadeNumerica: null }, { unidadeSnapshot: null }, { precoUnitarioSnapshot: null },
    { totalDecimal: null }, { totalDecimal: '0.04' }, { nomeProdutoSnapshot: '' }, { versaoCalculo: 'desconhecida' },
    { moedaSnapshot: 'USD' }, { dadosEstruturadosEstado: null }, { quantidadeNumerica: '0' }, { unidadeSnapshot: 'saco' }]) {
    assert.throws(() => validatedOrderQuantity({ ...order, ...patch }), (error) => error.statusCode === 409 && /revisão/.test(error.message));
  }
});
