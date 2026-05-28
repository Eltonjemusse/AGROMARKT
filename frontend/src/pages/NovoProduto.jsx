import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../services/api';

function NovoProduto() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    nome: '',
    descricao: '',
    preco: '',
    quantidade: '',
    categoria: '',
    imagem: '',
    localizacao: ''
  });

  const [loading, setLoading] = useState(false);

  const user = JSON.parse(localStorage.getItem('user'));

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const token = localStorage.getItem('token');

    if (!token) {
      alert('Precisas fazer login primeiro');
      navigate('/login');
      return;
    }

    setLoading(true);

    try {
      await api.post('/products', {
        nome: form.nome,
        descricao: form.descricao,
        preco: Number(form.preco),
        quantidade: form.quantidade,
        categoria: form.categoria,
        imagem: form.imagem,
        localizacao: form.localizacao
      });

      alert('Produto cadastrado com sucesso!');
      navigate('/produtos');

    } catch (error) {
      console.log('ERRO AO CADASTRAR PRODUTO:', error);

      alert(error.response?.data?.message || 'Erro ao cadastrar produto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />

      <div className="container">
        <div className="card" style={{ maxWidth: 600, margin: 'auto' }}>
          <h2>Cadastrar Produto</h2>

          {user && (
            <p>
              Vendedor: <strong>{user.nome}</strong>
            </p>
          )}

          <form onSubmit={handleSubmit}>
            <input
              name="nome"
              placeholder="Nome do produto"
              value={form.nome}
              onChange={handleChange}
              required
            />

            <textarea
              name="descricao"
              placeholder="Descrição do produto"
              value={form.descricao}
              onChange={handleChange}
              required
            />

            <input
              name="preco"
              type="number"
              placeholder="Preço"
              value={form.preco}
              onChange={handleChange}
              required
            />

            <input
              name="quantidade"
              placeholder="Quantidade. Ex: 100 kg"
              value={form.quantidade}
              onChange={handleChange}
              required
            />

            <select
              name="categoria"
              value={form.categoria}
              onChange={handleChange}
              required
            >
              <option value="">Selecione a categoria</option>
              <option value="Hortaliças">Hortaliças</option>
              <option value="Frutas">Frutas</option>
              <option value="Cereais">Cereais</option>
              <option value="Tubérculos">Tubérculos</option>
              <option value="Leguminosas">Leguminosas</option>
              <option value="Outros">Outros</option>
            </select>

            <input
              name="imagem"
              placeholder="URL da imagem opcional"
              value={form.imagem}
              onChange={handleChange}
            />

            <input
              name="localizacao"
              placeholder="Localização. Ex: Chókwè"
              value={form.localizacao}
              onChange={handleChange}
              required
            />

            <button type="submit" disabled={loading}>
              {loading ? 'A cadastrar...' : 'Cadastrar Produto'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

export default NovoProduto;