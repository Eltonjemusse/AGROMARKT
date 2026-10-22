// Runtime-only import: no PrismaClient, generated models, .env or database connection.
const { Decimal } = require('@prisma/client/runtime/library');

// Each input has at most 18 significant digits; their product needs at most 36.
// Clone so calculations do not depend on, or change, Prisma's global settings.
const CommercialDecimal = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

const UNIT_SCALES = Object.freeze({ kg: 6, litro: 6, unidade: 0, saco: 0 });
const TECHNICAL_LIMITS = Object.freeze({
  quantidadeMaxima: '999999999999.999999',
  precoUnitarioMaximo: '999999999999.999999',
  totalMaximo: '9999999999999999999999999999.99',
  escalaQuantidade: 6,
  escalaPreco: 6,
  escalaTotal: 2
});

// No business ceiling has been approved. Callers must supply it explicitly once defined.
// This module deliberately does not read environment or application configuration.
const COMMERCIAL_LIMITS = Object.freeze({ maxTotal: null });

function isCanonicalDecimalText(value) {
  return typeof value === 'string' && value === value.trim() && /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value);
}

function readDecimal(text, integerDigits, scale, allowZero = false) {
  if (!isCanonicalDecimalText(text)) {
    throw new TypeError('O valor deve ser texto decimal canónico, sem sinal, espaços ou expoente');
  }
  const [integer, fraction = ''] = text.split('.');
  if (integer.length > integerDigits || fraction.replace(/0+$/, '').length > scale) {
    throw new RangeError('Valor fora dos limites de precisão ou escala');
  }
  const value = new CommercialDecimal(text);
  if (!allowZero && value.isZero()) {
    throw new RangeError('O valor deve ser positivo');
  }
  return value;
}

function validateQuantity(text, unit, { allowZero = false } = {}) {
  if (typeof unit !== 'string' || !Object.prototype.hasOwnProperty.call(UNIT_SCALES, unit)) {
    throw new TypeError('Unidade inválida');
  }
  return readDecimal(text, 12, UNIT_SCALES[unit], allowZero).toFixed(6);
}

function validateUnitPrice(text) {
  return readDecimal(text, 12, 6).toFixed(6);
}

function validateTotal(text) {
  return readDecimal(text, 28, 2).toFixed(2);
}

function calculateOrderTotal({ quantidade, unidade, precoUnitario, moeda = 'MZN' }, limits = COMMERCIAL_LIMITS) {
  if (moeda !== 'MZN') throw new TypeError('Moeda inválida');
  const quantity = validateQuantity(quantidade, unidade);
  const price = validateUnitPrice(precoUnitario);
  const rounded = new CommercialDecimal(quantity)
    .mul(price)
    .toDecimalPlaces(2, CommercialDecimal.ROUND_HALF_UP);
  const total = validateTotal(rounded.toFixed(2));

  if (limits.maxTotal !== null) {
    const ceiling = validateTotal(limits.maxTotal);
    if (rounded.gt(ceiling)) throw new RangeError('Total acima do limite comercial configurado');
  }

  return { quantidade: quantity, unidade, precoUnitario: price, total, moeda };
}

module.exports = {
  UNIT_SCALES,
  TECHNICAL_LIMITS,
  COMMERCIAL_LIMITS,
  isCanonicalDecimalText,
  validateQuantity,
  validateUnitPrice,
  validateTotal,
  calculateOrderTotal
};
