const { Decimal } = require('@prisma/client/runtime/library');
const { validateQuantity, validateUnitPrice, validateTotal, calculateOrderTotal } = require('./commercialDecimals');
const { positiveNumber } = require('./validation');
const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const productFields = ['quantidadeDisponivel', 'unidade', 'precoUnitario', 'moeda'];
const snapshotFields = ['quantidadeNumerica', 'unidadeSnapshot', 'precoUnitarioSnapshot',
  'moedaSnapshot', 'totalDecimal', 'nomeProdutoSnapshot', 'versaoCalculo', 'dadosEstruturadosEstado', 'stockDescontadoEm'];

function hasStructuredData(product) {
  return productFields.some((key) => product[key] !== null && product[key] !== undefined);
}

function isStructuredProduct(product) {
  return product.dadosEstruturadosEstado === 'validado' &&
    productFields.every((key) => product[key] !== null && product[key] !== undefined);
}

// Float columns exist only for legacy contracts. Never use this projection as
// an input to structured calculations or snapshots; exact values remain strings.
function legacyFloat(decimalText) {
  return new D(decimalText).toNumber();
}

function assertLegacyPrice(value, exact) {
  if (typeof value === 'string' ? validateUnitPrice(value) !== exact :
    (typeof value !== 'number' || positiveNumber(value) !== legacyFloat(exact))) {
    throw new RangeError('Preço legado contradiz o preço estruturado');
  }
}

function quantityLabel(quantity, unit) {
  return `${new D(quantity).toFixed()} ${unit}`;
}

function assertLegacyQuantity(value, quantity, unit) {
  if (value === quantityLabel(quantity, unit)) return;
  if (typeof value !== 'string' || validateQuantity(value, unit, { allowZero: true }) !== quantity) {
    throw new RangeError('Quantidade legada contradiz a quantidade estruturada');
  }
}

function prepareStructuredProduct(body, current = null) {
  const requested = productFields.some((key) => own(body, key));
  if (!requested) {
    if (current && hasStructuredData(current)) {
      if ((own(body, 'preco') && positiveNumber(body.preco) !== current.preco) ||
          (own(body, 'quantidade') && body.quantidade !== current.quantidade)) {
        throw new RangeError('Produto estruturado: altere precoUnitario ou quantidadeDisponivel, não apenas os campos legados');
      }
    }
    return null;
  }
  const value = (key) => own(body, key) ? body[key] : current?.[key]?.toString();
  const unit = value('unidade');
  const quantity = validateQuantity(value('quantidadeDisponivel'), unit, { allowZero: true });
  const price = validateUnitPrice(value('precoUnitario'));
  const currency = value('moeda');
  if (currency !== 'MZN') throw new TypeError('Moeda deve ser MZN');
  if (own(body, 'preco')) assertLegacyPrice(body.preco, price);
  if (own(body, 'quantidade')) assertLegacyQuantity(body.quantidade, quantity, unit);
  return {
    quantidadeDisponivel: quantity, unidade: unit, precoUnitario: price, moeda: currency,
    dadosEstruturadosEstado: 'validado', preco: legacyFloat(price), quantidade: quantityLabel(quantity, unit)
  };
}

function prepareStructuredOrder(body, product) {
  const quantity = own(body, 'quantidadeNumerica') ? body.quantidadeNumerica :
    (typeof body.quantidade === 'number' ? String(body.quantidade) : body.quantidade);
  const quote = calculateOrderTotal({ quantidade: quantity, unidade: product.unidade,
    precoUnitario: product.precoUnitario.toString(), moeda: product.moeda });
  if (own(body, 'quantidade') && own(body, 'quantidadeNumerica')) {
    const legacy = typeof body.quantidade === 'number' ? String(body.quantidade) : body.quantidade;
    if (validateQuantity(legacy, quote.unidade) !== quote.quantidade) throw new RangeError('Quantidades contraditórias');
  }
  if ((own(body, 'unidade') && body.unidade !== quote.unidade) ||
      (own(body, 'moeda') && body.moeda !== quote.moeda)) throw new RangeError('Unidade/moeda contradiz o produto');
  if (own(body, 'precoUnitario') && validateUnitPrice(body.precoUnitario) !== quote.precoUnitario) {
    throw new RangeError('Preço unitário contradiz o produto');
  }
  if (own(body, 'preco')) assertLegacyPrice(body.preco, quote.precoUnitario);
  if (own(body, 'total') && (typeof body.total === 'string' ? validateTotal(body.total) !== quote.total :
    (typeof body.total !== 'number' || positiveNumber(body.total) !== legacyFloat(quote.total)))) {
    throw new RangeError('Total legado contradiz o total calculado');
  }
  return {
    quantidade: quote.quantidade, total: legacyFloat(quote.total),
    quantidadeNumerica: quote.quantidade, unidadeSnapshot: quote.unidade,
    precoUnitarioSnapshot: quote.precoUnitario, moedaSnapshot: quote.moeda,
    totalDecimal: quote.total, nomeProdutoSnapshot: product.nome,
    versaoCalculo: 'decimal-v1-half-up-2', dadosEstruturadosEstado: 'validado'
  };
}

function rejectSnapshotInput(body, { creating = false } = {}) {
  const forbidden = creating ? snapshotFields.filter((key) => key !== 'quantidadeNumerica') : snapshotFields;
  if (forbidden.some((key) => own(body, key))) throw new TypeError('Snapshots são definidos pelo servidor e são imutáveis');
}

function serializeProduct(product) {
  if (!product) return product;
  const result = { ...product };
  for (const key of ['quantidadeDisponivel', 'precoUnitario']) {
    if (result[key] !== null && result[key] !== undefined) result[key] = new D(result[key].toString()).toFixed(6);
  }
  return result;
}

function serializeOrder(order) {
  const result = { ...order };
  for (const key of ['quantidadeNumerica', 'precoUnitarioSnapshot', 'totalDecimal']) {
    if (result[key] !== null && result[key] !== undefined) result[key] = new D(result[key].toString()).toFixed(key === 'totalDecimal' ? 2 : 6);
  }
  if (result.product) result.product = serializeProduct(result.product);
  return result;
}

module.exports = { hasStructuredData, isStructuredProduct, prepareStructuredProduct,
  prepareStructuredOrder, rejectSnapshotInput, serializeProduct, serializeOrder };
