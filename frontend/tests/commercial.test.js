import test from 'node:test';
import assert from 'node:assert/strict';
import { UNITS, normalizeDecimalInput, formatDecimal, productFormValues, buildProductPayload,
  buildOrderPayload, canPublish, hasCompleteOrderSnapshot, isStructuredProduct } from '../src/utils/commercial.js';

const product = { id: 12, nome: 'Tomate', descricao: 'Fresco', categoria: 'Outros', localizacao: 'Teste',
  quantidadeDisponivel: '12.500000', unidade: 'kg', precoUnitario: '0.200000', moeda: 'MZN', dadosEstruturadosEstado: 'validado' };

test('normaliza vírgula/ponto simples e preserva decimais exatos como strings', () => {
  assert.equal(normalizeDecimalInput('0,125'), '0.125');
  assert.equal(normalizeDecimalInput(' 12,50 '), '12.5');
  assert.equal(normalizeDecimalInput('1,234000'), '1.234');
  assert.equal(normalizeDecimalInput('999999999999.999999'), '999999999999.999999');
  assert.equal(normalizeDecimalInput('0.1000000'), '0.1');
  assert.equal(normalizeDecimalInput('1000'), '1000');
});

test('rejeita formatos ambíguos e separadores de milhares', () => {
  for (const value of ['1,000', '1.000', '12,345', '123.456', '1,234.56', '1.234,56', '1 000', '1\u00a0000', "1'000", '1,234,567']) {
    assert.throws(() => normalizeDecimalInput(value), undefined, value);
  }
});

test('rejeita tipos inválidos, vazios, expoentes, sinais e zeros iniciais', () => {
  for (const value of [null, undefined, true, [], {}, 0.5, NaN, Infinity, '', ' ', 'NaN', 'Infinity', '1e3', '+1', '-1', '.5', '1.', '01', '00,5']) {
    assert.throws(() => normalizeDecimalInput(value), undefined, String(value));
  }
});

test('escala e limites técnicos respeitados sem arredondar', () => {
  for (const value of ['0.0000001', '999999999999.9999991', '1000000000000']) {
    assert.throws(() => normalizeDecimalInput(value));
  }
  assert.throws(() => normalizeDecimalInput('0'));
  assert.equal(normalizeDecimalInput('0', { allowZero: true }), '0');
});

test('unidades centrais correspondem ao contrato e frações não mudam de unidade', () => {
  assert.deepEqual(UNITS.map(({ value }) => value), ['kg', 'litro', 'unidade', 'saco']);
  for (const unidade of ['kg', 'litro']) {
    assert.equal(buildOrderPayload({ ...product, unidade }, '0,125').quantidadeNumerica, '0.125');
  }
  for (const unidade of ['unidade', 'saco']) {
    assert.throws(() => buildOrderPayload({ ...product, unidade }, '0,5'), /inteiras/);
    assert.equal(buildOrderPayload({ ...product, unidade }, '2,0').quantidadeNumerica, '2');
  }
});

test('payload do produto só envia metadados e contrato estruturado, com decimais textuais', () => {
  const payload = buildProductPayload({ ...productFormValues(product), quantidadeDisponivel: '12,5', precoUnitario: '0,20',
    preco: 999, quantidade: 'não usar', userId: 99 });
  assert.deepEqual(payload, { nome: 'Tomate', descricao: 'Fresco', categoria: 'Outros', localizacao: 'Teste', imagem: '',
    quantidadeDisponivel: '12.5', unidade: 'kg', precoUnitario: '0.2', moeda: 'MZN' });
  assert.equal(typeof payload.quantidadeDisponivel, 'string');
  assert.equal(typeof payload.precoUnitario, 'string');
});

test('campos comerciais completos e coerentes são obrigatórios', () => {
  const form = productFormValues(product);
  for (const key of ['unidade', 'precoUnitario', 'quantidadeDisponivel']) {
    assert.throws(() => buildProductPayload({ ...form, [key]: '' }));
  }
  assert.throws(() => buildProductPayload({ ...form, unidade: 'caixa' }));
  assert.throws(() => buildProductPayload({ ...form, unidade: 'saco' }), /inteiras/);
  assert.throws(() => buildProductPayload({ ...form, precoUnitario: '0' }));
  assert.equal(buildProductPayload({ ...form, quantidadeDisponivel: '0' }).quantidadeDisponivel, '0');
});

test('edição preserva valores recebidos em string incluindo seis casas significativas', () => {
  const form = productFormValues({ ...product, precoUnitario: '123456789012.123456' });
  assert.equal(form.precoUnitario, '123456789012.123456');
  assert.equal(buildProductPayload(form).precoUnitario, '123456789012.123456');
});

test('legado não preenche unidade, preço ou quantidade novos automaticamente', () => {
  const old = { ...product, preco: 15, quantidade: '50 sacos', dadosEstruturadosEstado: null };
  const form = productFormValues(old);
  assert.equal(form.quantidadeDisponivel, '');
  assert.equal(form.precoUnitario, '');
  assert.equal(form.unidade, '');
  const metadata = buildProductPayload(form, { allowEmptyCommercial: true });
  assert.deepEqual(Object.keys(metadata).sort(), ['categoria', 'descricao', 'imagem', 'localizacao', 'nome']);
  assert.throws(() => buildProductPayload({ ...form, unidade: 'kg' }, { allowEmptyCommercial: true }));
  assert.throws(() => buildOrderPayload(old, '1'), /revisão/);
  assert.equal(isStructuredProduct(old), false);
});

test('encomenda envia apenas identificador e quantidade, sem preço/total/snapshots do cliente', () => {
  assert.deepEqual(buildOrderPayload(product, '0,125'), { productId: '12', quantidadeNumerica: '0.125' });
});

test('publicação disponível apenas a vendedor/admin', () => {
  for (const tipo of ['vendedor', 'admin']) assert.equal(canPublish({ tipo }), true);
  for (const tipo of ['comprador', 'outro', undefined]) assert.equal(canPublish({ tipo }), false);
  assert.equal(canPublish(null), false);
});

test('formatação exata não passa por Float nem inventa dados históricos', () => {
  assert.equal(formatDecimal('123456789012.123456', 2), '123456789012,123456');
  assert.equal(formatDecimal('0.200000', 2), '0,20');
  assert.equal(formatDecimal('0.03', 2), '0,03');
  assert.equal(formatDecimal('12.500000'), '12,5');
  assert.equal(formatDecimal(null), 'Não registado');
});

test('histórico incompleto é identificado mesmo havendo produto atual completo', () => {
  assert.equal(hasCompleteOrderSnapshot({ product }), false);
  assert.equal(hasCompleteOrderSnapshot({ quantidadeNumerica: '1.000000', unidadeSnapshot: 'kg', precoUnitarioSnapshot: '0.200000',
    totalDecimal: '0.20', moedaSnapshot: 'MZN', nomeProdutoSnapshot: 'Nome original', versaoCalculo: 'decimal-v1-half-up-2',
    dadosEstruturadosEstado: 'validado', product: { ...product, nome: 'Nome novo' } }), true);
});
