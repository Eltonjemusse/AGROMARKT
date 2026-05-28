import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ChevronDown } from 'lucide-react';

import api from '../services/api';
import Navbar from '../components/Navbar';

function Cadastro() {
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
  const [aceitouTermos, setAceitouTermos] = useState(false);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!aceitouTermos) {
      alert('Precisas concordar com os Termos de Serviço e Política de Privacidade.');
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/register', {
        nome: form.nome,
        email: form.email,
        senha: form.senha,
        telefone: form.telefone,
        tipo: form.tipo
      });

      alert('Conta criada com sucesso!');
      navigate('/login');
    } catch (error) {
      console.log('ERRO CADASTRO:', error);
      alert(error.response?.data?.message || 'Erro ao cadastrar');
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
                <label>Nome Completo</label>
                <input
                  type="text"
                  name="nome"
                  placeholder="Ex: João Silva"
                  value={form.nome}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="register-group">
                <label>E-mail</label>
                <input
                  type="email"
                  name="email"
                  placeholder="seu@email.com"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="register-group">
                <label>Senha</label>

                <div className="register-password-box">
                  <input
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
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                  >
                    {mostrarSenha ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div className="register-group">
                <label>Telefone / WhatsApp</label>
                <input
                  type="text"
                  name="telefone"
                  placeholder="(00) 00000-0000"
                  value={form.telefone}
                  onChange={handleChange}
                />
              </div>

              <div className="register-group">
                <label>Tipo de Usuário</label>

                <div className="register-select-box">
                  <select
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

              <label className="terms-row">
                <input
                  type="checkbox"
                  checked={aceitouTermos}
                  onChange={(e) => setAceitouTermos(e.target.checked)}
                />
                <span>
                  Eu concordo com os <strong>Termos de Serviço</strong> e{' '}
                  <strong>Política de Privacidade</strong>.
                </span>
              </label>

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
            <Link to="/">Sobre Nós</Link>
            <Link to="/">Privacidade</Link>
            <Link to="/">Termos</Link>
            <Link to="/">Suporte</Link>
          </div>
        </div>
      </footer>
    </>
  );
}

export default Cadastro;