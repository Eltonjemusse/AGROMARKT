# AGROMARKT

AGROMARKT é uma plataforma web para compra e venda de produtos agrícolas.  
O sistema permite que vendedores/agricultores publiquem produtos, compradores façam encomendas e administradores façam a gestão da plataforma.

## Tecnologias usadas

### Frontend
- React
- Vite
- React Router DOM
- Axios
- CSS

### Backend
- Node.js
- Express
- Prisma ORM
- SQLite
- JWT
- Bcrypt

## Funcionalidades

- Cadastro de utilizadores
- Login com autenticação JWT
- Diferentes tipos de conta: comprador, vendedor e admin
- Cadastro de produtos
- Listagem de produtos
- Pesquisa e filtro por categoria
- Detalhes do produto
- Encomendas/pedidos
- Dashboard do utilizador
- Gestão de produtos do vendedor
- Painel administrativo
- Gestão de utilizadores e produtos pelo admin

## Estrutura do projecto

```txt
AGROMARKT/
│
├── frontend/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── services/
│       └── App.jsx
│
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   └── src/
│       ├── config/
│       ├── controllers/
│       ├── middlewares/
│       ├── routes/
│       └── server.js
│
└── README.md