import { hasCompleteOrderSnapshot } from '../utils/commercial';

function OrderActions({ order, busy, onStatus }) {
  if (order.status === 'pendente') {
    const complete = hasCompleteOrderSnapshot(order);
    return (
      <div className="order-actions">
        {!complete && <p className="commercial-notice">Revisão necessária: encomenda antiga ou incompleta. A aceitação automática está bloqueada.</p>}
        <button type="button" disabled={busy || !complete} onClick={() => onStatus(order.id, 'aceite')}>Aceitar encomenda</button>
        <button type="button" className="danger-btn" disabled={busy} onClick={() => onStatus(order.id, 'rejeitado')}>Rejeitar encomenda</button>
      </div>
    );
  }
  if (order.status === 'aceite') {
    return <div className="order-actions">
      {!order.stockDescontadoEm && <p className="commercial-notice">Aceitação antiga: desconto de stock não confirmado. A entrega não altera stock retroativamente.</p>}
      <button type="button" disabled={busy} onClick={() => onStatus(order.id, 'entregue')}>Marcar como entregue</button>
    </div>;
  }
  return <p>{['entregue', 'rejeitado'].includes(order.status) ? 'Encomenda encerrada.' : 'Estado antigo: revisão necessária.'}</p>;
}

export default OrderActions;
