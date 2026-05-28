import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye } from 'lucide-react';

import api from '../services/api';
import Navbar from '../components/Navbar';

function Login() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: '',
    senha: ''
  });

  const [loading, setLoading] = useState(false);
  const [lembrar, setLembrar] = useState(false);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/auth/login', {
        email: form.email,
        senha: form.senha
      });

      const token = response.data.token;
      const user = response.data.user;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      if (lembrar) {
        localStorage.setItem('rememberEmail', form.email);
      }

      alert('Login realizado com sucesso!');
      navigate('/dashboard');
    } catch (error) {
      console.log('ERRO LOGIN:', error);
      alert(error.response?.data?.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />

      <main className="login-page">
        <div className="login-wrapper">
          <section className="login-card">
            <h1>Entrar</h1>
            <p className="login-subtitle">
              Bem-vindo de volta! Acesse sua conta Agromarkt.
            </p>

            <form onSubmit={handleSubmit} className="login-form">
              <div className="form-group">
                <label>Email</label>
                <div className="input-icon-box">
                  <Mail size={20} />
                  <input
                    type="email"
                    name="email"
                    placeholder="seu@email.com"
                    value={form.email}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <div className="label-row">
                  <label>Senha</label>
                  <span className="forgot-link">Esqueceu a senha?</span>
                </div>

                <div className="input-icon-box">
                  <Lock size={20} />
                  <input
                    type="password"
                    name="senha"
                    placeholder="••••••••"
                    value={form.senha}
                    onChange={handleChange}
                    required
                  />
                  <Eye size={20} />
                </div>
              </div>

              <label className="remember-row">
                <input
                  type="checkbox"
                  checked={lembrar}
                  onChange={(e) => setLembrar(e.target.checked)}
                />
                <span>Lembrar de mim</span>
              </label>

              <button type="submit" className="login-main-btn" disabled={loading}>
                {loading ? 'A entrar...' : 'Entrar'}
              </button>

              <div className="login-divider"></div>

              <p className="register-text">Não possui uma conta?</p>

              <Link to="/cadastro" className="login-outline-btn">
                Criar conta agora
              </Link>
            </form>
          </section>
        </div>
      </main>

      <footer className="auth-footer">
        <div className="auth-footer-grid">
          <div>
            <h2>Agromarkt</h2>
            <p>
              © 2024 Agromarkt. Conectando o campo ao mercado com tecnologia,
              transparência e eficiência para o produtor rural brasileiro.
            </p>
          </div>

          <div>
            <h3>Institucional</h3>
            <Link to="/">Sobre nós</Link>
            <Link to="/">Contato</Link>
          </div>

          <div>
            <h3>Legal</h3>
            <Link to="/">Política de Privacidade</Link>
            <Link to="/">Termos de Uso</Link>
          </div>
        </div>
      </footer>
    </>
  );
}

export default Login;