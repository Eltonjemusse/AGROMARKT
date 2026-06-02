#**AgroMarkt**

Sistema web para compra e venda de produtos agrícolas.

O AgroMarkt é uma plataforma digital que conecta agricultores, vendedores e compradores, permitindo a comercialização de produtos agrícolas de forma simples, rápida e segura.

A plataforma possibilita que vendedores publiquem produtos, compradores realizem encomendas e administradores façam a gestão completa do sistema.

 Tecnologias Utilizadas

## Frontend

* React.js
* Vite
* React Router DOM
* Axios
* CSS

## Backend

* Node.js
* Express.js
* Prisma ORM
* JWT Authentication
* Bcrypt

## Banco de Dados

* SQLite

#  Funcionalidades

✅ Cadastro de utilizadores

✅ Login com autenticação JWT

✅ Diferentes tipos de conta:

* Comprador
* Vendedor
* Administrador

✅ Publicação de produtos agrícolas

✅ Atualização e remoção de produtos

✅ Pesquisa e filtro por categoria

✅ Visualização de detalhes dos produtos

✅ Realização de encomendas

✅ Dashboard do utilizador

✅ Gestão de produtos do vendedor

✅ Painel administrativo

✅ Gestão de utilizadores

✅ Gestão de produtos

✅ Interface responsiva

# 📂 Estrutura do Projeto

```bash
AgroMarket/
│
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   │
│   └── src/
│       ├── config/
│       ├── controllers/
│       ├── middlewares/
│       ├── routes/
│       └── server.js
│
├── frontend/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── services/
│       └── App.jsx
│
└── README.md
```

# ⚙️ Instalação Local

## 1. Clonar o repositório

```bash
git clone https://github.com/eltonjemusse/agromarkt.git
```

---

## 2. Entrar na pasta do projeto

```bash
cd AgroMarket
```

---

# 🔧 Configuração do Backend

## Entrar na pasta backend

```bash
cd backend
```

## Instalar dependências

```bash
npm install
```

## Criar arquivo .env

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="SUA_CHAVE_SECRETA"
PORT=5000
```

## Executar migrações

```bash
npx prisma migrate deploy
```

## Iniciar backend

```bash
npm run dev
```

ou

```bash
npm start
```

---

# 🎨 Configuração do Frontend

## Entrar na pasta frontend

```bash
cd frontend
```

## Instalar dependências

```bash
npm install
```

## Iniciar frontend

```bash
npm run dev
```

---

# Segurança

O sistema utiliza:

* JWT Authentication
* Criptografia de senhas com bcrypt
* Rotas protegidas
* Controle de acesso por perfil
* Validação de autenticação para áreas restritas

---

# Responsividade

O sistema adapta-se a:

* Smartphones
* Tablets
* Computadores

---

# 👨‍💻 Autor

Elton Raimundo Jemusse

---

# 📄 Licença

Este projeto foi desenvolvido para fins académicos e de aprendizagem.

│       ├── config/
│       ├── controllers/
│       ├── middlewares/
│       ├── routes/
│       └── server.js
│
└── README.md
