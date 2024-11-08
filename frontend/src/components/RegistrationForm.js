import React, { useState, useEffect } from "react";
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
    gender: '',
    race_id: ''
  });
  const [races, setRaces] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(true);

  // Fetch available races when component mounts
  useEffect(() => {
    const fetchRaces = async () => {
      try {
        const response = await axios.get('http://localhost:5001/races');
        setRaces(response.data.races);
      } catch (error) {
        setMessage({ 
          type: 'error', 
          text: t('registration.errorLoadingRaces') 
        });
      } finally {
        setLoading(false);
      }
    };

    fetchRaces();
  }, [t]);

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
      setFormData({ 
        forename: '', 
        surname: '', 
        year: '', 
        club: '', 
        email: '', 
        gender: '',
        race_id: ''
      });
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.error || t('registration.error') 
      });
    }
  };

  if (loading) {
    return <div className="loading">{t('common.loading')}</div>;
  }

  return (
    <div className="form-container">
      <h1 className="text-center mb-4">{t('registration.title')}</h1>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>{t('registration.race')}:</label>
          <select 
            name="race_id" 
            value={formData.race_id} 
            onChange={handleChange}
            required
          >
            <option value="">{t('registration.select')}</option>
            {races.map((race) => (
              <option key={race.id} value={race.id}>
                {race.name} - {race.date}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>{t('registration.firstName')}:</label>
          <input 
            type="text" 
            name="forename" 
            value={formData.forename} 
            onChange={handleChange} 
            required 
          />
        </div>
        <div className="form-group">
          <label>{t('registration.lastName')}:</label>
          <input 
            type="text" 
            name="surname" 
            value={formData.surname} 
            onChange={handleChange} 
            required 
          />
        </div>
        <div className="form-group">
          <label>{t('registration.birthYear')}:</label>
          <input 
            type="text" 
            name="year" 
            value={formData.year} 
            onChange={handleChange} 
            required 
          />
        </div>
        <div className="form-group">
          <label>{t('registration.club')}:</label>
          <input 
            type="text" 
            name="club" 
            value={formData.club} 
            onChange={handleChange} 
            required 
          />
        </div>
        <div className="form-group">
          <label>{t('registration.email')}:</label>
          <input 
            type="email" 
            name="email" 
            value={formData.email} 
            onChange={handleChange} 
            required 
          />
        </div>
        <div className="form-group">
          <label>{t('registration.gender')}:</label>
          <select 
            name="gender" 
            value={formData.gender} 
            onChange={handleChange}
            required
          >
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