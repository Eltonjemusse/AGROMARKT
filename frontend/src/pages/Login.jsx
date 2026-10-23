import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';

import api from '../services/api';
import Navbar from '../components/Navbar';
import UnavailableLink from '../components/UnavailableLink';
import { useNotifications } from '../notifications/NotificationContext';
import { reportOperationError } from '../utils/operationFeedback';

function Login() {
  const notify = useNotifications();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: '',
    senha: ''
  });

  const [loading, setLoading] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
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

      notify.success('Sessão iniciada com sucesso.');
      navigate('/dashboard');
    } catch (error) {
      reportOperationError(error, { notify, fallback: 'Não foi possível iniciar sessão. Tenta novamente.', onFormError: setError });
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
                <label htmlFor="login-email">Email</label>
                <div className="input-icon-box">
                  <Mail size={20} />
                  <input
                    id="login-email"
                    autoComplete="username"
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
                  <label htmlFor="login-password">Senha</label>
                </div>

                <div className="input-icon-box">
                  <Lock size={20} />
                  <input
                    id="login-password"
                    autoComplete="current-password"
                    type={mostrarSenha ? 'text' : 'password'}
                    name="senha"
                    placeholder="••••••••"
                    value={form.senha}
                    onChange={handleChange}
                    required
                  />
                  <button type="button" className="password-toggle" aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                    onClick={() => setMostrarSenha(!mostrarSenha)}>{mostrarSenha ? <EyeOff size={20} /> : <Eye size={20} />}</button>
                </div>
              </div>

              <p className="field-help">Recuperação de senha indisponível nesta versão.</p>
              {error && <p role="alert" className="form-error">{error}</p>}

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
            <UnavailableLink>Sobre nós</UnavailableLink>
            <UnavailableLink>Contacto institucional</UnavailableLink>
          </div>

          <div>
            <h3>Legal</h3>
            <UnavailableLink>Política de Privacidade</UnavailableLink>
            <UnavailableLink>Termos de Uso</UnavailableLink>
          </div>
        </div>
      </footer>
    </>
  );
}

export default Login;
