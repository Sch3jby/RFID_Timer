// components/Login.js
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from '../api/axiosConfig';
import { useTranslation } from '../contexts/LanguageContext';

/**
 * Login form component.
 * Handles user authentication and token storage.
 * @returns Rendered login form
 */

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
  
    try {
      const response = await axios.post('/api/login', {
        email,
        password
      });
  
      localStorage.setItem('access_token', response.data.access_token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      navigate('/');
      window.location.reload();
    } catch (err) {
      const errorMessage = err.response?.data?.message || t('login.genericError');
      setError(errorMessage);
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <h2>{t('login.logTitle')}</h2>
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">{t('login.email')}</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">{t('login.password')}</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="forgot-password">
          <Link to="/forgot-password">{t('login.forgotPassword') || 'Zapomenuté heslo?'}</Link>
        </div>
        <button type="submit" disabled={isLoading} className="submit-button">
          {isLoading ? t('login.loggingIn') : t('login.submit')}
        </button>
      </form>
      <p className="register-link">
        {t('login.noAccount')} <Link to="/register">{t('login.register')}</Link>
      </p>
    </div>
  );
}

export default Login;