import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ClipboardList,
  Settings,
  BarChart3,
  Store
} from 'lucide-react';

import Navbar from '../components/Navbar';
import api from '../services/api';

function Dashboard() {
  const user = JSON.parse(localStorage.getItem('user'));

  const [myOrders, setMyOrders] = useState([]);
  const [receivedOrders, setReceivedOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const carregarDados = async () => {
    try {
      const myOrdersResponse = await api.get('/orders/my');
      setMyOrders(myOrdersResponse.data);

      const receivedOrdersResponse = await api.get('/orders/received');
      setReceivedOrders(receivedOrdersResponse.data);
    } catch (error) {
      console.log('ERRO DASHBOARD:', error);
    } finally {
      setLoading(false);
    }
  };

  const atualizarEstado = async (orderId, status) => {
    try {
      await api.put(`/orders/${orderId}/status`, { status });
      alert('Estado actualizado com sucesso!');
      carregarDados();
    } catch (error) {
      console.log(error);
      alert(error.response?.data?.message || 'Erro ao actualizar estado');
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  if (!user) {
    return (
      <>
        <Navbar />
        <div className="dashboard-page">
          <div className="dashboard-container">
            <div className="dash-card">
              <h2>Acesso negado</h2>
              <p>Precisas fazer login para aceder ao dashboard.</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <main className="dashboard-page">
        <div className="dashboard-container">
          <section className="dashboard-title">
            <div className="title-icon">
              <LayoutDashboard size={22} />
            </div>

            <div>
              <h1>Dashboard</h1>
              <p>Bem-vindo de volta, acompanhe suas atividades agrícolas em tempo real.</p>
            </div>
          </section>

          <section className="dashboard-top-grid">
            <div className="dash-card user-card">
              <div className="avatar-box">
                <img
                  src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=300&q=80"
                  alt="Avatar"
                />
              </div>

              <div className="user-info">
                <span className="verified-badge">
                  {user.tipo === 'admin'
                    ? 'Administrador'
                    : user.tipo === 'vendedor'
                    ? 'Vendedor Verificado'
                    : 'Comprador Verificado'}
                </span>

                <h2>Dados do utilizador</h2>

                <div className="user-details-grid">
                  <div>
                    <span>Nome completo</span>
                    <strong>{user.nome}</strong>
                  </div>

                  <div>
                    <span>Email corporativo</span>
                    <strong>{user.email}</strong>
                  </div>

                  <div>
                    <span>Telefone</span>
                    <strong>{user.telefone || 'Não informado'}</strong>
                  </div>

                  <div>
                    <span>Tipo de conta</span>
                    <strong>{user.tipo}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="summary-card">
              <h2>Resumo</h2>

              <div className="summary-item">
                <span>Pedidos feitos</span>
                <strong>{myOrders.length}</strong>
              </div>

              <div className="summary-item">
                <span>Pedidos recebidos</span>
                <strong>{receivedOrders.length}</strong>
              </div>

              <p>Atualizado agora mesmo</p>

              <div className="leaf-shape"></div>
            </div>
          </section>

          {loading ? (
            <p className="loading-text">A carregar dados...</p>
          ) : (
            <section className="orders-dashboard-grid">
              <div>
                <div className="section-heading">
                  <h2>Meus pedidos</h2>
                  <Link to="/produtos">Ver todos</Link>
                </div>

                {myOrders.length === 0 ? (
                  <div className="empty-box">
                    <div className="empty-icon">
                      <ShoppingCart size={28} />
                    </div>

                    <h3>Ainda não fizeste nenhum pedido.</h3>
                    <p>Seus pedidos realizados aparecerão listados aqui.</p>
                  </div>
                ) : (
                  <div className="orders-column">
                    {myOrders.map((order) => (
                      <div className="order-card" key={order.id}>
                        <h3>{order.product?.nome}</h3>
                        <p><strong>Quantidade:</strong> {order.quantidade}</p>
                        <p><strong>Total:</strong> {order.total} MT</p>
                        <p><strong>Estado:</strong> {order.status}</p>

                        {order.seller && (
                          <>
                            <p><strong>Vendedor:</strong> {order.seller.nome}</p>
                            <p><strong>Contacto:</strong> {order.seller.telefone}</p>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="section-heading">
                  <h2>Pedidos recebidos</h2>
                  <Link to="/meus-produtos">Gerenciar estoque</Link>
                </div>

                {receivedOrders.length === 0 ? (
                  <div className="empty-box">
                    <div className="empty-icon">
                      <Package size={28} />
                    </div>

                    <h3>Ainda não recebeste pedidos.</h3>
                    <p>Novas encomendas de clientes serão notificadas nesta área.</p>
                  </div>
                ) : (
                  <div className="orders-column">
                    {receivedOrders.map((order) => (
                      <div className="order-card" key={order.id}>
                        <h3>{order.product?.nome}</h3>
                        <p><strong>Quantidade:</strong> {order.quantidade}</p>
                        <p><strong>Total:</strong> {order.total} MT</p>
                        <p><strong>Estado:</strong> {order.status}</p>

                        {order.buyer && (
                          <>
                            <p><strong>Comprador:</strong> {order.buyer.nome}</p>
                            <p><strong>Contacto:</strong> {order.buyer.telefone}</p>
                          </>
                        )}

                        <select
                          value={order.status}
                          onChange={(e) => atualizarEstado(order.id, e.target.value)}
                        >
                          <option value="pendente">Pendente</option>
                          <option value="aceite">Aceite</option>
                          <option value="rejeitado">Rejeitado</option>
                          <option value="entregue">Entregue</option>
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="quick-actions">
            <Link to="/novo-produto" className="quick-card">
              <span className="quick-icon green">
                <Store size={22} />
              </span>
              <p>Novo Produto</p>
            </Link>

            <Link to="/meus-produtos" className="quick-card">
              <span className="quick-icon light-green">
                <ClipboardList size={22} />
              </span>
              <p>Minha Lista</p>
            </Link>

            <Link to="/dashboard" className="quick-card">
              <span className="quick-icon red">
                <BarChart3 size={22} />
              </span>
              <p>Relatórios</p>
            </Link>

            <Link to="/dashboard" className="quick-card">
              <span className="quick-icon teal">
                <Settings size={22} />
              </span>
              <p>Configurações</p>
            </Link>
          </section>
        </div>
      </main>

      <footer className="dashboard-footer">
        <div className="dashboard-footer-grid">
          <div>
            <h2>Agromarkt</h2>
            <p>
              Conectando o campo ao mercado de forma sustentável e transparente.
              O futuro da agricultura é digital.
            </p>
          </div>

          <div>
            <h3>Links rápidos</h3>
            <Link to="/">Sobre nós</Link>
            <Link to="/">Política de Privacidade</Link>
            <Link to="/">Termos de Uso</Link>
            <Link to="/">Contato</Link>
          </div>

          <div>
            <p>© 2026 Agromarkt. Conectando o campo ao mercado.</p>
            <p>Desenvolvido por Elton Raimundo Jemusse.</p>
          </div>
        </div>
      </footer>
    </>
  );
}

export default Dashboard;