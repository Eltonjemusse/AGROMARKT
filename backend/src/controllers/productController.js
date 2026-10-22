const prisma = require('../config/prisma');
const { isObjectBody, positiveNumber, positiveId } = require('../utils/validation');

const createProduct = async (req, res) => {
  try {
    if (!['vendedor', 'admin'].includes(req.user?.tipo)) {
      return res.status(403).json({ message: 'Apenas vendedores e administradores podem publicar produtos' });
    }

    if (!isObjectBody(req.body)) {
      return res.status(400).json({ message: 'Dados de produto inválidos' });
    }

    const { nome, descricao, preco, quantidade, categoria, imagem, localizacao } = req.body;
    if ([nome, descricao, quantidade, categoria, localizacao].some((value) => typeof value !== 'string' || !value.trim())) {
      return res.status(400).json({ message: 'Os campos obrigatórios do produto devem ser texto não vazio' });
    }

    const price = positiveNumber(preco);
    if (!Number.isFinite(price)) {
      return res.status(400).json({ message: 'O preço deve ser um número finito e positivo' });
    }
    if (imagem !== undefined && imagem !== null && typeof imagem !== 'string') {
      return res.status(400).json({ message: 'A imagem deve ser um URL em texto' });
    }

    const product = await prisma.product.create({
      data: {
        nome,
        descricao,
        preco: price,
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
  const id = positiveId(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'Identificador de produto inválido' });
  const product = await prisma.product.findUnique({
    where: { id },
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
    const id = positiveId(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Identificador de produto inválido' });
    const product = await prisma.product.findUnique({
      where: { id }
    });

    if (!product) {
      return res.status(404).json({ message: 'Produto não encontrado' });
    }

    if (product.userId !== req.user.id && req.user.tipo !== 'admin') {
      return res.status(403).json({ message: 'Sem permissão' });
    }

    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ message: 'Dados de produto inválidos' });
    }

    const data = {};
    const editableFields = ['nome', 'descricao', 'quantidade', 'categoria', 'imagem', 'localizacao'];

    for (const field of editableFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        data[field] = req.body[field];
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'preco')) {
      const value = req.body.preco;
      const preco = (typeof value === 'number' || (typeof value === 'string' && value.trim()))
        ? Number(value)
        : NaN;

      if (!Number.isFinite(preco) || preco <= 0) {
        return res.status(400).json({ message: 'O preço deve ser um número finito e positivo' });
      }

      data.preco = preco;
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data
    });

    res.json({ message: 'Produto actualizado com sucesso', product: updatedProduct });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao actualizar produto' });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const id = positiveId(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Identificador de produto inválido' });
    const product = await prisma.product.findUnique({
      where: { id }
    });

    if (!product) {
      return res.status(404).json({ message: 'Produto não encontrado' });
    }

    if (product.userId !== req.user.id && req.user.tipo !== 'admin') {
      return res.status(403).json({ message: 'Sem permissão' });
    }

    await prisma.product.delete({
      where: { id }
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
