// components/ResetPassword.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from '../api/axiosConfig';
import { useTranslation } from '../contexts/LanguageContext';

/**
 * Password reset form component.
 * Validates token from URL and allows setting a new password.
 * @returns Rendered password reset form
 */

function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError(t('resetPassword.invalidToken'));
    }
  }, [token, t]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
  
    if (password !== confirmPassword) {
      setError(t('resetPassword.passwordMismatch'));
      return;
    }
  
    setIsLoading(true);
  
    try {
      const response = await axios.post('/api/reset-password', {
        token,
        password
      });
  
      navigate('/login', { state: { resetSuccess: true } });
    } catch (err) {
      const errorMessage = err.response?.data?.message || t('resetPassword.genericError');
      setError(errorMessage);
      console.error('Reset password error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="reset-password-container">
        <h2>{t('resetPassword.invalidTitle')}</h2>
        <p>{t('resetPassword.invalidTokenMessage')}</p>
        <Link to="/forgot-password" className="request-new-link">
          {t('resetPassword.requestNewLink')}
        </Link>
      </div>
    );
  }

  return (
    <div className="reset-password-container">
      <h2>{t('resetPassword.title')}</h2>
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="password">{t('resetPassword.newPassword')}</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="confirm-password">
            {t('resetPassword.confirmPassword')}
          </label>
          <input
            type="password"
            id="confirm-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" disabled={isLoading} className="submit-button">
          {isLoading ? t('resetPassword.resetting') : t('resetPassword.submit')}
        </button>
      </form>
    </div>
  );
}

export default ResetPassword;