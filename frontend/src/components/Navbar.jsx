import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

function Navbar() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user'));

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const closeMenu = () => {
    setMenuOpen(false);
  };

  return (
    <nav className="navbar">
      <Link to="/" className="logo" onClick={closeMenu}>
        AGROMARKT
      </Link>

      <button
        className="menu-toggle"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Abrir menu"
      >
        ☰
      </button>

      <div className={`nav-links ${menuOpen ? 'active' : ''}`}>
        <Link to="/produtos" onClick={closeMenu}>
          Produtos
        </Link>

        {!token ? (
          <>
            <Link to="/login" onClick={closeMenu}>
              Login
            </Link>

            <Link to="/cadastro" className="nav-register" onClick={closeMenu}>
              Cadastro
            </Link>
          </>
        ) : (
          <>
            <Link to="/novo-produto" onClick={closeMenu}>
              Novo Produto
            </Link>

            <Link to="/meus-produtos" onClick={closeMenu}>
              Meus Produtos
            </Link>

            <Link to="/dashboard" onClick={closeMenu}>
              Dashboard
            </Link>

            {user?.tipo === 'admin' && (
              <Link to="/admin" onClick={closeMenu}>
                Admin
              </Link>
            )}

            <button onClick={logout}>Sair</button>
          </>
        )}
      </div>
    </nav>
  );
}

export default Navbar;