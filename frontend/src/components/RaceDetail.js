// RaceDetail.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../api/axiosConfig';
import { useTranslation } from '../contexts/LanguageContext';
import StartList from './StartList';
import ResultList from './ResultList';
import logo from '../styles/other/stopwatch.png';

function RaceDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [race, setRace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('startlist');
  useEffect(() => {
    const fetchRace = async () => {
      try {
        const response = await axios.get(`/api/race/${id}`);
        setRace(response.data.race);
      } catch (error) {
        setError(t('raceDetail.error'));
      } finally {
        setLoading(false);
      }
    };

    fetchRace();
  }, [id, t]);

  const handleRegister = () => {
    navigate('/registration', { 
      state: { 
        preselectedRace: `${race.name} - ${race.date}` 
      } 
    });
  };

  if (loading) {
    return <div className="loading">{t('common.loading')}</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  if (!race) {
    return <div>{t('raceDetail.noData')}</div>;
  }

  return (
    <div className="race-detail-container">
      <div className="header-container">
        <img src={logo} alt="Logo" className="logo-image" />
        <h1>{race.name}</h1>
      </div>
      <div className="race-info">
        <h3><strong>{t('raceDetail.date')}:</strong> {race.date}</h3>
        <h3><strong>{t('raceDetail.startType')}:</strong> {race.start}</h3>
        <h3><strong>{t('raceDetail.description')}:</strong></h3>
        <p>{race.description}</p>
        
        <button onClick={handleRegister} className="register-button">
          {t('raceDetail.register')}
        </button>
      </div>
      
      <div className="race-list-tabs">
        <button 
          className={activeTab === 'startlist' ? 'active' : ''}
          onClick={() => setActiveTab('startlist')}
        >
          {t('raceDetail.startList')}
        </button>
        <button 
          className={activeTab === 'resultlist' ? 'active' : ''}
          onClick={() => setActiveTab('resultlist')}
        >
          {t('raceDetail.resultList')}
        </button>
      </div>

      {activeTab === 'startlist' ? (
        <StartList 
          participants={race.participants} 
          raceId={id}
        />
      ) : (
        <ResultList 
          participants={race.participants} 
          raceId={id}
        />
      )}
    </div>
  );
}

export default RaceDetail;