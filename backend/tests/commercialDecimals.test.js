const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const vm = require('node:vm');
const { Decimal } = require('@prisma/client/runtime/library');
const {
  UNIT_SCALES, TECHNICAL_LIMITS, COMMERCIAL_LIMITS, isCanonicalDecimalText,
  validateQuantity, validateUnitPrice, validateTotal, calculateOrderTotal
} = require('../src/utils/commercialDecimals');

function quote(quantidade = '1', precoUnitario = '1', unidade = 'kg', limits) {
  return calculateOrderTotal({ quantidade, precoUnitario, unidade }, limits);
}

test('texto canónico permite ponto decimal sem espaços, sinais ou expoentes', () => {
  for (const value of ['0', '1', '0.5', '12.5000000', '999999999999.999999']) {
    assert.equal(isCanonicalDecimalText(value), true, value);
  }
  for (const value of [undefined, null, true, false, [], ['1'], {}, 1, NaN, Infinity,
    '', ' ', ' 1', '1 ', '1\n', '1\r', '\t1', '+1', '-1', '-0', '01', '00.1',
    '.5', '1.', '1e2', '1E-6', '0x10', '1,5', '1,000', '1_000', 'NaN', 'Infinity', '1 kg']) {
    assert.equal(isCanonicalDecimalText(value), false, String(value));
    assert.throws(() => validateUnitPrice(value));
  }
});

test('kg e litro aceitam frações até seis casas significativas', () => {
  for (const unidade of ['kg', 'litro']) {
    assert.equal(validateQuantity('0.000001', unidade), '0.000001');
    assert.equal(validateQuantity('12.5000000', unidade), '12.500000');
    assert.throws(() => validateQuantity('0.0000001', unidade), RangeError);
    assert.throws(() => validateQuantity('1.0000001', unidade), RangeError);
  }
});

test('unidade e saco exigem inteiros, sem presumir peso', () => {
  for (const unidade of ['unidade', 'saco']) {
    assert.equal(validateQuantity('2', unidade), '2.000000');
    assert.equal(validateQuantity('2.0000000', unidade), '2.000000');
    assert.throws(() => validateQuantity('2.5', unidade), RangeError);
    assert.throws(() => validateQuantity('2.000001', unidade), RangeError);
    assert.equal(quote('2', '3.5', unidade).total, '7.00');
  }
});

test('unidades desconhecidas não são inferidas nem convertidas', () => {
  assert.deepEqual(Object.keys(UNIT_SCALES), ['kg', 'litro', 'unidade', 'saco']);
  for (const unidade of [undefined, null, true, [], {}, 'KG', 'L', 'un', 'sacos', ' kg', 'toString', '__proto__']) {
    assert.throws(() => validateQuantity('1', unidade), TypeError);
  }
});

test('quantidades e preço positivos; zero apenas para disponibilidade futura explícita', () => {
  assert.throws(() => validateQuantity('0', 'kg'), RangeError);
  assert.throws(() => validateQuantity('0.000', 'saco'), RangeError);
  assert.equal(validateQuantity('0', 'kg', { allowZero: true }), '0.000000');
  assert.throws(() => validateQuantity('-1', 'kg', { allowZero: true }));
  assert.throws(() => validateUnitPrice('0'), RangeError);
  assert.throws(() => validateTotal('0.00'), RangeError);
});

test('preço mantém seis casas sem arredondamento significativo', () => {
  assert.equal(validateUnitPrice('12.345678000'), '12.345678');
  assert.equal(validateUnitPrice('0.000001'), '0.000001');
  assert.throws(() => validateUnitPrice('12.3456781'), RangeError);
  assert.throws(() => validateUnitPrice('0.0000001'), RangeError);
});

test('limites NUMERIC(18,6) não perdem precisão nem aceitam overflow', () => {
  assert.equal(validateUnitPrice(TECHNICAL_LIMITS.precoUnitarioMaximo), '999999999999.999999');
  assert.equal(validateQuantity(TECHNICAL_LIMITS.quantidadeMaxima, 'kg'), '999999999999.999999');
  assert.equal(validateQuantity('999999999999', 'saco'), '999999999999.000000');
  for (const value of ['1000000000000', '1000000000000.000000', '999999999999.9999991']) {
    assert.throws(() => validateUnitPrice(value), RangeError);
    assert.throws(() => validateQuantity(value, 'kg'), RangeError);
  }
});

test('limites NUMERIC(30,2) e escala do total são validados sem Number', () => {
  assert.equal(validateTotal(TECHNICAL_LIMITS.totalMaximo), '9999999999999999999999999999.99');
  assert.equal(validateTotal('1.23000'), '1.23');
  assert.throws(() => validateTotal('10000000000000000000000000000.00'), RangeError);
  assert.throws(() => validateTotal('1.231'), RangeError);
});

test('cálculos são exatos para frações decimais e o resultado é texto', () => {
  assert.deepEqual(quote('0.1', '0.2'), {
    quantidade: '0.100000', unidade: 'kg', precoUnitario: '0.200000', total: '0.02', moeda: 'MZN'
  });
  assert.equal(quote('3', '0.1').total, '0.30');
  assert.equal(quote('1', '12.345678').precoUnitario, '12.345678');
  assert.equal(JSON.parse(JSON.stringify(quote('0.1', '0.2'))).total, '0.02');
});

test('ROUND_HALF_UP aplica-se só ao total final', () => {
  assert.equal(quote('0.125', '0.2').total, '0.03');
  assert.equal(quote('1', '1.004999').total, '1.00');
  assert.equal(quote('1', '1.005').total, '1.01');
  assert.equal(quote('0.333333', '3').total, '1.00');
});

