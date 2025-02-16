import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../contexts/LanguageContext';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:5001/api/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
      } else {
        setError(data.message || t('forgotPassword.genericError'));
      }
    } catch (err) {
      setError(t('forgotPassword.connectionError'));
      console.error('Forgot password error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="forgot-password-container">
        <h2>{t('forgotPassword.checkEmail')}</h2>
        <p>{t('forgotPassword.emailSent')}</p>
        <Link to="/login" className="back-to-login">
          {t('forgotPassword.backToLogin')}
        </Link>
      </div>
    );
  }

  return (
    <div className="forgot-password-container">
      <h2>{t('forgotPassword.title')}</h2>
      <p className="forgot-password-description">
        {t('forgotPassword.description')}
      </p>
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">{t('forgotPassword.email')}</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <button type="submit" disabled={isLoading} className="submit-button">
          {isLoading ? t('forgotPassword.sending') : t('forgotPassword.submit')}
        </button>
      </form>
      <p className="login-link">
        <Link to="/login">{t('forgotPassword.backToLogin')}</Link>
      </p>
    </div>
  );
}

export default ForgotPassword;