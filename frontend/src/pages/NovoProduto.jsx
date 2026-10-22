import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ProductFields from '../components/ProductFields';
import { buildProductPayload, canPublish, productFormValues } from '../utils/commercial';
import api from '../services/api';

function NovoProduto() {
  const navigate = useNavigate();
  const [form, setForm] = useState(() => productFormValues());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const user = JSON.parse(localStorage.getItem('user'));
  const allowed = Boolean(localStorage.getItem('token')) && canPublish(user);

  const handleChange = (event) => setForm({ ...form, [event.target.name]: event.target.value });
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!allowed) return;
    setError('');
    try {
      const payload = buildProductPayload(form);
      setLoading(true);
      await api.post('/products', payload);
      navigate('/meus-produtos');
    } catch (failure) {
      setError(failure.response?.data?.message || failure.message || 'Não foi possível publicar o produto.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="container">
        <div className="card commercial-form-card">
          <h2>Publicar produto</h2>
          {!allowed ? (
            <p className="commercial-notice">A publicação está disponível para vendedores e administradores.
              {user ? ' Precisas de passar para vendedor para publicar.' : <> <Link to="/login">Iniciar sessão</Link></>}
            </p>
          ) : (
            <>
              <p>Vendedor: <strong>{user.nome}</strong></p>
              <form onSubmit={handleSubmit} className="commercial-form">
                <ProductFields form={form} onChange={handleChange} />
                {error && <p className="form-error" role="alert">{error}</p>}
                <button type="submit" disabled={loading}>{loading ? 'A publicar...' : 'Publicar produto'}</button>
              </form>
            </>
          )}
        </div>
      </main>
    </>
  );
}

export default NovoProduto;