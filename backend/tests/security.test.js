const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Load the real controller with isolated dependencies. Never load Prisma or .env.
function loadController(filename, dependencies) {
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '../src/controllers', filename), 'utf8');
  vm.runInNewContext(source, {
    module,
    console,
    require(name) {
      if (name === '../utils/validation') return require('../src/utils/validation');
      if (!Object.prototype.hasOwnProperty.call(dependencies, name)) {
        throw new Error(`Unexpected dependency: ${name}`);
      }
      return dependencies[name];
    }
  }, { filename });
  return module.exports;
}

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

function registration() {
  const calls = { lookups: 0, creates: 0, hashes: 0 };
  const prisma = {
    user: {
      async findUnique() { calls.lookups++; return null; },
      async create({ data }) { calls.creates++; calls.data = data; return { id: 1, ...data }; }
    }
  };
  const controller = loadController('authController.js', {
    '../config/prisma': prisma,
    bcryptjs: { async hash() { calls.hashes++; return 'simulated-hash'; } },
    jsonwebtoken: {}
  });
  return { register: controller.register, calls };
}

const validRegistration = {
  nome: 'Ana', email: 'ana@example.test', senha: 'test-password', telefone: '+258840000000'
};

for (const tipo of ['admin', 'desconhecido', '', null, 123, true, {}, []]) {
  test(`registo rejeita tipo inválido ${JSON.stringify(tipo)}`, async () => {
    const { register, calls } = registration();
    const res = response();
    await register({ body: { ...validRegistration, tipo } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(calls.lookups, 0);
    assert.equal(calls.hashes, 0);
    assert.equal(calls.creates, 0);
  });
}

for (const tipo of ['comprador', 'vendedor', undefined]) {
  test(`registo aceita ${tipo ?? 'tipo omitido, como comprador'}`, async () => {
    const { register, calls } = registration();
    const res = response();
    const body = { ...validRegistration };
    if (tipo !== undefined) body.tipo = tipo;
    await register({ body }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(calls.creates, 1);
    assert.equal(calls.hashes, 1);
    assert.equal(calls.data.tipo, tipo ?? 'comprador');
    assert.equal(calls.data.nome, validRegistration.nome);
    assert.equal(calls.data.email, validRegistration.email);
    assert.equal(calls.data.telefone, validRegistration.telefone);
    assert.equal(calls.data.senha, 'simulated-hash');
    assert.equal(Object.hasOwn(res.body.user, 'senha'), false);
  });
}

for (const field of ['nome', 'email', 'senha']) {
  test(`registo valida o tipo e a presença de ${field} antes de usar dependências`, async () => {
    for (const value of [undefined, null, 123, true, {}, [], '', '   ']) {
      const { register, calls } = registration();
      const res = response();
      await register({ body: { ...validRegistration, [field]: value } }, res);
      assert.equal(res.statusCode, 400, `${field}: ${JSON.stringify(value)}`);
      assert.equal(calls.lookups + calls.hashes + calls.creates, 0);
    }
  });
}

test('registo rejeita corpo ausente ou inválido', async () => {
  for (const body of [undefined, null, 'texto', 1, []]) {
    const { register, calls } = registration();
    const res = response();
    await register({ body }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(calls.lookups + calls.hashes + calls.creates, 0);
  }
});

function productEditing(productExists = true) {
  const product = {
    id: 10, userId: 2, nome: 'Tomate', descricao: 'Fresco', preco: 25,
    quantidade: '10 kg', categoria: 'Hortaliças', imagem: 'https://example.test/image.jpg',
    localizacao: 'Chókwè', createdAt: '2026-01-01T00:00:00.000Z'
  };
  const calls = { updates: 0 };
  const controller = loadController('productController.js', {
    '../config/prisma': {
      product: {
        async findUnique() { return productExists ? { ...product } : null; },
        async update({ where, data }) {
          calls.updates++;
          calls.where = where;
          calls.data = data;
          return { ...product, ...data };
        }
      }
    }
  });
  return { updateProduct: controller.updateProduct, product, calls };
}

function editRequest(body, user = { id: 2, tipo: 'vendedor' }) {
  return { body, user, params: { id: '10' } };
}

for (const user of [{ id: 2, tipo: 'vendedor' }, { id: 99, tipo: 'admin' }]) {
  test(`${user.tipo}: edição ignora proprietário, identidade, relações e datas internas`, async () => {
    const { updateProduct, product, calls } = productEditing();
    const res = response();
    await updateProduct(editRequest({
      nome: 'Tomate atualizado', id: 999, userId: 99,
      user: { connect: { id: 99 } }, orders: { deleteMany: {} },
      createdAt: '2030-01-01T00:00:00.000Z', updatedAt: '2030-01-01T00:00:00.000Z'
    }, user), res);
    assert.equal(res.statusCode, 200);
    assert.equal(calls.updates, 1);
    assert.deepEqual({ ...calls.where }, { id: 10 });
    assert.deepEqual({ ...calls.data }, { nome: 'Tomate atualizado' });
    assert.equal(res.body.product.id, product.id);
    assert.equal(res.body.product.userId, product.userId);
    assert.equal(res.body.product.createdAt, product.createdAt);
    assert.equal(res.body.product.preco, product.preco);
    assert.equal(res.body.product.descricao, product.descricao);
  });
}

test('edição de produto alheio é negada', async () => {
  const { updateProduct, calls } = productEditing();
  const res = response();
  await updateProduct(editRequest({ nome: 'Outro' }, { id: 3, tipo: 'vendedor' }), res);
  assert.equal(res.statusCode, 403);
  assert.equal(calls.updates, 0);
});

for (const user of [{ id: 2, tipo: 'vendedor' }, { id: 99, tipo: 'admin' }]) {
  test(`${user.tipo}: operações aninhadas não alteram campos internos nem relações`, async () => {
    const attacks = [
      { id: { set: 999 }, userId: { set: 99 } },
      { user: { connect: { id: 99 } } },
      { user: { update: { tipo: 'admin', produtos: { deleteMany: {} } } } },
      { user: { connectOrCreate: { where: { id: 99 }, create: { tipo: 'admin' } } } },
      { orders: { create: { buyer: { connect: { id: 99 } } } } },
      { orders: { updateMany: { where: {}, data: { total: 0 } }, deleteMany: {} } },
      { createdAt: { set: '2030-01-01T00:00:00.000Z' } }
    ];
    for (const attack of attacks) {
      const { updateProduct, product, calls } = productEditing();
      const res = response();
      await updateProduct(editRequest({ ...attack, nome: 'Atualizado' }, user), res);
      assert.equal(res.statusCode, 200);
      // Assert the exact Prisma payload; the mock does not interpret nested writes.
      assert.deepEqual({ ...calls.data }, { nome: 'Atualizado' });
      assert.deepEqual({ ...calls.where }, { id: product.id });
      assert.deepEqual(res.body.product, { ...product, nome: 'Atualizado' });
    }
  });
}

test('campos no corpo não permitem contornar a autorização', async () => {
  const { updateProduct, calls } = productEditing();
  const res = response();
  await updateProduct(editRequest({
    nome: 'Outro', userId: 3, tipo: 'admin',
    user: { connect: { id: 3 }, update: { tipo: 'admin' } }
  }, { id: 3, tipo: 'vendedor' }), res);
  assert.equal(res.statusCode, 403);
  assert.equal(calls.updates, 0);
});

test('edição de produto inexistente devolve 404', async () => {
  const { updateProduct, calls } = productEditing(false);
  const res = response();
  await updateProduct(editRequest({ preco: 30 }), res);
  assert.equal(res.statusCode, 404);
  assert.equal(calls.updates, 0);
});

test('edição rejeita preços inválidos sem atualizar o produto', async () => {
  for (const preco of [0, -1, NaN, Infinity, -Infinity, '', ' ', 'abc', '12abc', 'Infinity', '1e999', null, undefined, true, false, [], [10], {}]) {
    const { updateProduct, calls } = productEditing();
    const res = response();
    await updateProduct(editRequest({ preco }), res);
    assert.equal(res.statusCode, 400, `preco: ${String(preco)}`);
    assert.equal(calls.updates, 0);
  }
});

test('edição aceita preço positivo numérico ou em texto e preserva campos omitidos', async () => {
  for (const preco of [12.5, '12.50']) {
    const { updateProduct, product, calls } = productEditing();
    const res = response();
    await updateProduct(editRequest({ preco }), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual({ ...calls.data }, { preco: 12.5 });
    assert.deepEqual(res.body.product, { ...product, preco: 12.5 });
  }
});

test('edição permite os restantes campos públicos, incluindo imagem vazia', async () => {
  const { updateProduct, calls } = productEditing();
  const res = response();
  const body = {
    nome: 'Milho', descricao: 'Seco', quantidade: '20 kg',
    categoria: 'Cereais', imagem: '', localizacao: 'Maputo'
  };
  await updateProduct(editRequest(body), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual({ ...calls.data }, body);
});

test('edição rejeita corpo ausente ou inválido', async () => {
  for (const body of [undefined, null, 'texto', 1, []]) {
    const { updateProduct, calls } = productEditing();
    const res = response();
    await updateProduct(editRequest(body), res);
    assert.equal(res.statusCode, 400);
    assert.equal(calls.updates, 0);
  }
});

const invalidNumbers = [undefined, null, true, false, [], [1], {}, '', ' ', 'abc', '1kg', '0x10', 0, -1, NaN, Infinity, -Infinity, '1e999'];
const invalidIds = [undefined, null, true, false, [], [1], {}, '', ' ', 'abc', '1.5', '1e1', '0x10', 0, -1, 1.5, NaN, Infinity, 2147483648, '9007199254740993'];
const validProduct = {
  nome: 'Tomate', descricao: 'Fresco', preco: 25, quantidade: '10 kg',
  categoria: 'Hortaliças', localizacao: 'Maputo', imagem: ''
};

function marketplace(overrides = {}) {
  const product = { id: 10, userId: 2, ...validProduct, ...overrides };
  const order = { id: 20, sellerId: 2, buyerId: 3, status: 'pendente' };
  const calls = [];
  const record = (name, result) => async (args) => {
    calls.push({ name, ...args });
    return typeof result === 'function' ? result(args) : result;
  };
  const prisma = {
    product: {
      findUnique: record('product.findUnique', product),
      create: record('product.create', ({ data }) => ({ id: 11, ...data })),
      delete: record('product.delete', product)
    },
    order: {
      create: record('order.create', ({ data }) => ({ id: 21, status: 'pendente', ...data })),
      findUnique: record('order.findUnique', order),
      findMany: record('order.findMany', []),
      update: record('order.update', ({ data }) => ({ ...order, ...data })),
      deleteMany: record('order.deleteMany', { count: 0 })
    }
  };
  const dependencies = { '../config/prisma': prisma };
  return {
    products: loadController('productController.js', dependencies),
    orders: loadController('orderController.js', dependencies),
    admin: loadController('adminController.js', dependencies),
    calls, product, order
  };
}

test('publicação bloqueia compradores e tipos desconhecidos sem escrever dados', async () => {
  for (const tipo of ['comprador', 'desconhecido', undefined]) {
    const { products, calls } = marketplace();
    const res = response();
    await products.createProduct({ user: { id: 2, tipo }, body: validProduct }, res);
    assert.equal(res.statusCode, 403);
    assert.equal(calls.length, 0);
  }
});

test('vendedor/admin publicam com proprietário autenticado e preço válido', async () => {
  for (const tipo of ['vendedor', 'admin']) {
    for (const preco of [12.5, '12.50']) {
      const { products, calls } = marketplace();
      const res = response();
      await products.createProduct({ user: { id: 2, tipo }, body: { ...validProduct, preco, userId: 99, user: { connect: { id: 99 } } } }, res);
      assert.equal(res.statusCode, 201);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].name, 'product.create');
      assert.deepEqual({ ...calls[0].data }, { ...validProduct, preco: 12.5, userId: 2 });
    }
  }
});

test('publicação rejeita campos obrigatórios sem texto válido', async () => {
  for (const field of ['nome', 'descricao', 'quantidade', 'categoria', 'localizacao']) {
    for (const value of [undefined, null, true, 123, [], {}, '', '   ']) {
      const { products, calls } = marketplace();
      const res = response();
      await products.createProduct({ user: { id: 2, tipo: 'vendedor' }, body: { ...validProduct, [field]: value } }, res);
      assert.equal(res.statusCode, 400, field);
      assert.equal(calls.length, 0);
    }
  }
});

test('publicação rejeita preço inválido e imagem não textual', async () => {
  for (const body of [...invalidNumbers.map((preco) => ({ ...validProduct, preco })), { ...validProduct, imagem: {} }]) {
    const { products, calls } = marketplace();
    const res = response();
    await products.createProduct({ user: { id: 2, tipo: 'vendedor' }, body }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(calls.length, 0);
  }
});

test('identificadores inválidos são rejeitados em todos os endpoints com ID de produto/encomenda', async () => {
  for (const id of invalidIds) {
    for (const endpoint of ['getProductById', 'updateProduct', 'deleteProduct', 'adminDeleteProduct', 'createOrder', 'updateOrderStatus']) {
      const { products, orders, admin, calls } = marketplace();
      const res = response();
      const req = { params: { id }, user: { id: 2, tipo: 'admin' }, body: { productId: id, quantidade: 1, status: 'aceite' } };
      const handler = endpoint === 'adminDeleteProduct' ? admin.deleteProduct : products[endpoint] || orders[endpoint];
      await handler(req, res);
      assert.equal(res.statusCode, 400, `${endpoint}: ${String(id)}`);
      assert.equal(calls.length, 0);
    }
  }
});

test('encomendas rejeitam quantidades inválidas antes de consultar o produto', async () => {
  for (const quantidade of invalidNumbers) {
    const { orders, calls } = marketplace();
    const res = response();
    await orders.createOrder({ user: { id: 3, tipo: 'comprador' }, body: { productId: 10, quantidade } }, res);
    assert.equal(res.statusCode, 400, String(quantidade));
    assert.equal(calls.length, 0);
  }
});

test('comprador, vendedor e admin compram frações de produtos alheios sem reservar stock', async () => {
  for (const tipo of ['comprador', 'vendedor', 'admin']) {
    for (const quantidade of [0.5, '0.50']) {
      const { orders, calls, product } = marketplace({ quantidade: 'quantidade textual sem stock estruturado' });
      const res = response();
      await orders.createOrder({ user: { id: 3, tipo }, body: {
        productId: '10', quantidade, buyerId: 99, sellerId: 99, preco: 0.01, total: 0.01, status: 'entregue'
      } }, res);
      assert.equal(res.statusCode, 201);
      assert.deepEqual(calls.map((call) => call.name), ['product.findUnique', 'order.create']);
      assert.deepEqual({ ...calls[0].where }, { id: 10 });
      assert.deepEqual({ ...calls[1].data }, { productId: 10, buyerId: 3, sellerId: 2, quantidade: '0.5', total: 12.5 });
      assert.equal(res.body.order.status, 'pendente');
      assert.equal(product.quantidade, 'quantidade textual sem stock estruturado');
    }
  }
});

test('ninguém pode encomendar o próprio produto, incluindo admin', async () => {
  for (const tipo of ['comprador', 'vendedor', 'admin']) {
    const { orders, calls } = marketplace();
    const res = response();
    await orders.createOrder({ user: { id: 2, tipo }, body: { productId: 10, quantidade: 1 } }, res);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(calls.map((call) => call.name), ['product.findUnique']);
  }
});

test('preço guardado inválido e total com overflow/underflow são rejeitados', async () => {
  const cases = [0, -1, NaN, Infinity, null, '25'].map((preco) => ({ preco, quantidade: 1 }));
  cases.push({ preco: Number.MAX_VALUE, quantidade: 2 }, { preco: Number.MIN_VALUE, quantidade: 0.5 });
  for (const { preco, quantidade } of cases) {
    const { orders, calls } = marketplace({ preco });
    const res = response();
    await orders.createOrder({ user: { id: 3 }, body: { productId: 10, quantidade } }, res);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(calls.map((call) => call.name), ['product.findUnique']);
  }
});

test('apenas vendedor da encomenda/admin alteram os quatro estados legítimos', async () => {
  for (const user of [{ id: 2, tipo: 'vendedor' }, { id: 99, tipo: 'admin' }]) {
    for (const status of ['pendente', 'aceite', 'rejeitado', 'entregue']) {
      const { orders, calls } = marketplace();
      const res = response();
      await orders.updateOrderStatus({ params: { id: '20' }, user, body: { status, total: 0, buyerId: 99 } }, res);
      assert.equal(res.statusCode, 200);
      assert.deepEqual({ ...calls[1].data }, { status });
      assert.deepEqual({ ...calls[1].where }, { id: 20 });
    }
  }
  for (const user of [{ id: 3, tipo: 'comprador' }, { id: 4, tipo: 'vendedor' }]) {
    const { orders, calls } = marketplace();
    const res = response();
    await orders.updateOrderStatus({ params: { id: 20 }, user, body: { status: 'aceite' } }, res);
    assert.equal(res.statusCode, 403);
    assert.deepEqual(calls.map((call) => call.name), ['order.findUnique']);
  }
});

test('estados desconhecidos e tipos inválidos são rejeitados sem alteração', async () => {
  for (const status of [undefined, null, '', 'cancelado', 'ACEITE', true, 1, [], {}, { set: 'aceite' }]) {
    const { orders, calls } = marketplace();
    const res = response();
    await orders.updateOrderStatus({ params: { id: 20 }, user: { id: 2 }, body: { status } }, res);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(calls.map((call) => call.name), ['order.findUnique']);
  }
});

test('publicação e encomendas rejeitam corpo inválido', async () => {
  for (const body of [undefined, null, true, 'texto', 1, []]) {
    for (const name of ['createProduct', 'createOrder', 'updateOrderStatus']) {
      const { products, orders, calls } = marketplace();
      const res = response();
      await (products[name] || orders[name])({ params: { id: 20 }, user: { id: 2, tipo: 'vendedor' }, body }, res);
      assert.equal(res.statusCode, 400);
      assert.equal(calls.some((call) => call.name.endsWith('.create') || call.name.endsWith('.update')), false);
    }
  }
});

test('consultas continuam filtradas pelo comprador/vendedor autenticado', async () => {
  for (const [name, field] of [['getMyOrders', 'buyerId'], ['getReceivedOrders', 'sellerId']]) {
    const { orders, calls } = marketplace();
    const res = response();
    await orders[name]({ user: { id: 3 }, query: { buyerId: 99, sellerId: 99 } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual({ ...calls[0].where }, { [field]: 3 });
  }
});
