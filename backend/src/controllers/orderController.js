const prisma = require('../config/prisma');
const { isObjectBody, positiveNumber, positiveId } = require('../utils/validation');

const createOrder = async (req, res) => {
  try {
    if (!isObjectBody(req.body)) {
      return res.status(400).json({ message: 'Dados de encomenda inválidos' });
    }
    const { productId, quantidade } = req.body;
    const id = positiveId(productId);
    const quantity = positiveNumber(quantidade);
    if (!Number.isFinite(id) || !Number.isFinite(quantity)) {
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

    const total = product.preco * quantity;
    if (!Number.isFinite(product.preco) || product.preco <= 0 || !Number.isFinite(total) || total <= 0) {
      return res.status(400).json({ message: 'Preço do produto ou total da encomenda inválido' });
    }

    const order = await prisma.order.create({
      data: {
        productId: product.id,
        buyerId: req.user.id,
        sellerId: product.userId,
        quantidade: String(quantity),
        total
      }
    });

    res.status(201).json({ message: 'Pedido criado com sucesso', order });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao criar pedido' });
  }
};

const getMyOrders = async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { buyerId: req.user.id },
    include: { product: true, seller: { select: { nome: true, telefone: true } } },
    orderBy: { createdAt: 'desc' }
  });

  res.json(orders);
};

const getReceivedOrders = async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { sellerId: req.user.id },
    include: { product: true, buyer: { select: { nome: true, telefone: true } } },
    orderBy: { createdAt: 'desc' }
  });

  res.json(orders);
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

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: req.body.status }
    });

    res.json({ message: 'Estado actualizado', order: updated });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao actualizar estado' });
  }
};

module.exports = {
  createOrder,
  getMyOrders,
  getReceivedOrders,
  updateOrderStatus
};
