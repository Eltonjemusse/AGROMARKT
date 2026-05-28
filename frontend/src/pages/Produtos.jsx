import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import ProductCard from '../components/ProductCard';
import api from '../services/api';

function Produtos() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [categoria, setCategoria] = useState('');
  const [loading, setLoading] = useState(true);

  const carregarProdutos = async () => {
    try {
      const response = await api.get('/products');
      setProducts(response.data);
    } catch (error) {
      console.log(error);
      alert('Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarProdutos();
  }, []);

  const produtosFiltrados = products.filter((product) => {
    const matchSearch =
      product.nome.toLowerCase().includes(search.toLowerCase()) ||
      product.descricao.toLowerCase().includes(search.toLowerCase()) ||
      product.localizacao.toLowerCase().includes(search.toLowerCase());

    const matchCategoria = categoria
      ? product.categoria === categoria
      : true;

    return matchSearch && matchCategoria;
  });

  return (
    <>
      <Navbar />

      <div className="container">
        <div className="products-header">
          <div>
            <h2>Produtos disponíveis</h2>
            <p>Encontre produtos agrícolas frescos perto de si.</p>
          </div>
        </div>

        <div className="filters-card">
          <input
            type="text"
            placeholder="Pesquisar por nome, descrição ou localização..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          >
            <option value="">Todas as categorias</option>
            <option value="Hortaliças">Hortaliças</option>
            <option value="Frutas">Frutas</option>
            <option value="Cereais">Cereais</option>
            <option value="Tubérculos">Tubérculos</option>
            <option value="Leguminosas">Leguminosas</option>
            <option value="Outros">Outros</option>
          </select>

          <button
            type="button"
            onClick={() => {
              setSearch('');
              setCategoria('');
            }}
          >
            Limpar
          </button>
        </div>

        {loading ? (
          <p>A carregar produtos...</p>
        ) : produtosFiltrados.length === 0 ? (
          <p>Nenhum produto encontrado.</p>
        ) : (
          <>
            <p>
              <strong>{produtosFiltrados.length}</strong> produto(s) encontrado(s)
            </p>

            <div className="products-grid">
              {produtosFiltrados.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default Produtos;