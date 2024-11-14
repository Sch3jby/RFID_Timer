import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { useTranslation } from '../contexts/LanguageContext';

function RaceDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [race, setRace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchRace = async () => {
      try {
        const response = await axios.get(`http://localhost:5001/race/${id}`);
        setRace(response.data.race);
      } catch (error) {
        setError(t('raceDetail.error'));
      } finally {
        setLoading(false);
      }
    };

    fetchRace();
  }, [id, t]);

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
      <h1>{race.name}</h1>
      <p><strong>{t('raceDetail.date')}:</strong> {race.date}</p>
      <p><strong>{t('raceDetail.startTime')}:</strong> {race.start}</p>
    </div>
  );
}

export default RaceDetail;
