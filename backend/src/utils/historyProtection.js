class HistoryError extends Error {
  constructor(statusCode, message) { super(message); this.statusCode = statusCode; }
}
const historyMessage = 'Remoção bloqueada: existem encomendas associadas. É necessário preservar o histórico de compras e vendas.';

async function removeProduct(prisma, id, actor) {
  try {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id } });
      if (!product) throw new HistoryError(404, 'Produto não encontrado');
      if (product.userId !== actor.id && actor.tipo !== 'admin') throw new HistoryError(403, 'Sem permissão');
      if (await tx.order.count({ where: { productId: id } })) throw new HistoryError(409, historyMessage);
      // Existing ON DELETE RESTRICT FKs protect even an order inserted after the count.
      await tx.product.delete({ where: { id } });
    });
  } catch (error) {
    if (error.code === 'P2003') throw new HistoryError(409, historyMessage);
    if (error.code === 'P2025') throw new HistoryError(404, 'Produto não encontrado');
    throw error;
  }
}

async function removeUser(prisma, id) {
  try {
    await prisma.$transaction(async (tx) => {
      if (!await tx.user.findUnique({ where: { id }, select: { id: true } })) throw new HistoryError(404, 'Utilizador não encontrado');
      const orders = await tx.order.count({ where: { OR: [{ buyerId: id }, { sellerId: id }, { product: { userId: id } }] } });
      if (orders) throw new HistoryError(409, historyMessage);
      // Both deletions roll back if a concurrent FK reference appears. Never delete orders.
      await tx.product.deleteMany({ where: { userId: id } });
      await tx.user.delete({ where: { id } });
    });
  } catch (error) {
    if (error.code === 'P2003') throw new HistoryError(409, historyMessage);
    if (error.code === 'P2025') throw new HistoryError(404, 'Utilizador não encontrado');
    throw error;
  }
}

module.exports = { removeProduct, removeUser };
