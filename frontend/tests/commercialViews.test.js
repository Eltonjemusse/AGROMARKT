import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

// Renderização dos componentes reais: não constitui aprovação visual/browser.
test('vistas comerciais respeitam permissões, unidades e dados históricos', async (t) => {
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let account = { id: 1, nome: 'Conta de teste', tipo: 'comprador' };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key) => key === 'user' ? JSON.stringify(account) : key === 'token' ? 'synthetic-token' : null,
  } });
  const vite = await createServer({ configFile: false, envDir: false,
    root: fileURLToPath(new URL('..', import.meta.url)), plugins: [react()],
    server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  try {
    const load = async (path) => (await vite.ssrLoadModule(`/src/${path}.jsx`)).default;
    const Navbar = await load('components/Navbar');
    const NovoProduto = await load('pages/NovoProduto');
    const OrderCommercial = await load('components/OrderCommercial');
    const OrderActions = await load('components/OrderActions');
    const ProductCommercial = await load('components/ProductCommercial');
    const ProductFields = await load('components/ProductFields');
    const { productFormValues } = await import('../src/utils/commercial.js');
    const render = (Component, props = {}) => renderToStaticMarkup(
      React.createElement(MemoryRouter, null, React.createElement(Component, props)));

    await t.test('comprador não recebe links nem formulário de publicação', () => {
      const navigation = render(Navbar);
      assert.doesNotMatch(navigation, /href="\/(novo-produto|meus-produtos)"/);
      const page = render(NovoProduto);
      assert.doesNotMatch(page, /<form/);
      assert.match(page, /passar para vendedor/);
      for (const tipo of ['vendedor', 'admin']) {
        account = { ...account, tipo };
        assert.match(render(Navbar), /href="\/novo-produto"/);
        const form = render(NovoProduto);
        assert.match(form, /<form/);
        assert.match(form, /name="precoUnitario"/);
        assert.match(form, /name="quantidadeDisponivel"/);
      }
    });

    await t.test('formulário tem unidades explícitas e não infere dados do legado', () => {
      const form = productFormValues({ nome: 'Antigo', quantidade: '50 sacos', preco: 200 });
      const html = render(ProductFields, { form, onChange: () => {}, commercialRequired: false });
      for (const unit of ['kg', 'litro', 'unidade', 'saco']) assert.match(html, new RegExp(`value="${unit}"`));
      assert.doesNotMatch(html, /value="50|value="200/);
      assert.match(html, /name="precoUnitario"/);
      assert.doesNotMatch(html, /type="number"/);
    });

    await t.test('produto mostra preço por unidade e aviso claro quando precisa de revisão', () => {
      const html = render(ProductCommercial, { product: { quantidadeDisponivel: '12.500000', unidade: 'kg',
        precoUnitario: '0.200000', moeda: 'MZN', dadosEstruturadosEstado: 'validado' } });
      assert.match(html, /0,20 MT \/ kg/);
      assert.match(html, /12,5 kg/);
      const legacy = render(ProductCommercial, { product: { quantidade: '50 sacos', preco: 200 } });
      assert.match(legacy, /Produto por rever/);
      assert.match(legacy, /50 sacos/);
      assert.doesNotMatch(legacy, /200 MT/);
    });

    await t.test('encomenda mostra snapshots mesmo depois de mudar o produto atual', () => {
      const html = render(OrderCommercial, { order: { id: 12, status: 'pendente', quantidadeNumerica: '0.125000',
        unidadeSnapshot: 'kg', precoUnitarioSnapshot: '0.200000', moedaSnapshot: 'MZN', totalDecimal: '0.03',
        nomeProdutoSnapshot: 'Nome original', versaoCalculo: 'decimal-v1-half-up-2', dadosEstruturadosEstado: 'validado',
        product: { nome: 'Nome alterado', precoUnitario: '1.250000', unidade: 'litro' } } });
      assert.match(html, /Nome original/);
      assert.match(html, /0,125 kg/);
      assert.match(html, /0,20 MT \/ kg/);
      assert.match(html, /0,03 MT/);
      assert.doesNotMatch(html, /Nome alterado|1,25|litro|histórico incompleto/);
    });

    await t.test('histórico incompleto não usa o preço/moeda atuais como histórico', () => {
      const html = render(OrderCommercial, { order: { id: 12, status: 'entregue', quantidade: '2', total: 200,
        product: { nome: 'Produto atual', precoUnitario: '900.000000', moeda: 'MZN', unidade: 'saco' } } });
      assert.match(html, /Registo histórico incompleto/);
      assert.match(html, /moeda histórica não confirmada/);
      assert.match(html, /Produto atual \(referência\)/);
      assert.doesNotMatch(html, /200 MT|900|2 saco/);
    });

    await t.test('legado mostra revisão e bloqueia a aceitação na interface', () => {
      const html = render(OrderActions, { order: { id: 1, status: 'pendente' }, onStatus: () => {} });
      assert.match(html, /Revisão necessária/);
      assert.match(html, /<button[^>]*disabled=""[^>]*>Aceitar encomenda/);
      assert.match(html, /Rejeitar encomenda/);
    });

    await t.test('encomenda aceite só oferece entrega e estados finais não oferecem reabertura', () => {
      const html = render(OrderActions, { order: { id: 1, status: 'aceite', stockDescontadoEm: '2026-10-22T17:00:00Z' }, onStatus: () => {} });
      assert.match(html, /Marcar como entregue/);
      assert.doesNotMatch(html, /Aceitar encomenda|Rejeitar encomenda/);
      for (const status of ['entregue', 'rejeitado']) {
        const closed = render(OrderActions, { order: { id: 1, status }, onStatus: () => {} });
        assert.match(closed, /Encomenda encerrada/);
        assert.doesNotMatch(closed, /<button/);
      }
    });
  } finally {
    await vite.close();
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else delete globalThis.localStorage;
  }
});
