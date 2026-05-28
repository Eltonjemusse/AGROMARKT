import { useEffect, useState } from 'react';
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
      await api.put(`/orders/${orderId}/status`, {
        status
      });

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
        <div className="container">
          <div className="card">
            <h2>Acesso negado</h2>
            <p>Precisas fazer login para aceder ao dashboard.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <div className="container">
        <h2>Dashboard</h2>

        <div className="dashboard-grid">
          <div className="card">
            <h3>Dados do utilizador</h3>
            <p><strong>Nome:</strong> {user.nome}</p>
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Telefone:</strong> {user.telefone}</p>
            <p><strong>Tipo:</strong> {user.tipo}</p>
          </div>

          <div className="card">
            <h3>Resumo</h3>
            <p><strong>Pedidos feitos:</strong> {myOrders.length}</p>
            <p><strong>Pedidos recebidos:</strong> {receivedOrders.length}</p>
          </div>
        </div>

        {loading ? (
          <p>A carregar dados...</p>
        ) : (
          <>
            <section className="section">
              <h3>Meus pedidos</h3>

              {myOrders.length === 0 ? (
                <p>Ainda não fizeste nenhum pedido.</p>
              ) : (
                <div className="orders-list">
                  {myOrders.map((order) => (
                    <div className="card" key={order.id}>
                      <h4>{order.product?.nome}</h4>
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
            </section>

            <section className="section">
              <h3>Pedidos recebidos</h3>

              {receivedOrders.length === 0 ? (
                <p>Ainda não recebeste pedidos.</p>
              ) : (
                <div className="orders-list">
                  {receivedOrders.map((order) => (
                    <div className="card" key={order.id}>
                      <h4>{order.product?.nome}</h4>
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
            </section>
          </>
        )}
      </div>
    </>
  );
}

export default Dashboard;