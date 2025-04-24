// components/Register.js
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from '../api/axiosConfig';
import { useTranslation } from '../contexts/LanguageContext';

/**
 * User registration form.
 * Handles account creation with validation.
 * @returns Rendered registration form
 */

function Register() {
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
  
    if (password !== confirmPassword) {
      setError(t('register.passwordMismatch'));
      return;
    }
  
    setIsLoading(true);
  
    try {
      const response = await axios.post('/api/register', {
        nickname,
        email,
        password
      });
  
      navigate('/login', { state: { registrationSuccess: true } });
    } catch (err) {
      const errorMessage = err.response?.data?.message || t('register.connectionError');
      setError(errorMessage);
      console.error('Registration error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="register-container">
      <h2>{t('register.regTitle')}</h2>
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="nickname">{t('register.nickname')}</label>
          <input
            type="text"
            id="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="email">{t('register.email')}</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">{t('register.password')}</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="confirm-password">{t('register.confirmPassword')}</label>
          <input
            type="password"
            id="confirm-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" disabled={isLoading} className="submit-button">
          {isLoading ? t('register.registering') : t('register.submit')}
        </button>
      </form>
      <p className="login-link">
        {t('register.haveAccount')} <Link to="/login">{t('register.login')}</Link>
      </p>
    </div>
  );
}

export default Register;