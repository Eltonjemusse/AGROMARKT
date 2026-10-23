import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ChevronDown } from 'lucide-react';

import api from '../services/api';
import Navbar from '../components/Navbar';
import UnavailableLink from '../components/UnavailableLink';
import { useNotifications } from '../notifications/NotificationContext';
import { reportOperationError } from '../utils/operationFeedback';

function Cadastro() {
  const notify = useNotifications();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    nome: '',
    email: '',
    senha: '',
    telefone: '',
    tipo: 'comprador'
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
      await api.post('/auth/register', {
        nome: form.nome,
        email: form.email,
        senha: form.senha,
        telefone: form.telefone,
        tipo: form.tipo
      });

      notify.success('Conta criada com sucesso. Já podes iniciar sessão.');
      navigate('/login');
    } catch (error) {
      reportOperationError(error, { notify, fallback: 'Não foi possível criar a conta. Tenta novamente.', onFormError: setError });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />

      <main className="register-page">
        <div className="register-wrapper">
          <section className="register-card">
            <h1>Criar Conta</h1>

            <p className="register-subtitle">
              Junte-se ao ecossistema da fertilidade digital para o agronegócio.
            </p>

            <form onSubmit={handleSubmit} className="register-form">
              <div className="register-group">
                <label htmlFor="register-name">Nome completo</label>
                <input
                  id="register-name"
                  autoComplete="name"
                  type="text"
                  name="nome"
                  placeholder="Ex: João Silva"
                  value={form.nome}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="register-group">
                <label htmlFor="register-email">Email</label>
                <input
                  id="register-email"
                  autoComplete="email"
                  type="email"
                  name="email"
                  placeholder="seu@email.com"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="register-group">
                <label htmlFor="register-password">Senha</label>

                <div className="register-password-box">
                  <input
                    id="register-password"
                    autoComplete="new-password"
                    type={mostrarSenha ? 'text' : 'password'}
                    name="senha"
                    placeholder="••••••••"
                    value={form.senha}
                    onChange={handleChange}
                    required
                  />

                  <button
                    type="button"
                    className="toggle-password-btn"
                    aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                  >
                    {mostrarSenha ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div className="register-group">
                <label htmlFor="register-phone">Telefone / WhatsApp</label>
                <input
                  id="register-phone"
                  autoComplete="tel"
                  type="tel"
                  name="telefone"
                  placeholder="+258 ..."
                  value={form.telefone}
                  onChange={handleChange}
                />
              </div>

              <div className="register-group">
                <label htmlFor="register-role">Tipo de conta</label>

                <div className="register-select-box">
                  <select
                    id="register-role"
                    name="tipo"
                    value={form.tipo}
                    onChange={handleChange}
                  >
                    <option value="comprador">Comprador</option>
                    <option value="vendedor">Vendedor</option>
                  </select>

                  <ChevronDown size={20} />
                </div>
              </div>

              <p className="field-help">Termos de serviço e política de privacidade em preparação.</p>
              {error && <p role="alert" className="form-error">{error}</p>}

              <button
                type="submit"
                className="register-main-btn"
                disabled={loading}
              >
                {loading ? 'A criar conta...' : 'Criar Conta'}
              </button>

              <div className="register-divider"></div>

              <p className="login-redirect-text">
                Já possui uma conta?{' '}
                <Link to="/login">Fazer Login</Link>
              </p>
            </form>
          </section>
        </div>
      </main>

      <footer className="register-footer">
        <div className="register-footer-content">
          <div>
            <h2>Agromarkt</h2>
            <p>© 2024 Agromarkt. Digital Fertility for Agribusiness.</p>
          </div>

          <div className="register-footer-links">
            <UnavailableLink>Sobre nós</UnavailableLink>
            <UnavailableLink>Privacidade</UnavailableLink>
            <UnavailableLink>Termos</UnavailableLink>
            <UnavailableLink>Suporte</UnavailableLink>
          </div>
        </div>
      </footer>
    </>
  );
}

export default Cadastro;
