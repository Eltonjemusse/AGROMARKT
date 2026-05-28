import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Navbar from '../components/Navbar';

function Cadastro() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    nome: '',
    email: '',
    senha: '',
    telefone: '',
    tipo: 'comprador'
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);

    try {
      const response = await api.post('/auth/register', {
        nome: form.nome,
        email: form.email,
        senha: form.senha,
        telefone: form.telefone,
        tipo: form.tipo
      });

      console.log('CADASTRO RESPONSE:', response.data);

      alert('Conta criada com sucesso!');
      navigate('/login');

    } catch (error) {
      console.log('ERRO CADASTRO:', error);

      if (error.response) {
        alert(error.response.data.message || 'Erro ao cadastrar');
      } else {
        alert('Não foi possível conectar ao servidor');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />

      <div className="container">
        <div className="card" style={{ maxWidth: 450, margin: 'auto' }}>
          <h2>Criar Conta</h2>

          <form onSubmit={handleSubmit}>
            <input
              name="nome"
              placeholder="Nome"
              value={form.nome}
              onChange={handleChange}
              required
            />

            <input
              name="email"
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={handleChange}
              required
            />

            <input
              name="senha"
              type="password"
              placeholder="Senha"
              value={form.senha}
              onChange={handleChange}
              required
            />

            <input
              name="telefone"
              placeholder="Telefone"
              value={form.telefone}
              onChange={handleChange}
            />

            <select
              name="tipo"
              value={form.tipo}
              onChange={handleChange}
            >
              <option value="comprador">Comprador</option>
              <option value="vendedor">Vendedor</option>
            </select>

            <button type="submit" disabled={loading}>
              {loading ? 'A cadastrar...' : 'Cadastrar'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

export default Cadastro;