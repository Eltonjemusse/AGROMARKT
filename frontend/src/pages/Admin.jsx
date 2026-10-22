import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import api from '../services/api';
import DeleteAction from '../components/DeleteAction';
import { formatDecimal, isStructuredProduct } from '../utils/commercial';

function Admin() {
  const user = JSON.parse(localStorage.getItem('user'));

  const [stats, setStats] = useState({
    users: 0,
    products: 0,
    orders: 0
  });

  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [tab, setTab] = useState('users');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const allowed = user?.tipo === 'admin';
  const carregarDados = () => { setLoading(true); setError(''); setRevision((value) => value + 1); };

  const apagarUtilizador = async (id) => {
    const confirmar = confirm('Tens certeza que queres apagar este utilizador?');

    if (!confirmar) return;

    try {
      await api.delete(`/admin/users/${id}`);
      alert('Utilizador apagado com sucesso!');
      carregarDados();
    } catch (error) {
      console.log(error);
      alert(error.response?.data?.message || 'Erro ao apagar utilizador');
    }
  };

  const apagarProduto = async (id) => {
    const confirmar = confirm('Tens certeza que queres apagar este produto?');

    if (!confirmar) return;

    try {
      await api.delete(`/admin/products/${id}`);
      alert('Produto apagado com sucesso!');
      carregarDados();
    } catch (error) {
      console.log(error);
      alert(error.response?.data?.message || 'Erro ao apagar produto');
    }
  };

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    Promise.all([api.get('/admin/stats'), api.get('/admin/users'), api.get('/admin/products')])
      .then(([statsResponse, usersResponse, productsResponse]) => {
        if (active) { setStats(statsResponse.data); setUsers(usersResponse.data); setProducts(productsResponse.data); }
      })
      .catch((failure) => { if (active) setError(failure.response?.data?.message || 'Erro ao carregar área admin'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [allowed, revision]);

  if (!user || user.tipo !== 'admin') {
    return (
      <>
        <Navbar />
        <div className="container">
          <div className="card">
            <h2>Acesso negado</h2>
            <p>Esta página é apenas para administradores.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <div className="container">
        <h2>Painel Administrativo</h2>
        {error && <p role="alert" className="form-error">{error}</p>}

        <div className="dashboard-grid">
          <div className="card">
            <h3>Utilizadores</h3>
            <p className="stat-number">{stats.users}</p>
          </div>

          <div className="card">
            <h3>Produtos</h3>
            <p className="stat-number">{stats.products}</p>
          </div>

          <div className="card">
            <h3>Pedidos</h3>
            <p className="stat-number">{stats.orders}</p>
          </div>
        </div>

        <div className="admin-tabs">
          <button
            className={tab === 'users' ? 'active-tab' : ''}
            onClick={() => setTab('users')}
          >
            Utilizadores
          </button>

          <button
            className={tab === 'products' ? 'active-tab' : ''}
            onClick={() => setTab('products')}
          >
            Produtos
          </button>
        </div>

        {loading ? (
          <p>A carregar...</p>
        ) : (
          <>
            {tab === 'users' && (
              <section className="section">
                <h3>Utilizadores cadastrados</h3>

                {users.length === 0 ? (
                  <p>Nenhum utilizador encontrado.</p>
                ) : (
                  <div className="table-card">
                    <table>
                      <thead>
                        <tr>
                          <th>Nome</th>
                          <th>Email</th>
                          <th>Telefone</th>
                          <th>Tipo</th>
                          <th>Ação</th>
                        </tr>
                      </thead>

                      <tbody>
                        {users.map((item) => (
                          <tr key={item.id}>
                            <td>{item.nome}</td>
                            <td>{item.email}</td>
                            <td>{item.telefone}</td>
                            <td>{item.tipo}</td>
                            <td>
                              <DeleteAction onDelete={() => apagarUtilizador(item.id)} reason={item.id === user.id ? 'Não podes apagar a tua conta admin.' :
                                (item._count?.pedidosFeitos > 0 || item._count?.pedidosRecebidos > 0) ? 'Remoção bloqueada: preservar compras e vendas existentes.' : ''} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {tab === 'products' && (
              <section className="section">
                <h3>Produtos cadastrados</h3>

                {products.length === 0 ? (
                  <p>Nenhum produto encontrado.</p>
                ) : (
                  <div className="table-card">
                    <table>
                      <thead>
                        <tr>
                          <th>Produto</th>
                          <th>Preço</th>
                          <th>Categoria</th>
                          <th>Localização</th>
                          <th>Vendedor</th>
                          <th>Ação</th>
                        </tr>
                      </thead>

                      <tbody>
                        {products.map((product) => (
                          <tr key={product.id}>
                            <td>{product.nome}</td>
                            <td>{isStructuredProduct(product) ? `${formatDecimal(product.precoUnitario, 2)} MT / ${product.unidade}` : 'Preço/unidade por rever'}</td>
                            <td>{product.categoria}</td>
                            <td>{product.localizacao}</td>
                            <td>{product.user?.nome}</td>
                            <td>
                              <DeleteAction onDelete={() => apagarProduto(product.id)} reason={product._count?.orders > 0 ? 'Remoção bloqueada: preservar encomendas associadas.' : ''} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}

export default Admin;
