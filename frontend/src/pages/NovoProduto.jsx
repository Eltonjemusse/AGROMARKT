import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ProductFields from '../components/ProductFields';
import { buildProductPayload, canPublish, productFormValues } from '../utils/commercial';
import api from '../services/api';
import { useNotifications } from '../notifications/NotificationContext';
import { reportOperationError } from '../utils/operationFeedback';

function NovoProduto() {
  const notify = useNotifications();
  const navigate = useNavigate();
  const [form, setForm] = useState(() => productFormValues());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const user = JSON.parse(localStorage.getItem('user'));
  const allowed = Boolean(localStorage.getItem('token')) && canPublish(user);

  const handleChange = (event) => { setForm({ ...form, [event.target.name]: event.target.value }); setFieldErrors({}); };
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!allowed) return;
    setError('');
    setFieldErrors({});
    try {
      const payload = buildProductPayload(form);
      setLoading(true);
      await api.post('/products', payload);
      notify.success('Produto publicado com sucesso.');
      navigate('/meus-produtos');
    } catch (failure) {
      reportOperationError(failure, { notify, fallback: 'Não foi possível publicar o produto.', onFormError: setError,
        onFieldError: (field, message) => setFieldErrors({ [field]: message }) });
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
                <ProductFields form={form} onChange={handleChange} errors={fieldErrors} />
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
