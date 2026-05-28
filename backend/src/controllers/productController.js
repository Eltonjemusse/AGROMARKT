const prisma = require('../config/prisma');

const createProduct = async (req, res) => {
  try {
    const { nome, descricao, preco, quantidade, categoria, imagem, localizacao } = req.body;

    const product = await prisma.product.create({
      data: {
        nome,
        descricao,
        preco: Number(preco),
        quantidade,
        categoria,
        imagem,
        localizacao,
        userId: req.user.id
      }
    });

    res.status(201).json({ message: 'Produto criado com sucesso', product });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao criar produto' });
  }
};

const getProducts = async (req, res) => {
  const products = await prisma.product.findMany({
    include: {
      user: {
        select: { id: true, nome: true, telefone: true, email: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  res.json(products);
};

const getProductById = async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      user: {
        select: { id: true, nome: true, telefone: true, email: true }
      }
    }
  });

  if (!product) {
    return res.status(404).json({ message: 'Produto não encontrado' });
  }

  res.json(product);
};

const updateProduct = async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: Number(req.params.id) }
    });

    if (!product) {
      return res.status(404).json({ message: 'Produto não encontrado' });
    }

    if (product.userId !== req.user.id && req.user.tipo !== 'admin') {
      return res.status(403).json({ message: 'Sem permissão' });
    }

    const updatedProduct = await prisma.product.update({
      where: { id: Number(req.params.id) },
      data: {
        ...req.body,
        preco: req.body.preco ? Number(req.body.preco) : product.preco
      }
    });

    res.json({ message: 'Produto actualizado com sucesso', product: updatedProduct });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao actualizar produto' });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: Number(req.params.id) }
    });

    if (!product) {
      return res.status(404).json({ message: 'Produto não encontrado' });
    }

    if (product.userId !== req.user.id && req.user.tipo !== 'admin') {
      return res.status(403).json({ message: 'Sem permissão' });
    }

    await prisma.product.delete({
      where: { id: Number(req.params.id) }
    });

    res.json({ message: 'Produto apagado com sucesso' });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao apagar produto' });
  }
};
const getMyProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        userId: req.user.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(products);
  } catch (error) {
    console.log('ERRO AO BUSCAR MEUS PRODUTOS:', error);
    res.status(500).json({
      message: 'Erro ao buscar meus produtos'
    });
  }
};

module.exports = {
  createProduct,
  getProducts,
  getMyProducts,
  getProductById,
  updateProduct,
  deleteProduct
};