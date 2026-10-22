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
