// ResultList.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from '../contexts/LanguageContext';

function ResultList({ raceId }) {
  const { t } = useTranslation();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState('race_time');
  const [sortDirection, setSortDirection] = useState('asc');

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const response = await axios.get(`http://localhost:5001/race/${raceId}/results`);
        setResults(response.data.results);
      } catch (err) {
        setError(t('raceDetail.error'));
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [raceId, t]);

  const handleSearch = (e) => {
    const query = e.target.value.toLowerCase();
    setSearchQuery(query);
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
    const searchString = `${result.name.toLowerCase()} ${result.club.toLowerCase()} ${result.category.toLowerCase()} ${result.track.toLowerCase()}`;
    return searchString.includes(searchQuery);
  });

  const sortedResults = [...filteredResults].sort((a, b) => {
    const modifier = sortDirection === 'asc' ? 1 : -1;
    
    if (sortColumn === 'position') {
      return (filteredResults.indexOf(a) - filteredResults.indexOf(b)) * modifier;
    }
    
    if (sortColumn === 'number') {
      return (a.number - b.number) * modifier;
    }
    
    const aValue = a[sortColumn] || '';
    const bValue = b[sortColumn] || '';
    return String(aValue).localeCompare(String(bValue)) * modifier;
  });

  if (loading) return <div className="loading">{t('common.loading')}</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="start-list-container">
      <h2>
        {t('raceDetail.resultList')} ({filteredResults.length})
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
            <th onClick={() => handleSort('position')}>{t('raceDetail.columns.position')}</th>
            <th onClick={() => handleSort('number')}>{t('raceDetail.columns.number')}</th>
            <th onClick={() => handleSort('name')}>{t('raceDetail.columns.name')}</th>
            <th onClick={() => handleSort('club')}>{t('raceDetail.columns.club')}</th>
            <th onClick={() => handleSort('category')}>{t('raceDetail.columns.category')}</th>
            <th onClick={() => handleSort('track')}>{t('raceDetail.columns.track')}</th>
            <th onClick={() => handleSort('race_time')}>{t('raceDetail.columns.totalTime')}</th>
            <th onClick={() => handleSort('behind_time')}>{t('raceDetail.columns.behindTime')}</th>
          </tr>
        </thead>
        <tbody>
          {sortedResults.length === 0 ? (
            <tr>
              <td colSpan="8" className="text-center">
                {t('raceDetail.noResults')}
              </td>
            </tr>
          ) : (
            sortedResults.map((result) => (
              <tr key={result.number}>
                <td>{result.position}</td>
                <td>{result.number}</td>
                <td>{result.name}</td>
                <td>{result.club}</td>
                <td>{result.category}</td>
                <td>{result.track}</td>
                <td>{result.race_time}</td>
                <td>{result.behind_time}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default ResultList;