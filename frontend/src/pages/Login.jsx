import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Navbar from '../components/Navbar';

function Login() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: '',
    senha: ''
  });

  const [loading, setLoading] = useState(false);

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

      console.log('LOGIN RESPONSE:', response.data);

      const token = response.data.token;
      const user = response.data.user;

      if (!token || !user) {
        alert('Resposta inválida do servidor');
        setLoading(false);
        return;
      }

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      alert('Login realizado com sucesso!');
      navigate('/dashboard');

    } catch (error) {
      console.log('ERRO LOGIN:', error);

      if (error.response) {
        alert(error.response.data.message || 'Erro ao fazer login');
      } else {
        alert('Não foi possível conectar ao servidor');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />

      <div className="container">
        <div className="card" style={{ maxWidth: 450, margin: 'auto' }}>
          <h2>Entrar</h2>

          <form onSubmit={handleSubmit}>
            <input
              name="email"
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={handleChange}
              required
            />

            <input
              name="senha"
              type="password"
              placeholder="Senha"
              value={form.senha}
              onChange={handleChange}
              required
            />

            <button type="submit" disabled={loading}>
              {loading ? 'A entrar...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

export default Login;