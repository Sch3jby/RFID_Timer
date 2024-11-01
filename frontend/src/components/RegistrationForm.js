import React, { useState } from "react";
import axios from "axios";
import { useTranslation } from '../contexts/LanguageContext';

function RegistrationForm() {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    forename: '',
    surname: '',
    year: '',
    club: '',
    email: '',
    gender: ''
  });
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:5001/registration', formData);
      setMessage({ type: 'success', text: t('registration.success') });
      setFormData({ forename: '', surname: '', year: '', club: '', email: '', gender: ''});
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || t('registration.error') });
    }
  };

  return (
    <div className="form-container">
      <h1 className="text-center mb-4">{t('registration.title')}</h1>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>{t('registration.firstName')}:</label>
          <input type="text" name="forename" value={formData.forename} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>{t('registration.lastName')}:</label>
          <input type="text" name="surname" value={formData.surname} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>{t('registration.birthYear')}:</label>
          <input type="text" name="year" value={formData.year} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>{t('registration.club')}:</label>
          <input type="text" name="club" value={formData.club} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>{t('registration.email')}:</label>
          <input type="email" name="email" value={formData.email} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>{t('registration.gender')}:</label>
          <select name="gender" value={formData.gender} onChange={handleChange}>
            <option value="">{t('registration.select')}</option>
            <option value="M">{t('registration.male')}</option>
            <option value="F">{t('registration.female')}</option>
          </select>
        </div>
        <button type="submit">{t('registration.register')}</button>
      </form>
      {message.text && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}
    </div>
  );
}

export default RegistrationForm;