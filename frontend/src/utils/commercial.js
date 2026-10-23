export const UNITS = Object.freeze([
  { value: 'kg', label: 'kg', fractional: true },
  { value: 'litro', label: 'litro', fractional: true },
  { value: 'unidade', label: 'unidade', fractional: false },
  { value: 'saco', label: 'saco', fractional: false },
]);

export const canPublish = (user) => ['vendedor', 'admin'].includes(user?.tipo);

function validateField(field, validate) {
  try { return validate(); } catch (error) { error.field = field; throw error; }
}

export function isStructuredProduct(product) {
  return product?.dadosEstruturadosEstado === 'validado' && product.moeda === 'MZN' &&
    UNITS.some(({ value }) => value === product.unidade) &&
    typeof product.quantidadeDisponivel === 'string' && typeof product.precoUnitario === 'string';
}

// Normalização textual, sem conversão para ponto flutuante nem cálculos monetários.
export function normalizeDecimalInput(value, { label = 'Valor', integer = false, allowZero = false } = {}) {
  if (typeof value !== 'string') throw new Error(`${label}: introduza um valor em texto.`);
  const text = value.trim();
  if (!/^(0|[1-9]\d*)(?:[.,]\d+)?$/.test(text)) {
    throw new Error(`${label}: use apenas dígitos e uma vírgula ou ponto decimal, sem milhares.`);
  }
  // 1,234 / 1.234 podem significar milhares ou fração. Não adivinhar.
  // 0,125 é inequívoco; para 1,234 decimal pode escrever 1,234000.
  if (/^[1-9]\d{0,2}[.,]\d{3}$/.test(text)) {
    throw new Error(`${label}: formato ambíguo. Retire os milhares; para uma fração use seis casas (ex.: 1,234000).`);
  }
  const [whole, rawFraction = ''] = text.replace(',', '.').split('.');
  const fraction = rawFraction.replace(/0+$/, '');
  if (whole.length > 12 || fraction.length > 6) {
    throw new Error(`${label}: máximo de 12 dígitos inteiros e 6 casas decimais significativas.`);
  }
  if (integer && fraction) throw new Error(`${label}: unidade e saco exigem quantidades inteiras.`);
  if (!allowZero && whole === '0' && !fraction) throw new Error(`${label}: deve ser maior que zero.`);
  return fraction ? `${whole}.${fraction}` : whole;
}

export function formatDecimal(value, minFraction = 0) {
  if (typeof value !== 'string' || !/^\d+(?:\.\d+)?$/.test(value)) return String(value ?? 'Não registado');
  const [whole, rawFraction = ''] = value.split('.');
  const fraction = rawFraction.replace(/0+$/, '').padEnd(minFraction, '0');
  return fraction ? `${whole},${fraction}` : whole;
}

export function productFormValues(product = null) {
  const structured = isStructuredProduct(product);
  return {
    nome: product?.nome ?? '', descricao: product?.descricao ?? '',
    categoria: product?.categoria ?? '', localizacao: product?.localizacao ?? '', imagem: product?.imagem ?? '',
    quantidadeDisponivel: structured ? product.quantidadeDisponivel : '',
    unidade: structured ? product.unidade : '',
    precoUnitario: structured ? product.precoUnitario : '',
  };
}

export function buildProductPayload(form, { allowEmptyCommercial = false } = {}) {
  const payload = Object.fromEntries(['nome', 'descricao', 'categoria', 'localizacao', 'imagem']
    .map((key) => [key, form[key].trim()]));
  const empty = ['quantidadeDisponivel', 'unidade', 'precoUnitario'].every((key) => form[key].trim() === '');
  if (allowEmptyCommercial && empty) return payload;
  const unit = UNITS.find(({ value }) => value === form.unidade);
  if (!unit) throw Object.assign(new Error('Selecione a unidade do produto. Não presuma o peso de um saco.'), { field: 'unidade' });
  return {
    ...payload,
    quantidadeDisponivel: validateField('quantidadeDisponivel', () => normalizeDecimalInput(form.quantidadeDisponivel,
      { label: 'Quantidade', integer: !unit.fractional, allowZero: true })),
    unidade: unit.value,
    precoUnitario: validateField('precoUnitario', () => normalizeDecimalInput(form.precoUnitario, { label: 'Preço por unidade' })),
    moeda: 'MZN',
  };
}

export function buildOrderPayload(product, quantity) {
  if (!isStructuredProduct(product)) throw new Error('Este produto precisa de revisão pelo vendedor antes de receber novas encomendas.');
  return {
    productId: String(product.id),
    quantidadeNumerica: validateField('quantidadeNumerica', () => normalizeDecimalInput(quantity,
      { label: 'Quantidade', integer: !UNITS.find(({ value }) => value === product.unidade).fractional })),
  };
}

export function hasCompleteOrderSnapshot(order) {
  return order.dadosEstruturadosEstado === 'validado' && order.moedaSnapshot === 'MZN' &&
    ['quantidadeNumerica', 'unidadeSnapshot', 'precoUnitarioSnapshot', 'totalDecimal', 'nomeProdutoSnapshot', 'versaoCalculo']
      .every((key) => typeof order[key] === 'string' && order[key] !== '');
}
