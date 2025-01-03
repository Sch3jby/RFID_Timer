import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from '../contexts/LanguageContext';

const formatTime = (seconds) => {
  if (!seconds) return '--:--:--';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

function ResultList({ raceId }) {
  const { t } = useTranslation();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState('number');
  const [sortDirection, setSortDirection] = useState('asc');

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const response = await axios.get(`http://localhost:5001/race/${raceId}/results`);
        setResults(response.data.results);
      } catch (err) {
        setError(t('resultList.error'));
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [raceId, t]);

  const handleSearch = (e) => {
    setSearchQuery(e.target.value.toLowerCase());
  };

  const handleSort = (column) => {
    if (column === sortColumn) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const filteredResults = results.filter((result) => {
    const searchString = `${result.name} ${result.club} ${result.category} ${result.track}`.toLowerCase();
    return searchString.includes(searchQuery);
  });

  const sortedResults = [...filteredResults].sort((a, b) => {
    const modifier = sortDirection === 'asc' ? 1 : -1;
    if (sortColumn === 'number') {
      return (a[sortColumn] - b[sortColumn]) * modifier;
    }
    return String(a[sortColumn]).localeCompare(String(b[sortColumn])) * modifier;
  });

  if (loading) return <div className="loading">{t('common.loading')}</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="start-list-container">
      <h2>
        {t('resultList.title')} ({filteredResults.length})
      </h2>
      <div className="search-container">
        <input
          type="text"
          placeholder={t('resultList.search')}
          value={searchQuery}
          onChange={handleSearch}
        />
      </div>

      <table className="participants-table">
        <thead>
          <tr>
            <th onClick={() => handleSort('number')}>{t('resultList.columns.number')}</th>
            <th onClick={() => handleSort('name')}>{t('resultList.columns.name')}</th>
            <th onClick={() => handleSort('club')}>{t('resultList.columns.club')}</th>
            <th onClick={() => handleSort('category')}>{t('resultList.columns.category')}</th>
            <th onClick={() => handleSort('track')}>{t('resultList.columns.track')}</th>
            <th onClick={() => handleSort('start_time')}>{t('resultList.columns.startTime')}</th>
            <th>{t('resultList.columns.laps')}</th>
            <th>{t('resultList.columns.lastLapTime')}</th>
          </tr>
        </thead>
        <tbody>
          {sortedResults.length === 0 ? (
            <tr>
              <td colSpan="8" className="text-center">
                {t('resultList.noResults')}
              </td>
            </tr>
          ) : (
            sortedResults.map((result) => (
              <tr key={result.number}>
                <td>{result.number}</td>
                <td>{result.name}</td>
                <td>{result.club}</td>
                <td>{result.category}</td>
                <td>{result.track}</td>
                <td>{result.start_time}</td>
                <td>{result.laps.length}</td>
                <td>
                  {result.laps.length > 0 ? 
                    formatTime(result.laps[result.laps.length - 1].time) : 
                    '--:--:--'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default ResultList;