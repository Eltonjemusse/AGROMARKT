const { Decimal } = require('@prisma/client/runtime/library');
const { validateQuantity, calculateOrderTotal } = require('./commercialDecimals');
const { isStructuredProduct } = require('./structuredCommerce');
const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
const NEXT_STATES = Object.freeze({ pendente: ['aceite', 'rejeitado'], aceite: ['entregue'], rejeitado: [], entregue: [] });

class WorkflowError extends Error {
  constructor(statusCode, message) { super(message); this.statusCode = statusCode; }
}

function validatedOrderQuantity(order) {
  const review = () => new WorkflowError(409, 'Encomenda com dados antigos ou incompletos: revisão necessária antes da aceitação.');
  if (order.dadosEstruturadosEstado !== 'validado' || order.versaoCalculo !== 'decimal-v1-half-up-2' ||
      typeof order.nomeProdutoSnapshot !== 'string' || !order.nomeProdutoSnapshot.trim() ||
      order.quantidadeNumerica == null || order.precoUnitarioSnapshot == null || order.totalDecimal == null) throw review();
  try {
    const quote = calculateOrderTotal({ quantidade: order.quantidadeNumerica.toString(), unidade: order.unidadeSnapshot,
      precoUnitario: order.precoUnitarioSnapshot.toString(), moeda: order.moedaSnapshot });
    if (!new D(quote.total).eq(order.totalDecimal.toString())) throw review();
    return quote.quantidade;
  } catch { throw review(); }
}

async function changeOrderStatus(prisma, { id, actor, status }) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${id} FOR UPDATE`;
    const order = await tx.order.findUnique({ where: { id } });
    if (!order) throw new WorkflowError(404, 'Pedido não encontrado');
    if (order.sellerId !== actor.id && actor.tipo !== 'admin') throw new WorkflowError(403, 'Sem permissão');
    if (status === order.status) {
      if (status === 'aceite' && !order.stockDescontadoEm) {
        throw new WorkflowError(409, 'Aceitação antiga sem desconto de stock confirmado: revisão necessária.');
      }
      return order;
    }
    if (!NEXT_STATES[order.status]?.includes(status)) {
      throw new WorkflowError(409, 'Transição não permitida. Pendentes podem ser aceites/rejeitados; aceites podem ser entregues. Estados finais não reabrem.');
    }
    const data = { status };
    if (status === 'aceite') {
      const quantity = validatedOrderQuantity(order);
      if (order.stockDescontadoEm) throw new WorkflowError(409, 'Encomenda com desconto anterior: revisão necessária.');
      await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${order.productId} FOR UPDATE`;
      const product = await tx.product.findUnique({ where: { id: order.productId } });
      if (!isStructuredProduct(product) || product.userId !== order.sellerId ||
          product.unidade !== order.unidadeSnapshot || product.moeda !== order.moedaSnapshot) {
        throw new WorkflowError(409, 'Produto/unidade incompatível com a encomenda: revisão necessária antes da aceitação.');
      }
      const available = validateQuantity(product.quantidadeDisponivel.toString(), product.unidade, { allowZero: true });
      const remaining = new D(available).minus(quantity);
      if (remaining.isNegative()) throw new WorkflowError(409, 'Quantidade disponível insuficiente para aceitar esta encomenda.');
      const debit = await tx.product.updateMany({
        where: { id: product.id, unidade: order.unidadeSnapshot, quantidadeDisponivel: { gte: quantity } },
        data: { quantidadeDisponivel: { decrement: quantity }, quantidade: `${remaining.toFixed()} ${product.unidade}` }
      });
      if (debit.count !== 1) throw new WorkflowError(409, 'Disponibilidade alterada; atualiza a encomenda e tenta novamente.');
      data.stockDescontadoEm = new Date();
    }
    return tx.order.update({ where: { id }, data });
  }, { maxWait: 5000, timeout: 10000 });
}

module.exports = { NEXT_STATES, WorkflowError, validatedOrderQuantity, changeOrderStatus };
