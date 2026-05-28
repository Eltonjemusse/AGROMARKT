const prisma = require('../config/prisma');

const getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        tipo: true,
        createdAt: true
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
    const userId = Number(req.params.id);

    if (userId === req.user.id) {
      return res.status(400).json({
        message: 'Não podes apagar a tua própria conta admin'
      });
    }

    await prisma.order.deleteMany({
      where: {
        OR: [
          { buyerId: userId },
          { sellerId: userId }
        ]
      }
    });

    await prisma.product.deleteMany({
      where: {
        userId
      }
    });

    await prisma.user.delete({
      where: {
        id: userId
      }
    });

    res.json({ message: 'Utilizador apagado com sucesso' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Erro ao apagar utilizador' });
  }
};

const getProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: {
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

    res.json(products);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Erro ao buscar produtos' });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const productId = Number(req.params.id);

    await prisma.order.deleteMany({
      where: {
        productId
      }
    });

    await prisma.product.delete({
      where: {
        id: productId
      }
    });

    res.json({ message: 'Produto apagado com sucesso' });
  } catch (error) {
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