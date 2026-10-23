import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer as createHttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const require = createRequire(import.meta.url);
const { DEMO_PRODUCTS, productData } = require('../../backend/scripts/lib/demoProducts');

test('produtos de demonstração renderizam preço, unidade, vendedor e imagens locais acessíveis', async () => {
  const vite = await createServer({ configFile: false, envDir: false,
    root: fileURLToPath(new URL('..', import.meta.url)), plugins: [react()], logLevel: 'error',
    server: { middlewareMode: true, hmr: false, ws: false } });
  const server = createHttpServer(vite.middlewares);
  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const ProductCard = (await vite.ssrLoadModule('/src/components/ProductCard.jsx')).default;
    for (const [index, template] of DEMO_PRODUCTS.entries()) {
      const product = { id: index + 1, ...productData(template, { id: 50, tipo: 'vendedor' }), user: { nome: 'Vendedor sintético' } };
      const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(ProductCard, { product })));
      assert.ok(html.includes(`src="${product.imagem}"`));
      assert.ok(html.includes(`alt="${product.nome}"`));
      assert.ok(html.includes(product.nome));
      assert.ok(html.includes(`MT / ${product.unidade}`));
      assert.ok(html.includes(product.categoria));
      assert.ok(html.includes('Vendedor sintético'));
      assert.ok(html.includes(`href="/produtos/${product.id}"`));
      assert.doesNotMatch(html, /Produto por rever/);
      const image = await fetch(origin + product.imagem);
      assert.equal(image.status, 200);
      assert.match(image.headers.get('content-type'), /image\/svg\+xml/);
      assert.ok((await image.text()).includes(`<title>${product.nome}</title>`));
    }
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await vite.close();
  }
});
