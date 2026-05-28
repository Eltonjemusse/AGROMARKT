import { Link, useNavigate } from 'react-router-dom';

function Navbar() {
  const navigate = useNavigate();

  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user'));

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <Link to="/" className="logo">
        AGROMARKT
      </Link>

      <div>
        <Link to="/produtos">Produtos</Link>

        {!token ? (
          <>
            <Link to="/login">Login</Link>
            <Link to="/cadastro">Cadastro</Link>
          </>
        ) : (
          <>
            <Link to="/novo-produto">Novo Produto</Link>
            <Link to="/meus-produtos">Meus Produtos</Link>
            <Link to="/dashboard">Dashboard</Link>

            {user?.tipo === 'admin' && (
              <Link to="/admin">Admin</Link>
            )}

            <button onClick={logout}>Sair</button>
          </>
        )}
      </div>
    </nav>
  );
}

export default Navbar;