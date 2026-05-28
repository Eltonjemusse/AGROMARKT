const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const register = async (req, res) => {
  try {
    const {
      nome,
      email,
      senha,
      telefone,
      tipo
    } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({
        message: 'Nome, email e senha são obrigatórios'
      });
    }

    const userExists = await prisma.user.findUnique({
      where: { email }
    });

    if (userExists) {
      return res.status(400).json({
        message: 'Email já cadastrado'
      });
    }

    const hashedPassword = await bcrypt.hash(senha, 10);

    const user = await prisma.user.create({
      data: {
        nome,
        email,
        senha: hashedPassword,
        telefone: telefone || '',
        tipo: tipo || 'comprador'
      }
    });

    const userWithoutPassword = {
      id: user.id,
      nome: user.nome,
      email: user.email,
      telefone: user.telefone,
      tipo: user.tipo
    };

    return res.status(201).json({
      message: 'Utilizador criado com sucesso',
      user: userWithoutPassword
    });

  } catch (error) {
    console.log('ERRO NO REGISTER:', error);

    return res.status(500).json({
      message: 'Erro no servidor ao cadastrar'
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({
        message: 'Email e senha são obrigatórios'
      });
    }

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(400).json({
        message: 'Email ou senha inválidos'
      });
    }

    const validPassword = await bcrypt.compare(senha, user.senha);

    if (!validPassword) {
      return res.status(400).json({
        message: 'Email ou senha inválidos'
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        tipo: user.tipo
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '7d'
      }
    );

    const userWithoutPassword = {
      id: user.id,
      nome: user.nome,
      email: user.email,
      telefone: user.telefone,
      tipo: user.tipo
    };

    return res.status(200).json({
      message: 'Login realizado com sucesso',
      token,
      user: userWithoutPassword
    });

  } catch (error) {
    console.log('ERRO NO LOGIN:', error);

    return res.status(500).json({
      message: 'Erro no servidor ao fazer login'
    });
  }
};

module.exports = {
  register,
  login
};