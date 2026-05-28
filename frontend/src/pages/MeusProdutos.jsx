import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import api from '../services/api';

function MeusProdutos() {
  const [products, setProducts] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  const carregarProdutos = async () => {
    try {
      const response = await api.get('/products/my-products');
      setProducts(response.data);
    } catch (error) {
      console.log(error);
      alert('Erro ao carregar seus produtos');
    } finally {
      setLoading(false);
    }
  };

  const apagarProduto = async (id) => {
    const confirmar = confirm('Tens certeza que queres apagar este produto?');

    if (!confirmar) return;

    try {
      await api.delete(`/products/${id}`);
      alert('Produto apagado com sucesso!');
      carregarProdutos();
    } catch (error) {
      console.log(error);
      alert(error.response?.data?.message || 'Erro ao apagar produto');
    }
  };

  const iniciarEdicao = (product) => {
    setEditingProduct({
      ...product
    });
  };

  const cancelarEdicao = () => {
    setEditingProduct(null);
  };

  const handleChange = (e) => {
    setEditingProduct({
      ...editingProduct,
      [e.target.name]: e.target.value
    });
  };

  const salvarEdicao = async (e) => {
    e.preventDefault();

    try {
      await api.put(`/products/${editingProduct.id}`, {
        nome: editingProduct.nome,
        descricao: editingProduct.descricao,
        preco: Number(editingProduct.preco),
        quantidade: editingProduct.quantidade,
        categoria: editingProduct.categoria,
        imagem: editingProduct.imagem,
        localizacao: editingProduct.localizacao
      });

      alert('Produto actualizado com sucesso!');
      setEditingProduct(null);
      carregarProdutos();
    } catch (error) {
      console.log(error);
      alert(error.response?.data?.message || 'Erro ao actualizar produto');
    }
  };

  useEffect(() => {
    carregarProdutos();
  }, []);

  return (
    <>
      <Navbar />

      <div className="container">
        <h2>Meus Produtos</h2>

        {loading ? (
          <p>A carregar produtos...</p>
        ) : products.length === 0 ? (
          <p>Ainda não cadastraste produtos.</p>
        ) : (
          <div className="products-grid">
            {products.map((product) => (
              <div className="card" key={product.id}>
                <h3>{product.nome}</h3>
                <p>{product.descricao}</p>
                <p><strong>Preço:</strong> {product.preco} MT</p>
                <p><strong>Quantidade:</strong> {product.quantidade}</p>
                <p><strong>Categoria:</strong> {product.categoria}</p>
                <p><strong>Localização:</strong> {product.localizacao}</p>

                <button onClick={() => iniciarEdicao(product)}>
                  Editar
                </button>

                <button
                  onClick={() => apagarProduto(product.id)}
                  className="danger-btn"
                >
                  Apagar
                </button>
              </div>
            ))}
          </div>
        )}

        {editingProduct && (
          <div className="modal-bg">
            <div className="card modal-card">
              <h3>Editar Produto</h3>

              <form onSubmit={salvarEdicao}>
                <input
                  name="nome"
                  value={editingProduct.nome}
                  onChange={handleChange}
                  placeholder="Nome"
                  required
                />

                <textarea
                  name="descricao"
                  value={editingProduct.descricao}
                  onChange={handleChange}
                  placeholder="Descrição"
                  required
                />

                <input
                  name="preco"
                  type="number"
                  value={editingProduct.preco}
                  onChange={handleChange}
                  placeholder="Preço"
                  required
                />

                <input
                  name="quantidade"
                  value={editingProduct.quantidade}
                  onChange={handleChange}
                  placeholder="Quantidade"
                  required
                />

                <select
                  name="categoria"
                  value={editingProduct.categoria}
                  onChange={handleChange}
                  required
                >
                  <option value="Hortaliças">Hortaliças</option>
                  <option value="Frutas">Frutas</option>
                  <option value="Cereais">Cereais</option>
                  <option value="Tubérculos">Tubérculos</option>
                  <option value="Leguminosas">Leguminosas</option>
                  <option value="Outros">Outros</option>
                </select>

                <input
                  name="imagem"
                  value={editingProduct.imagem || ''}
                  onChange={handleChange}
                  placeholder="URL da imagem"
                />

                <input
                  name="localizacao"
                  value={editingProduct.localizacao}
                  onChange={handleChange}
                  placeholder="Localização"
                  required
                />

                <button type="submit">Salvar</button>

                <button type="button" onClick={cancelarEdicao}>
                  Cancelar
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default MeusProdutos;