import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import UnavailableLink from '../components/UnavailableLink';

function Home() {
  return (
    <>
      <Navbar />

      <main>
        <section className="home-hero">
          <div className="home-hero-text">
            <h1>
              Compre e venda <br />
              produtos agrícolas de <br />
              forma simples
            </h1>

            <p>
              O AGROMARKT aproxima agricultores, vendedores e compradores,
              facilitando a comercialização de produtos frescos e locais com
              transparência e segurança.
            </p>

            <div className="home-hero-actions">
              <Link to="/produtos">
                <button className="primary-btn">Ver Produtos</button>
              </Link>

              <Link to="/cadastro">
                <button className="secondary-btn">Criar Conta</button>
              </Link>
            </div>
          </div>

          <div className="home-hero-visual">
            <div className="green-card">
              <div>
                <h2>Produtos frescos</h2>
                <p>
                  Tomate, cebola, milho, arroz, frutas, hortaliças e muito
                  mais direto da fonte para o seu negócio.
                </p>
              </div>

              <div className="check-circle">✓</div>
            </div>
          </div>
        </section>

      </main>

      <footer className="home-footer">
        <div className="footer-grid">
          <div>
            <h2>AGROMARKT</h2>
            <p>
              Conectando o campo à cidade através da tecnologia, garantindo
              melhores preços para quem produz e qualidade para quem compra.
            </p>
          </div>

          <div>
            <h3>Links Úteis</h3>
            <UnavailableLink>Sobre nós</UnavailableLink>
            <UnavailableLink>Política de Privacidade</UnavailableLink>
            <UnavailableLink>Termos de Uso</UnavailableLink>
          </div>

          <div>
            <h3>Contato</h3>
            <p>eltonjemussek7@gmail.com</p>
            <p>+258 851395736</p>
            <p>Desenvolvido por Elton Raimundo Jemusse</p>
          </div>
        </div>

        <div className="footer-bottom">
           © 2026 AGROMARKT. Todos os direitos reservados. Desenvolvido por Elton Raimundo Jemusse.
        </div>
      </footer>
    </>
  );
}

export default Home;
