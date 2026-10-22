import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import ProductFields from '../components/ProductFields';
import ProductCommercial from '../components/ProductCommercial';
import DeleteAction from '../components/DeleteAction';
import { buildProductPayload, canPublish, isStructuredProduct, productFormValues } from '../utils/commercial';
import api from '../services/api';

function MeusProdutos() {
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editError, setEditError] = useState('');
  const [revision, setRevision] = useState(0);
  const user = JSON.parse(localStorage.getItem('user'));
  const allowed = Boolean(localStorage.getItem('token')) && canPublish(user);

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    api.get('/products/my-products')
      .then(({ data }) => { if (active) setProducts(data); })
      .catch((failure) => { if (active) setError(failure.response?.data?.message || 'Erro ao carregar os produtos.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [allowed, revision]);

  const refresh = () => { setLoading(true); setError(''); setRevision((value) => value + 1); };
  const apagarProduto = async (id) => {
    if (!confirm('Tens certeza que queres apagar este produto?')) return;
    try {
      await api.delete(`/products/${id}`);
      refresh();
    } catch (failure) {
      setError(failure.response?.data?.message || 'Erro ao apagar produto.');
    }
  };
  const iniciarEdicao = (product) => {
    setEditError('');
    setEditing({ id: product.id, legacy: !isStructuredProduct(product), originalQuantity: product.quantidadeDisponivel, form: productFormValues(product) });
  };
  const handleChange = (event) => setEditing({ ...editing, form: { ...editing.form, [event.target.name]: event.target.value } });
  const salvarEdicao = async (event) => {
    event.preventDefault();
    setEditError('');
    try {
      const payload = buildProductPayload(editing.form, { allowEmptyCommercial: editing.legacy });
      if (!editing.legacy) payload.quantidadeDisponivelEsperada = editing.originalQuantity;
      setSaving(true);
      await api.put(`/products/${editing.id}`, payload);
      setEditing(null);
      refresh();
    } catch (failure) {
      setEditError(failure.response?.data?.message || failure.message || 'Erro ao guardar produto.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="container">
        <h2>Meus produtos</h2>
        {!allowed ? <p className="commercial-notice">Precisas de uma conta de vendedor para publicar produtos.</p> : (
          <>
            {error && <p className="form-error" role="alert">{error}</p>}
            {loading ? <p>A carregar produtos...</p> : products.length === 0 ? <p>Ainda não publicaste produtos.</p> : (
              <div className="products-grid">
                {products.map((product) => (
                  <div className="card" key={product.id}>
                    <h3>{product.nome}</h3>
                    <p>{product.descricao}</p>
                    <ProductCommercial product={product} />
                    <p><strong>Categoria:</strong> {product.categoria}</p>
                    <p><strong>Localização:</strong> {product.localizacao}</p>
                    <button onClick={() => iniciarEdicao(product)}>Editar</button>
                    <DeleteAction onDelete={() => apagarProduto(product.id)} reason={product._count?.orders > 0 ? 'Remoção bloqueada para preservar as encomendas associadas.' : ''} />
                  </div>
                ))}
              </div>
            )}
            {editing && (
              <div className="modal-bg">
                <div className="card modal-card commercial-form-card" role="dialog" aria-modal="true" aria-labelledby="edit-product-title">
                  <h3 id="edit-product-title">Editar produto</h3>
                  {editing.legacy && (
                    <p className="commercial-notice">Produto antigo: confirma manualmente quantidade, unidade e preço em MT.
                      Não preenchemos estes valores a partir do texto antigo. Para editar só a descrição ou outros dados, deixa os três campos comerciais vazios.</p>
                  )}
                  <form onSubmit={salvarEdicao} className="commercial-form">
                    <ProductFields form={editing.form} onChange={handleChange} commercialRequired={!editing.legacy} />
                    {editError && <p className="form-error" role="alert">{editError}</p>}
                    <button type="submit" disabled={saving}>{saving ? 'A guardar...' : 'Guardar alterações'}</button>
                    <button type="button" onClick={() => setEditing(null)} disabled={saving}>Cancelar</button>
                  </form>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}

export default MeusProdutos;
