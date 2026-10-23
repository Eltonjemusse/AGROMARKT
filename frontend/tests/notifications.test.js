import test from 'node:test';
import assert from 'node:assert/strict';
import { createNotificationStore } from '../src/notifications/notificationStore.js';
import { reportOperationError } from '../src/utils/operationFeedback.js';
import { buildProductPayload, buildOrderPayload, productFormValues } from '../src/utils/commercial.js';

function clock() {
  let time = 0;
  let id = 0;
  const tasks = new Map();
  return {
    now: () => time,
    schedule: (callback, delay) => { tasks.set(++id, { callback, at: time + delay }); return id; },
    cancel: (key) => tasks.delete(key),
    pending: () => tasks.size,
    tick: (delay) => {
      const target = time + delay;
      while (true) {
        const next = [...tasks].filter(([, value]) => value.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        tasks.delete(next[0]); time = next[1].at; next[1].callback();
      }
      time = target;
    },
  };
}

function setup() {
  const timer = clock();
  const store = createNotificationStore(timer);
  const unsubscribe = store.subscribe(() => {});
  return { store, timer, unsubscribe };
}

test('sucesso/informação desaparecem em seis segundos; erros permanecem até fechar', () => {
  const { store, timer } = setup();
  store.notify.success('Conta criada.');
  store.notify.info('Sessão terminada.');
  const error = store.notify.error('Não foi possível apagar.');
  timer.tick(5999);
  assert.equal(store.getSnapshot().length, 3);
  timer.tick(1);
  assert.deepEqual(store.getSnapshot(), [{ id: error, type: 'error', message: 'Não foi possível apagar.' }]);
  timer.tick(600000);
  assert.equal(store.getSnapshot().length, 1);
  store.dismiss(error);
  assert.deepEqual(store.getSnapshot(), []);
});

test('rato e foco pausam de forma independente, preservando o tempo restante', () => {
  const { store, timer } = setup();
  const id = store.notify.success('Produto atualizado.');
  timer.tick(1000);
  store.pause(id, 'pointer'); store.pause(id, 'focus');
  timer.tick(20000);
  store.resume(id, 'pointer');
  timer.tick(20000);
  assert.equal(store.getSnapshot().length, 1);
  store.resume(id, 'focus');
  timer.tick(4999);
  assert.equal(store.getSnapshot().length, 1);
  timer.tick(1);
  assert.equal(store.getSnapshot().length, 0);
});

test('página oculta pausa avisos existentes e novos sem os perder', () => {
  const { store, timer } = setup();
  store.notify.success('Encomenda enviada.'); timer.tick(1000);
  store.setHidden(true);
  store.notify.info('Informação nova.'); timer.tick(60000);
  assert.equal(store.getSnapshot().length, 2);
  assert.equal(timer.pending(), 0);
  store.setHidden(false); timer.tick(5000);
  assert.deepEqual(store.getSnapshot().map((item) => item.type), ['info']);
  timer.tick(1000); assert.equal(store.getSnapshot().length, 0);
});

test('desmontagem/StrictMode cancelam timers e ressubscrição mantém mensagens e duração', () => {
  const { store, timer, unsubscribe } = setup();
  store.notify.success('Sessão iniciada.'); timer.tick(1500);
  const before = store.getSnapshot();
  unsubscribe();
  assert.equal(timer.pending(), 0);
  timer.tick(60000);
  assert.equal(store.getSnapshot(), before);
  const stop = store.subscribe(() => {});
  timer.tick(4499); assert.equal(store.getSnapshot().length, 1);
  timer.tick(1); assert.equal(store.getSnapshot().length, 0);
  stop();
});

test('fechar um aviso cancela o timer e preserva outros erros, mesmo repetidos', () => {
  const { store, timer } = setup();
  const success = store.notify.success('Produto publicado.');
  const first = store.notify.error('Falha de ligação.');
  const second = store.notify.error('Falha de ligação.');
  store.dismiss(success); store.dismiss(first); store.dismiss(first);
  store.resume(success, 'focus'); timer.tick(60000);
  assert.deepEqual(store.getSnapshot().map((item) => item.id), [second]);
  assert.equal(timer.pending(), 0);
});

test('validação 400/422 permanece no formulário sem uma notificação duplicada', () => {
  const { store } = setup();
  for (const status of [400, 422]) {
    let inline;
    reportOperationError({ response: { status, data: { message: 'Email ou senha inválidos' } } }, {
      notify: store.notify, fallback: 'Falha.', onFormError: (message) => { inline = message; },
    });
    assert.equal(inline, 'Email ou senha inválidos');
    assert.equal(store.getSnapshot().length, 0);
  }
});

test('validação decimal identifica o campo e mantém os contratos comerciais', () => {
  const form = { ...productFormValues(), nome: 'Tomate', descricao: 'Fresco', categoria: 'Outros', localizacao: 'Teste',
    unidade: 'kg', quantidadeDisponivel: '2,5', precoUnitario: '40' };
  const cases = [
    [() => buildProductPayload({ ...form, unidade: '' }), 'unidade'],
    [() => buildProductPayload({ ...form, quantidadeDisponivel: '1,234' }), 'quantidadeDisponivel'],
    [() => buildProductPayload({ ...form, precoUnitario: '0' }), 'precoUnitario'],
    [() => buildOrderPayload({ id: 1, ...buildProductPayload(form), dadosEstruturadosEstado: 'validado' }, '0'), 'quantidadeNumerica'],
  ];
  for (const [validate, field] of cases) {
    const { store } = setup();
    assert.throws(validate, (error) => {
      let shown;
      reportOperationError(error, { notify: store.notify, fallback: 'Erro.', onFieldError: (key, message) => { shown = { key, message }; } });
      assert.equal(shown.key, field); assert.ok(shown.message); assert.equal(store.getSnapshot().length, 0);
      return true;
    });
  }
  const payload = buildProductPayload(form);
  assert.equal(payload.quantidadeDisponivel, '2.5');
  assert.equal(payload.precoUnitario, '40');
  assert.deepEqual(buildOrderPayload({ id: 1, ...payload, dadosEstruturadosEstado: 'validado' }, '0,125'),
    { productId: '1', quantidadeNumerica: '0.125' });
});

test('falhas de rede, permissões e conflitos ficam em notificações persistentes', () => {
  const { store, timer } = setup();
  for (const status of [undefined, 403, 409, 500]) {
    reportOperationError({ response: status ? { status, data: { message: 'Operação recusada.' } } : undefined }, {
      notify: store.notify, fallback: 'Sem ligação.', onFormError: () => assert.fail('Não é validação do formulário'),
    });
  }
  timer.tick(60000);
  assert.equal(store.getSnapshot().length, 4);
  assert.ok(store.getSnapshot().every((item) => item.type === 'error'));
});

test('mensagem inesperada da API usa texto seguro de recurso', () => {
  const { store } = setup();
  reportOperationError({ response: { status: 500, data: { message: { invalid: true } } } }, { notify: store.notify, fallback: 'Erro ao guardar.' });
  assert.equal(store.getSnapshot()[0].message, 'Erro ao guardar.');
});
