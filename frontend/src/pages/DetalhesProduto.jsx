import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../services/api';

function DetalhesProduto() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [quantidade, setQuantidade] = useState('');
  const [loading, setLoading] = useState(true);
  const [orderLoading, setOrderLoading] = useState(false);

  const carregarProduto = async () => {
    try {
      const response = await api.get(`/products/${id}`);
      setProduct(response.data);
    } catch (error) {
      console.log(error);
      alert('Erro ao carregar produto');
    } finally {
      setLoading(false);
    }
  };

  const fazerPedido = async (e) => {
    e.preventDefault();

    const token = localStorage.getItem('token');

    if (!token) {
      alert('Precisas fazer login para fazer encomenda');
      navigate('/login');
      return;
    }

    if (!quantidade) {
      alert('Informe a quantidade');
      return;
    }

    setOrderLoading(true);

    try {
      await api.post('/orders', {
        productId: Number(id),
        quantidade
      });

      alert('Pedido feito com sucesso!');
      navigate('/dashboard');

    } catch (error) {
      console.log('ERRO PEDIDO:', error);
      alert(error.response?.data?.message || 'Erro ao fazer pedido');
    } finally {
      setOrderLoading(false);
    }
  };

  useEffect(() => {
    carregarProduto();
  }, [id]);

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="container">
          <p>A carregar produto...</p>
        </div>
      </>
    );
  }

  if (!product) {
    return (
      <>
        <Navbar />
        <div className="container">
          <p>Produto não encontrado.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <div className="container">
        <div className="card product-details">
          <h2>{product.nome}</h2>

          {product.imagem && (
            <img
              src={product.imagem}
              alt={product.nome}
              className="product-image"
            />
          )}

          <p>{product.descricao}</p>

          <p><strong>Preço:</strong> {product.preco} MT</p>
          <p><strong>Quantidade disponível:</strong> {product.quantidade}</p>
          <p><strong>Categoria:</strong> {product.categoria}</p>
          <p><strong>Localização:</strong> {product.localizacao}</p>

          {product.user && (
            <div className="seller-box">
              <h3>Dados do vendedor</h3>
              <p><strong>Nome:</strong> {product.user.nome}</p>
              <p><strong>Email:</strong> {product.user.email}</p>
              <p><strong>Telefone:</strong> {product.user.telefone}</p>
            </div>
          )}

          <hr />

          <h3>Fazer encomenda</h3>

          <form onSubmit={fazerPedido}>
            <input
              type="number"
              placeholder="Quantidade desejada"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              required
            />

            <button type="submit" disabled={orderLoading}>
              {orderLoading ? 'A enviar pedido...' : 'Fazer Pedido'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

export default DetalhesProduto;