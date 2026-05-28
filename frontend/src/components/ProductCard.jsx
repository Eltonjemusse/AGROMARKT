import { Link } from 'react-router-dom';

function ProductCard({ product }) {
  return (
    <div className="card product-card">
      {product.imagem ? (
        <img
          src={product.imagem}
          alt={product.nome}
          className="product-card-img"
        />
      ) : (
        <div className="product-placeholder">
          🌱
        </div>
      )}

      <span className="category-badge">{product.categoria}</span>

      <h3>{product.nome}</h3>

      <p className="product-description">
        {product.descricao}
      </p>

      <p>
        <strong>Preço:</strong> {product.preco} MT
      </p>

      <p>
        <strong>Quantidade:</strong> {product.quantidade}
      </p>

      <p>
        <strong>Localização:</strong> {product.localizacao}
      </p>

      {product.user && (
        <p>
          <strong>Vendedor:</strong> {product.user.nome}
        </p>
      )}

      <Link to={`/produtos/${product.id}`}>
        <button>Ver detalhes</button>
      </Link>
    </div>
  );
}

export default ProductCard;