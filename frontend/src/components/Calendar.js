import React, { useState, useEffect } from 'react';
import { useTranslation } from '../contexts/LanguageContext';
import { Link } from 'react-router-dom';
import axios from '../api/axiosConfig';


function Calendar() {
  const { t } = useTranslation();
  const [races, setRaces] = useState([]);
  const [filteredRaces, setFilteredRaces] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    const fetchRaces = async () => {
      try {
        const response = await axios.get('api/races');
        const racesData = response.data.races || [];
        setRaces(racesData);
        setFilteredRaces(racesData);
      } catch (error) {
        setMessage({ 
          type: 'error', 
          text: t('calendar.error') 
        });
      } finally {
        setLoading(false);
      }
    };

    fetchRaces();
  }, [t]);

  const handleSearch = (e) => {
    const query = e.target.value.toLowerCase();
    setSearchQuery(query);

    const filtered = races.filter((race) => {
      const raceName = race.name?.toLowerCase() || '';
      const raceDate = race.date?.toLowerCase() || '';
      
      return raceName.includes(query) || raceDate.includes(query);
    });

    setFilteredRaces(filtered);
  };

  if (loading) {
    return <div className="loading">{t('common.loading')}</div>;
  }

  if (message.text) {
    return (
      <div className={`message ${message.type}`}>
        {message.text}
      </div>
    );
  }

  return (
    <div className="calendar-container">
      <h1 className="text-center mb-4">{t('calendar.title')}</h1>
      <div className="search-container">
        <input
          type="text"
          placeholder={t('calendar.search')}
          value={searchQuery}
          onChange={handleSearch}
        />
      </div>
      <table className="race-table">
        <thead>
          <tr>
            <th>{t('calendar.columns.name')}</th>
            <th>{t('calendar.columns.date')}</th>
          </tr>
        </thead>
        <tbody>
          {filteredRaces.map((race) => (
            <tr key={race.id}>
              <td>
                <Link to={`/race/${race.id}`}>{race.name}</Link>
              </td>
              <td>{race.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Calendar;