import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ProductCommercial from '../components/ProductCommercial';
import { buildOrderPayload, isStructuredProduct } from '../utils/commercial';
import api from '../services/api';

function DetalhesProduto() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [quantidade, setQuantidade] = useState('');
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState('');
  const user = JSON.parse(localStorage.getItem('user'));
  const loggedIn = Boolean(localStorage.getItem('token'));

  useEffect(() => {
    let active = true;
    api.get(`/products/${id}`)
      .then(({ data }) => { if (active) setResult({ id, product: data }); })
      .catch((failure) => { if (active) setResult({ id, error: failure.response?.data?.message || 'Erro ao carregar produto.' }); });
    return () => { active = false; };
  }, [id]);

  const product = result?.id === id ? result.product : null;
  const fazerPedido = async (event) => {
    event.preventDefault();
    setOrderError('');
    if (!loggedIn) { navigate('/login'); return; }
    try {
      const payload = buildOrderPayload(product, quantidade);
      setOrderLoading(true);
      await api.post('/orders', payload);
      navigate('/dashboard');
    } catch (failure) {
      setOrderError(failure.response?.data?.message || failure.message || 'Erro ao fazer encomenda.');
    } finally {
      setOrderLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="container">
        {result?.id !== id ? <p>A carregar produto...</p> : !product ? <p role="alert">{result.error}</p> : (
          <div className="card product-details">
            <h2>{product.nome}</h2>
            {product.imagem && <img src={product.imagem} alt={product.nome} className="product-image" />}
            <p>{product.descricao}</p>
            <ProductCommercial product={product} />
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
            {!isStructuredProduct(product) ? <p className="commercial-notice">Encomendas indisponíveis até o vendedor rever os dados deste produto.</p> :
              user && String(user.id) === String(product.userId) ? <p>Este produto é teu. Só podes encomendar produtos de outros vendedores.</p> :
              !loggedIn ? <p><Link to="/login">Inicia sessão</Link> para encomendar.</p> : (
                <form onSubmit={fazerPedido} className="commercial-form">
                  <label>
                    Quantidade desejada ({product.unidade})
                    <input type="text" inputMode={['kg', 'litro'].includes(product.unidade) ? 'decimal' : 'numeric'}
                      value={quantidade} onChange={(event) => setQuantidade(event.target.value)} required autoComplete="off" />
                  </label>
                  <p className="field-help">{['kg', 'litro'].includes(product.unidade) ? 'Podes indicar frações, por exemplo 0,5. Até seis casas decimais.' : 'Indica uma quantidade inteira.'} Sem separadores de milhares.</p>
                  {orderError && <p className="form-error" role="alert">{orderError}</p>}
                  <button type="submit" disabled={orderLoading}>{orderLoading ? 'A enviar...' : 'Enviar encomenda'}</button>
                </form>
              )}
          </div>
        )}
      </main>
    </>
  );
}

export default DetalhesProduto;