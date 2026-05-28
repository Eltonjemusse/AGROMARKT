const prisma = require('../config/prisma');

const createOrder = async (req, res) => {
  try {
    const { productId, quantidade } = req.body;

    const product = await prisma.product.findUnique({
      where: { id: Number(productId) }
    });

    if (!product) {
      return res.status(404).json({ message: 'Produto não encontrado' });
    }

    if (product.userId === req.user.id) {
      return res.status(400).json({ message: 'Não podes encomendar o teu próprio produto' });
    }

    const total = product.preco * Number(quantidade);

    const order = await prisma.order.create({
      data: {
        productId: product.id,
        buyerId: req.user.id,
        sellerId: product.userId,
        quantidade: String(quantidade),
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
  const { status } = req.body;

  const order = await prisma.order.findUnique({
    where: { id: Number(req.params.id) }
  });

  if (!order) return res.status(404).json({ message: 'Pedido não encontrado' });

  if (order.sellerId !== req.user.id && req.user.tipo !== 'admin') {
    return res.status(403).json({ message: 'Sem permissão' });
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { status }
  });

  res.json({ message: 'Estado actualizado', order: updated });
};

module.exports = {
  createOrder,
  getMyOrders,
  getReceivedOrders,
  updateOrderStatus
};