const prisma = require('../config/prisma');
const { isObjectBody, positiveNumber, positiveId } = require('../utils/validation');
const { validateUnitPrice } = require('../utils/commercialDecimals');
const { changeOrderStatus } = require('../utils/orderWorkflow');
const { hasStructuredData, isStructuredProduct, prepareStructuredOrder,
  rejectSnapshotInput, serializeOrder } = require('../utils/structuredCommerce');

const createOrder = async (req, res) => {
  try {
    if (!isObjectBody(req.body)) {
      return res.status(400).json({ message: 'Dados de encomenda inválidos' });
    }
    const { productId, quantidade } = req.body;
    rejectSnapshotInput(req.body, { creating: true });
    const id = positiveId(productId);
    const modernQuantity = Object.prototype.hasOwnProperty.call(req.body, 'quantidadeNumerica');
    // Same positive NUMERIC(18,6) bounds; the actual unit is checked from the product below.
    if (modernQuantity) validateUnitPrice(req.body.quantidadeNumerica);
    const quantity = modernQuantity ? null : positiveNumber(quantidade);
    if (!Number.isFinite(id) || (!modernQuantity && !Number.isFinite(quantity))) {
      return res.status(400).json({ message: 'Produto e quantidade devem ter valores válidos e positivos' });
    }

    const product = await prisma.product.findUnique({
      where: { id }
    });

    if (!product) {
      return res.status(404).json({ message: 'Produto não encontrado' });
    }

    if (product.userId === req.user.id) {
      return res.status(400).json({ message: 'Não podes encomendar o teu próprio produto' });
    }

    const requestedStructured = ['quantidadeNumerica', 'unidade', 'moeda', 'precoUnitario'].some((key) => Object.prototype.hasOwnProperty.call(req.body, key));
    if (!isStructuredProduct(product) && (requestedStructured || hasStructuredData(product))) {
      return res.status(409).json({ message: 'Produto sem dados estruturados completos e validados; contacte o vendedor' });
    }
    const structured = isStructuredProduct(product) ? prepareStructuredOrder(req.body, product) : null;
    const total = structured ? structured.total : product.preco * quantity;
    if (!structured && (!Number.isFinite(product.preco) || product.preco <= 0 || !Number.isFinite(total) || total <= 0)) {
      return res.status(400).json({ message: 'Preço do produto ou total da encomenda inválido' });
    }

    const order = await prisma.order.create({
      data: {
        productId: product.id,
        buyerId: req.user.id,
        sellerId: product.userId,
        quantidade: String(quantity),
        total,
        ...structured
      }
    });

    res.status(201).json({ message: 'Pedido criado com sucesso', order: serializeOrder(order) });
  } catch (error) {
    if (error instanceof TypeError || error instanceof RangeError) return res.status(400).json({ message: error.message });
    res.status(500).json({ message: 'Erro ao criar pedido' });
  }
};

const getMyOrders = async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { buyerId: req.user.id },
    include: { product: true, seller: { select: { nome: true, telefone: true } } },
    orderBy: { createdAt: 'desc' }
  });

  res.json(orders.map(serializeOrder));
};

const getReceivedOrders = async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { sellerId: req.user.id },
    include: { product: true, buyer: { select: { nome: true, telefone: true } } },
    orderBy: { createdAt: 'desc' }
  });

  res.json(orders.map(serializeOrder));
};

const updateOrderStatus = async (req, res) => {
  try {
    const id = positiveId(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Identificador de encomenda inválido' });

    const order = await prisma.order.findUnique({ where: { id } });

    if (!order) return res.status(404).json({ message: 'Pedido não encontrado' });

    if (order.sellerId !== req.user.id && req.user.tipo !== 'admin') {
      return res.status(403).json({ message: 'Sem permissão' });
    }

    if (!isObjectBody(req.body) || !['pendente', 'aceite', 'rejeitado', 'entregue'].includes(req.body.status)) {
      return res.status(400).json({ message: 'Estado de encomenda inválido' });
    }
    rejectSnapshotInput(req.body);

    const updated = await changeOrderStatus(prisma, { id, actor: req.user, status: req.body.status });

    res.json({ message: 'Estado actualizado', order: serializeOrder(updated) });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    if (['P2034', 'P2028'].includes(error.code)) return res.status(409).json({ message: 'Operação em conflito; atualiza a encomenda e tenta novamente.' });
    if (error instanceof TypeError || error instanceof RangeError) return res.status(400).json({ message: error.message });
    res.status(500).json({ message: 'Erro ao actualizar estado' });
  }
};

module.exports = {
  createOrder,
  getMyOrders,
  getReceivedOrders,
  updateOrderStatus
};
