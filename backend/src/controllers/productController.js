const prisma = require('../config/prisma');
const { isObjectBody, positiveNumber, positiveId } = require('../utils/validation');
const { prepareStructuredProduct, serializeProduct, isStructuredProduct } = require('../utils/structuredCommerce');
const { validateQuantity } = require('../utils/commercialDecimals');
const { removeProduct } = require('../utils/historyProtection');

const createProduct = async (req, res) => {
  try {
    if (!['vendedor', 'admin'].includes(req.user?.tipo)) {
      return res.status(403).json({ message: 'Apenas vendedores e administradores podem publicar produtos' });
    }

    if (!isObjectBody(req.body)) {
      return res.status(400).json({ message: 'Dados de produto inválidos' });
    }

    const { nome, descricao, preco, quantidade, categoria, imagem, localizacao } = req.body;
    if ([nome, descricao, categoria, localizacao].some((value) => typeof value !== 'string' || !value.trim())) {
      return res.status(400).json({ message: 'Os campos obrigatórios do produto devem ser texto não vazio' });
    }

    const structured = prepareStructuredProduct(req.body);
    const price = structured ? structured.preco : positiveNumber(preco);
    if (!structured && (typeof quantidade !== 'string' || !quantidade.trim())) {
      return res.status(400).json({ message: 'Quantidade legada deve ser texto não vazio' });
    }
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
        userId: req.user.id,
        ...structured
      }
    });

    res.status(201).json({ message: 'Produto criado com sucesso', product: serializeProduct(product) });
  } catch (error) {
    if (error instanceof TypeError || error instanceof RangeError) return res.status(400).json({ message: error.message });
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

  res.json(products.map(serializeProduct));
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

  res.json(serializeProduct(product));
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
    const structured = prepareStructuredProduct(req.body, product);
    if (Object.prototype.hasOwnProperty.call(req.body, 'quantidadeDisponivelEsperada')) {
      const expected = validateQuantity(req.body.quantidadeDisponivelEsperada, product.unidade, { allowZero: true });
      const current = validateQuantity(product.quantidadeDisponivel?.toString(), product.unidade, { allowZero: true });
      if (expected !== current) return res.status(409).json({ message: 'A disponibilidade mudou. Reabre a edição para rever os valores atuais.' });
    }
    const editableFields = ['nome', 'descricao', 'quantidade', 'categoria', 'imagem', 'localizacao'];

    for (const field of editableFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        if (field !== 'imagem' && (typeof req.body[field] !== 'string' || !req.body[field].trim())) {
          return res.status(400).json({ message: 'Campos do produto devem ser texto não vazio' });
        }
        if (field === 'imagem' && req.body[field] !== null && typeof req.body[field] !== 'string') {
          return res.status(400).json({ message: 'Imagem deve ser texto ou nula' });
        }
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

    Object.assign(data, structured);
    // Legacy echoes are compatibility checks, not commercial writes. A stock
    // acceptance may update these projections after the read above.
    if (isStructuredProduct(product) && !structured) {
      delete data.quantidade;
      delete data.preco;
    }

    let updatedProduct;
    if (structured && isStructuredProduct(product)) {
      // Do not overwrite a concurrent stock debit with the pre-read quantity/unit.
      const result = await prisma.product.updateMany({
        where: { id, quantidadeDisponivel: product.quantidadeDisponivel, unidade: product.unidade }, data
      });
      if (result.count !== 1) return res.status(409).json({ message: 'A disponibilidade mudou. Reabre a edição para rever os valores atuais.' });
      updatedProduct = await prisma.product.findUnique({ where: { id } });
    } else {
      updatedProduct = await prisma.product.update({ where: { id }, data });
    }

    res.json({ message: 'Produto actualizado com sucesso', product: serializeProduct(updatedProduct) });
  } catch (error) {
    if (error instanceof TypeError || error instanceof RangeError) return res.status(400).json({ message: error.message });
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

    await removeProduct(prisma, id, req.user);

    res.json({ message: 'Produto apagado com sucesso' });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    res.status(500).json({ message: 'Erro ao apagar produto' });
  }
};
const getMyProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: { _count: { select: { orders: true } } },
      where: {
        userId: req.user.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(products.map(serializeProduct));
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
