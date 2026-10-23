const { prepareStructuredProduct } = require('../../src/utils/structuredCommerce');

const TARGET_PRODUCTS = 10;
const DEMO_PRODUCTS = Object.freeze([
  { key: 'milho', nome: 'Milho seco', aliases: ['milho'], categoria: 'Cereais', unidade: 'saco', quantidadeDisponivel: '20', precoUnitario: '2250.00',
    descricao: 'Grãos de milho seco, limpos e selecionados, para farinha e preparação de refeições. Venda por saco; confirmar o peso da embalagem com o vendedor.' },
  { key: 'arroz', nome: 'Arroz branco', aliases: ['arroz'], categoria: 'Cereais', unidade: 'kg', quantidadeDisponivel: '140', precoUnitario: '95.00',
    descricao: 'Arroz branco em grão, selecionado e pronto para cozinhar. Indicado para refeições familiares, pequenos restaurantes e revenda.' },
  { key: 'feijao', nome: 'Feijão manteiga', aliases: ['feijao', 'feijoes'], categoria: 'Leguminosas', unidade: 'kg', quantidadeDisponivel: '75', precoUnitario: '120.00',
    descricao: 'Feijão manteiga seco, com grãos selecionados para cozedura. Conservar em local seco e arejado até à preparação.' },
  { key: 'tomate', nome: 'Tomate fresco', aliases: ['tomate', 'tomates'], categoria: 'Hortaliças', unidade: 'kg', quantidadeDisponivel: '85', precoUnitario: '65.00',
    descricao: 'Tomate maduro e firme, adequado para saladas, molhos e refogados. Seleção de frutos frescos para consumo nos próximos dias.' },
  { key: 'cebola', nome: 'Cebola seca', aliases: ['cebola', 'cebolas'], categoria: 'Hortaliças', unidade: 'kg', quantidadeDisponivel: '90', precoUnitario: '70.00',
    descricao: 'Cebola de casca seca, firme e selecionada, para temperos e refogados. Guardar em local fresco e ventilado.' },
  { key: 'batata', nome: 'Batata-reno', aliases: ['batata', 'batatas'], categoria: 'Tubérculos', unidade: 'kg', quantidadeDisponivel: '160', precoUnitario: '60.00',
    descricao: 'Batata-reno de tamanho variado, firme e própria para cozer, fritar ou assar. Manter ao abrigo da luz até à utilização.' },
  { key: 'mandioca', nome: 'Mandioca fresca', aliases: ['mandioca'], categoria: 'Tubérculos', unidade: 'kg', quantidadeDisponivel: '120', precoUnitario: '35.00',
    descricao: 'Raízes frescas de mandioca de mesa, com casca, destinadas a consumo após descascar e cozinhar adequadamente. Preparar pouco depois da recolha.' },
  { key: 'amendoim', nome: 'Amendoim em grão', aliases: ['amendoim'], categoria: 'Leguminosas', unidade: 'kg', quantidadeDisponivel: '65', precoUnitario: '135.00',
    descricao: 'Amendoim cru, sem casca e selecionado, para torrar, preparar molhos ou utilizar em receitas locais. Contém amendoim.' },
  { key: 'repolho', nome: 'Repolho verde', aliases: ['repolho', 'repolhos'], categoria: 'Hortaliças', unidade: 'unidade', quantidadeDisponivel: '60', precoUnitario: '45.00',
    descricao: 'Repolho verde inteiro, com folhas firmes, para saladas e pratos cozinhados. Venda por cabeça, sem presumir um peso fixo.' },
  { key: 'cenoura', nome: 'Cenoura fresca', aliases: ['cenoura', 'cenouras'], categoria: 'Hortaliças', unidade: 'kg', quantidadeDisponivel: '80', precoUnitario: '75.00',
    descricao: 'Cenoura fresca de tamanho variado, firme e selecionada, para saladas, sopas e refogados. Lavar antes da preparação.' },
].map((product) => Object.freeze({ ...product, aliases: Object.freeze(product.aliases) })));

function normalizeName(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function planProducts(existing) {
  const missing = Math.max(0, TARGET_PRODUCTS - existing.length);
  const names = existing.map(({ nome }) => ` ${normalizeName(nome)} `);
  return DEMO_PRODUCTS.filter((template) => !names.some((name) =>
    template.aliases.some((alias) => name.includes(` ${alias} `)))).slice(0, missing);
}

function missingImages(existing) {
  return existing.filter((product) => !product.imagem?.trim()).flatMap((product) => {
    const name = ` ${normalizeName(product.nome)} `;
    const matches = DEMO_PRODUCTS.filter((template) => template.aliases.some((alias) => name.includes(` ${alias} `)));
    // Never guess a picture for ambiguous names or replace a supplied image.
    return matches.length === 1 ? [{ id: product.id, nome: product.nome, anterior: product.imagem,
      imagem: `/images/demo-products/${matches[0].key}.svg` }] : [];
  });
}

function productData(template, seller) {
  if (seller.tipo !== 'vendedor') throw new Error('O seed só pode associar produtos a vendedores existentes.');
  return {
    nome: template.nome,
    descricao: `${template.descricao} Dados, preço e disponibilidade fictícios, apenas para demonstração.`,
    categoria: template.categoria,
    imagem: `/images/demo-products/${template.key}.svg`,
    localizacao: seller.endereco?.trim() || 'Moçambique — demonstração local',
    userId: seller.id,
    ...prepareStructuredProduct({ quantidadeDisponivel: template.quantidadeDisponivel,
      unidade: template.unidade, precoUnitario: template.precoUnitario, moeda: 'MZN' }),
  };
}

function localDemoConfig(env) {
  let url;
  try { url = new URL(env.AGROMARKET_TEST_DATABASE_URL); } catch { /* Refuse without an explicit URL. */ }
  if (!url || !['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== '127.0.0.1' ||
      url.port !== '55432' || url.pathname !== '/agromarkt_test' || !url.username || url.search || url.hash ||
      env.AGROMARKET_TEST_DATABASE_NAME !== 'agromarkt_test' ||
      env.AGROMARKET_TEST_DATABASE_CONFIRM !== 'isolated-tests-only') {
    throw new Error('Seed recusado: exige ligação específica e confirmação de 127.0.0.1:55432/agromarkt_test; sem fallback ou .env.');
  }
  return { url: url.href, destination: '127.0.0.1:55432/agromarkt_test' };
}

module.exports = { TARGET_PRODUCTS, DEMO_PRODUCTS, normalizeName, planProducts, missingImages, productData, localDemoConfig };
