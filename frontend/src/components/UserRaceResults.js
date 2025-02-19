import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from '../contexts/LanguageContext';
import LapTimes from './LapTimes';

const formatRaceTime = (raceTime, status) => {
  if (status && ['DNF', 'DNS', 'DSQ'].includes(status.toUpperCase())) {
    return '--:--:--';
  }
  return raceTime;
};

const UserRaceResults = ({ raceId }) => {
  const { t } = useTranslation();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRacerNumber, setSelectedRacerNumber] = useState(null);
  const [lapTimesData, setLapTimesData] = useState({});
  const [lapTimesLoading, setLapTimesLoading] = useState({});

  useEffect(() => {
    const fetchUserResults = async () => {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      
      if (!token) {
        setError(t('profile.unauthorized'));
        setLoading(false);
        return;
      }
      
      try {
        const userResponse = await axios.get('http://localhost:5001/api/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        const email = userResponse.data.email;
        
        const resultsResponse = await axios.get(`http://localhost:5001/api/race/${raceId}/results/by-email/${email}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (resultsResponse.data.results && resultsResponse.data.results.length > 0) {
          const groupedResults = resultsResponse.data.results.reduce((acc, result) => {
            const key = `${result.track}-${result.category}-${result.number}`;
            
            if (!acc[key] || result.lap_number > acc[key].lap_number) {
              acc[key] = result;
            }
            
            return acc;
          }, {});
          
          const uniqueResults = Object.values(groupedResults);
          
          setResults(uniqueResults);
        } else {
          setResults([]);
        }
        
        setError('');
      } catch (err) {
        setError(err.response?.data?.error || t('profile.loadError'));
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUserResults();
  }, [raceId, t]);

  const handleViewLapTimes = async (number) => {
    setSelectedRacerNumber(number === selectedRacerNumber ? null : number);
    
    if (!lapTimesData[number] && !lapTimesLoading[number]) {
      setLapTimesLoading(prev => ({ ...prev, [number]: true }));
      try {
        const response = await axios.get(`http://localhost:5001/api/race/${raceId}/racer/${number}/laps`);
        setLapTimesData(prev => ({ 
          ...prev, 
          [number]: response.data.laps || [] 
        }));
      } catch (err) {
        console.error('Failed to fetch lap times:', err);
      } finally {
        setLapTimesLoading(prev => ({ ...prev, [number]: false }));
      }
    }
  };

  if (loading) return <div className="user-results-loading">{t('common.loading')}</div>;
  if (error) return <div className="user-results-error">{error}</div>;
  if (results.length === 0) return null;

  return (
    <div className="user-race-results">
      <div className="results-table-container">
        <table className="results-table">
          <thead>
            <tr>
              <th>{t('profile.firstname')}</th>
              <th>{t('profile.surname')}</th>
              <th>{t('profile.track')}</th>
              <th>{t('profile.category')}</th>
              <th>{t('profile.raceTime')}</th>
              <th>{t('profile.overallPosition')}</th>
              <th>{t('profile.categoryPosition')}</th>
              <th>{t('profile.lapsCompleted')}</th>
              <th>{t('profile.status')}</th>
              <th>{t('profile.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => (
              <React.Fragment key={`${result.track}-${result.category}-${result.number}`}>
                <tr className={selectedRacerNumber === result.number ? 'selected-row' : ''}>
                  <td>{result.firstname}</td>
                  <td>{result.surname}</td>
                  <td>{result.track}</td>
                  <td>{result.category !== 'N/A' ? result.category : '-'}</td>
                  <td>{formatRaceTime(result.race_time, result.status)}</td>
                  <td>
                    {result.position_track}
                    {result.behind_time_track !== '--:--:--' && (
                      <span className="behind-time"> +{result.behind_time_track}</span>
                    )}
                  </td>
                  <td>
                    {result.category !== 'N/A' && (
                      <>
                        {result.position_category}
                        {result.behind_time_category !== '--:--:--' && (
                          <span className="behind-time"> +{result.behind_time_category}</span>
                        )}
                      </>
                    )}
                  </td>
                  <td>
                    <div className="lap-progress">
                      <span>{result.lap_number} / {result.total_laps}</span>
                      <div className="progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{ width: `${(result.lap_number / result.total_laps) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>
                  <td>{result.status || '-'}</td>
                  <td>
                    <button 
                      className="lap-times-btn"
                      onClick={() => handleViewLapTimes(result.number)}
                    >
                      {selectedRacerNumber === result.number 
                        ? t('profile.hideLapTimes') 
                        : t('profile.showLapTimes')}
                    </button>
                  </td>
                </tr>
                {selectedRacerNumber === result.number && (
                  <tr className="lap-times-row">
                    <td colSpan="10">
                      <div className="lap-times-container">
                        <LapTimes 
                          lapTimes={lapTimesData[result.number] || []} 
                          loading={lapTimesLoading[result.number]} 
                        />
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserRaceResults;