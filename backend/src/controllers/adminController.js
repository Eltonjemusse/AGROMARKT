const prisma = require('../config/prisma');
const { positiveId } = require('../utils/validation');
const { serializeProduct } = require('../utils/structuredCommerce');
const { removeProduct, removeUser } = require('../utils/historyProtection');

const getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        tipo: true,
        createdAt: true,
        _count: { select: { pedidosFeitos: true, pedidosRecebidos: true } }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(users);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Erro ao buscar utilizadores' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const userId = positiveId(req.params.id);
    if (!Number.isFinite(userId)) return res.status(400).json({ message: 'Identificador de utilizador inválido' });

    if (userId === req.user.id) {
      return res.status(400).json({
        message: 'Não podes apagar a tua própria conta admin'
      });
    }

    await removeUser(prisma, userId);

    res.json({ message: 'Utilizador apagado com sucesso' });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    console.log(error);
    res.status(500).json({ message: 'Erro ao apagar utilizador' });
  }
};

const getProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        _count: { select: { orders: true } },
        user: {
          select: {
            id: true,
            nome: true,
            email: true,
            telefone: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(products.map(serializeProduct));
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Erro ao buscar produtos' });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const productId = positiveId(req.params.id);
    if (!Number.isFinite(productId)) return res.status(400).json({ message: 'Identificador de produto inválido' });

    await removeProduct(prisma, productId, req.user);

    res.json({ message: 'Produto apagado com sucesso' });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    console.log(error);
    res.status(500).json({ message: 'Erro ao apagar produto' });
  }
};

const getStats = async (req, res) => {
  try {
    const users = await prisma.user.count();
    const products = await prisma.product.count();
    const orders = await prisma.order.count();

    res.json({
      users,
      products,
      orders
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Erro ao buscar estatísticas' });
  }
};

module.exports = {
  getUsers,
  deleteUser,
  getProducts,
  deleteProduct,
  getStats
};
