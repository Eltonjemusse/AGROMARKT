import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Home from './pages/Home';
import Login from './pages/Login';
import Cadastro from './pages/Cadastro';
import Produtos from './pages/Produtos';
import DetalhesProduto from './pages/DetalhesProduto';
import Dashboard from './pages/Dashboard';
import NovoProduto from './pages/NovoProduto';
import MeusProdutos from './pages/MeusProdutos';
import Admin from './pages/Admin';
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Cadastro />} />
        <Route path="/produtos" element={<Produtos />} />
        <Route path="/produtos/:id" element={<DetalhesProduto />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/novo-produto" element={<NovoProduto />} />
        <Route path="/meus-produtos" element={<MeusProdutos />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;