import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from '../contexts/LanguageContext';

function RaceDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [race, setRace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredParticipants, setFilteredParticipants] = useState([]);
  const [sortColumn, setSortColumn] = useState('surname');
  const [sortDirection, setSortDirection] = useState('asc');

  useEffect(() => {
    const fetchRace = async () => {
      try {
        const response = await axios.get(`http://localhost:5001/race/${id}`);
        setRace(response.data.race);
        setFilteredParticipants(response.data.race.participants);
      } catch (error) {
        setError(t('raceDetail.error'));
      } finally {
        setLoading(false);
      }
    };

    fetchRace();
  }, [id, t]);

  const handleSearch = (e) => {
    const query = e.target.value.toLowerCase();
    setSearchQuery(query);

    if (race) {
      const filtered = race.participants.filter((participant) => {
        const fullName = `${participant.forename.toLowerCase()} ${participant.surname.toLowerCase()}`;
        const club = participant.club.toLowerCase();
        const category = participant.category.toLowerCase();

        return (
          fullName.includes(query) ||
          club.includes(query) ||
          category.includes(query)
        );
      });

      setFilteredParticipants(filtered);
    }
  };

  const handleSort = (column) => {
    if (column === sortColumn) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleRegister = () => {
    navigate('/registration', { 
      state: { 
        preselectedRace: `${race.name} - ${race.date}` 
      } 
    });
  };

  const sortedParticipants = [...filteredParticipants].sort((a, b) => {
    const modifier = sortDirection === 'asc' ? 1 : -1;
    return a[sortColumn].localeCompare(b[sortColumn]) * modifier;
  });

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
      <div className="race-info">
        <h3><strong>{t('raceDetail.date')}:</strong> {race.date}</h3>
        <h3><strong>{t('raceDetail.startType')}:</strong> {race.start}</h3>
        <h3><strong>{t('raceDetail.description')}:</strong></h3>
        <p>{race.description}</p>
        
        {/* New Register Button */}
        <button 
          onClick={handleRegister} 
          className="register-button mt-4"
        >
          {t('raceDetail.register')}
        </button>
      </div>
      
      <div className="participants-section">
        <h2>
          {t('raceDetail.participants')} ({filteredParticipants.length})
        </h2>
        <div className="search-container">
          <input
            type="text"
            placeholder={t('raceDetail.search')}
            value={searchQuery}
            onChange={handleSearch}
          />
        </div>

        <table className="participants-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('surname')}>{t('raceDetail.columns.name')}</th>
              <th onClick={() => handleSort('club')}>{t('raceDetail.columns.club')}</th>
              <th onClick={() => handleSort('category')}>{t('raceDetail.columns.category')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedParticipants.length === 0 ? (
              <tr>
                <td colSpan="3" className="text-center">
                  {t('raceDetail.noParticipants')}
                </td>
              </tr>
            ) : (
              sortedParticipants.map((participant, index) => (
                <tr key={index}>
                  <td>{participant.forename} {participant.surname}</td>
                  <td>{participant.club}</td>
                  <td>{participant.category}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default RaceDetail;