import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

function NotFound() {
  return <>
    <Navbar />
    <main className="container">
      <div className="card">
        <h1>Página não disponível</h1>
        <p>A página pedida não está disponível nesta versão.</p>
        <Link to="/produtos">Voltar ao catálogo</Link>
      </div>
    </main>
  </>;
}

export default NotFound;