test('total que arredonda para zero é rejeitado', () => {
  assert.throws(() => quote('0.000001', '0.000001'), RangeError);
  assert.throws(() => quote('1', '0.004999'), RangeError);
  assert.equal(quote('1', '0.005').total, '0.01');
});

test('multiplicação dos máximos de 18 dígitos mantém os 36 dígitos necessários', () => {
  assert.equal(quote('999999999999.999999', '999999999999.999999').total,
    '999999999999999998000000.00');
});

test('configuração comercial explícita sem um teto inventado', () => {
  assert.deepEqual(COMMERCIAL_LIMITS, { maxTotal: null });
  assert.equal(quote('2', '1').total, '2.00');
  // These ceilings are synthetic fixtures, not approved commercial policy.
  assert.equal(quote('2', '1', 'kg', { maxTotal: '2.00' }).total, '2.00');
  assert.throws(() => quote('2', '1', 'kg', { maxTotal: '1.99' }), RangeError);
  for (const maxTotal of [undefined, 10, '0', '1.001', '-1', 'Infinity']) {
    assert.throws(() => quote('1', '1', 'kg', { maxTotal }));
  }
});

test('moeda inicial é MZN; nenhuma outra moeda é convertida', () => {
  assert.equal(calculateOrderTotal({ quantidade: '1', precoUnitario: '1', unidade: 'kg', moeda: 'MZN' }).moeda, 'MZN');
  for (const moeda of ['USD', 'MT', null, '', {}]) {
    assert.throws(() => calculateOrderTotal({ quantidade: '1', precoUnitario: '1', unidade: 'kg', moeda }), TypeError);
  }
});

test('cópia Decimal não depende da configuração global nem a altera', () => {
  const precision = Decimal.precision;
  const rounding = Decimal.rounding;
  try {
    Decimal.set({ precision: 2, rounding: Decimal.ROUND_DOWN });
    assert.equal(quote('999999999999.999999', '999999999999.999999').total,
      '999999999999999998000000.00');
    assert.equal(quote('1', '1.005').total, '1.01');
    assert.equal(Decimal.precision, 2);
    assert.equal(Decimal.rounding, Decimal.ROUND_DOWN);
  } finally {
    Decimal.set({ precision, rounding });
  }
});

test('módulo comercial só importa Decimal do runtime, sem configurações ou cliente de dados', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/utils/commercialDecimals.js'), 'utf8');
  const imports = [];
  const module = { exports: {} };
  vm.runInNewContext(source, {
    module,
    require(name) {
      imports.push(name);
      assert.equal(name, '@prisma/client/runtime/library');
      return { Decimal };
    }
    // process, environment and any database client are deliberately absent.
  });
  assert.equal(module.exports.calculateOrderTotal({ quantidade: '0.125', precoUnitario: '0.2', unidade: 'kg' }).total, '0.03');
  assert.deepEqual(imports, ['@prisma/client/runtime/library']);
});

test('enum persistente de unidades acompanha a definição central de validação', () => {
  const schema = fs.readFileSync(path.join(__dirname, '../prisma/schema.prisma'), 'utf8');
  const entries = schema.match(/enum Unidade\s*\{([^}]+)\}/)[1].trim().split(/\s+/);
  assert.deepEqual(entries, Object.keys(UNIT_SCALES));
  for (const name of ['quantidadeDisponivel', 'quantidadeNumerica', 'precoUnitario', 'precoUnitarioSnapshot']) {
    assert.match(schema, new RegExp(`${name}\\s+Decimal\\?\\s+@db.Decimal\\(18, 6\\)`));
  }
  assert.match(schema, /totalDecimal\s+Decimal\?\s+@db.Decimal\(30, 2\)/);
  for (const name of ['quantidadeDisponivel', 'unidade', 'precoUnitario', 'moeda', 'dadosEstruturadosEstado',
    'quantidadeNumerica', 'unidadeSnapshot', 'precoUnitarioSnapshot', 'moedaSnapshot', 'totalDecimal', 'nomeProdutoSnapshot', 'versaoCalculo']) {
    const line = schema.split('\n').find((value) => new RegExp(`^\\s*${name}\\s`).test(value));
    assert.ok(line.includes('?'), `${name} must remain optional`);
    assert.equal(line.includes('@default'), false, `${name} must not backfill legacy`);
  }
});

test('validação estática Prisma usa esquema temporário e URL fictícia isolada', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'agromarket-schema-'));
  try {
    const schema = fs.readFileSync(path.join(__dirname, '../prisma/schema.prisma'), 'utf8');
    // Do not load project .env or prisma.config.ts, or use any real DATABASE_URL.
    fs.writeFileSync(path.join(temporary, 'schema.prisma'),
      schema.replace('env("DATABASE_URL")', '"postgresql://test:test@127.0.0.1:1/isolated_schema_only"'));
    const cli = require.resolve('prisma/build/index.js');
    const result = spawnSync(process.execPath, [cli, 'validate', '--schema', 'schema.prisma'], {
      cwd: temporary,
      env: { ...process.env, DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/isolated_schema_only', CHECKPOINT_DISABLE: '1' },
      encoding: 'utf8', timeout: 30000, windowsHide: true
    });
    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  } finally {
    // Only the exact temporary file/directory created above is removed, without recursion.
    fs.unlinkSync(path.join(temporary, 'schema.prisma'));
    fs.rmdirSync(temporary);
  }
});
