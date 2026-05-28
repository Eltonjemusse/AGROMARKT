import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import api from '../services/api';

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

  const carregarDados = async () => {
    try {
      const statsResponse = await api.get('/admin/stats');
      setStats(statsResponse.data);

      const usersResponse = await api.get('/admin/users');
      setUsers(usersResponse.data);

      const productsResponse = await api.get('/admin/products');
      setProducts(productsResponse.data);
    } catch (error) {
      console.log(error);
      alert(error.response?.data?.message || 'Erro ao carregar área admin');
    } finally {
      setLoading(false);
    }
  };

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
    carregarDados();
  }, []);

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
                              <button
                                className="danger-btn"
                                onClick={() => apagarUtilizador(item.id)}
                                disabled={item.id === user.id}
                              >
                                Apagar
                              </button>
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
                            <td>{product.preco} MT</td>
                            <td>{product.categoria}</td>
                            <td>{product.localizacao}</td>
                            <td>{product.user?.nome}</td>
                            <td>
                              <button
                                className="danger-btn"
                                onClick={() => apagarProduto(product.id)}
                              >
                                Apagar
                              </button>
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