import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

function Home() {
  return (
    <>
      <Navbar />

      <section className="hero">
        <div className="hero-content">
          <h1>Compre e venda produtos agrícolas de forma simples</h1>

          <p>
            O AGROMARKT aproxima agricultores, vendedores e compradores,
            facilitando a comercialização de produtos frescos e locais.
          </p>

          <div className="hero-buttons">
            <Link to="/produtos">
              <button>Ver Produtos</button>
            </Link>

            <Link to="/cadastro">
              <button className="outline-btn">Criar Conta</button>
            </Link>
          </div>
        </div>

        <div className="hero-card">
          <h3>Produtos frescos</h3>
          <p>Tomate, cebola, milho, arroz, frutas, hortaliças e muito mais.</p>
        </div>
      </section>

      <section className="container">
        <h2>Como funciona?</h2>

        <div className="features-grid">
          <div className="card">
            <h3>1. Agricultor publica</h3>
            <p>O vendedor cadastra os seus produtos com preço, quantidade e localização.</p>
          </div>

          <div className="card">
            <h3>2. Comprador encontra</h3>
            <p>O comprador pesquisa produtos agrícolas disponíveis na plataforma.</p>
          </div>

          <div className="card">
            <h3>3. Pedido é feito</h3>
            <p>O comprador envia uma encomenda e o vendedor acompanha pelo dashboard.</p>
          </div>
        </div>
      </section>

      <section className="container">
        <div className="cta-box">
          <h2>Comece agora no AGROMARKT</h2>
          <p>Cadastre-se gratuitamente e participe do mercado agrícola digital.</p>

          <Link to="/cadastro">
            <button>Criar Conta Grátis</button>
          </Link>
        </div>
      </section>
    </>
  );
}

export default Home;