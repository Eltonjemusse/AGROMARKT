import { formatDecimal, isStructuredProduct } from '../utils/commercial';

function ProductCommercial({ product }) {
  if (!isStructuredProduct(product)) {
    return (
      <div className="commercial-notice">
        <p><strong>Produto por rever:</strong> o vendedor precisa de confirmar quantidade, unidade e preço para receber novas encomendas.</p>
        <p>Quantidade antiga: {product.quantidade || 'Não registada'}</p>
        <p>Preço antigo: {String(product.preco ?? 'Não registado')} (unidade e moeda por confirmar)</p>
      </div>
    );
  }
  return (
    <>
      <p><strong>Preço:</strong> {formatDecimal(product.precoUnitario, 2)} MT / {product.unidade}</p>
      <p><strong>Quantidade disponível:</strong> {formatDecimal(product.quantidadeDisponivel)} {product.unidade}</p>
    </>
  );
}

export default ProductCommercial;
