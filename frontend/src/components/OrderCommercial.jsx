import { formatDecimal, hasCompleteOrderSnapshot } from '../utils/commercial';

function OrderCommercial({ order }) {
  const complete = hasCompleteOrderSnapshot(order);
  return (
    <>
      <h3>{order.nomeProdutoSnapshot || `Encomenda #${order.id}`}</h3>
      {!complete && <p className="commercial-notice">Registo histórico incompleto: alguns dados da compra não foram guardados. Os dados atuais do produto não substituem o histórico.</p>}
      {order.quantidadeNumerica != null ? (
        <p><strong>Quantidade:</strong> {formatDecimal(order.quantidadeNumerica)} {order.unidadeSnapshot || '(unidade não registada)'}</p>
      ) : <p><strong>Quantidade registada:</strong> {order.quantidade || 'Não registada'} (unidade não confirmada)</p>}
      {order.precoUnitarioSnapshot != null && (
        <p><strong>Preço na encomenda:</strong> {formatDecimal(order.precoUnitarioSnapshot, 2)} {order.moedaSnapshot === 'MZN' ? 'MT' : '(moeda não confirmada)'} / {order.unidadeSnapshot || '(unidade não registada)'}</p>
      )}
      {order.totalDecimal != null ? (
        <p><strong>Total:</strong> {formatDecimal(order.totalDecimal, 2)} {order.moedaSnapshot === 'MZN' ? 'MT' : '(moeda não confirmada)'}</p>
      ) : <p><strong>Total registado:</strong> {String(order.total ?? 'Não registado')} (moeda histórica não confirmada)</p>}
      {!complete && order.product?.nome && <p>Produto atual (referência): {order.product.nome}</p>}
      <p><strong>Estado:</strong> {order.status}</p>
    </>
  );
}

export default OrderCommercial;
