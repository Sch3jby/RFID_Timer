// components/StartList.js
import React, { useState, useEffect } from 'react';
import { useTranslation } from '../contexts/LanguageContext';

/**
 * Component for displaying race start list.
 * Supports searching and sorting participants.
 * 
 * @param {Array} participants - List of race participants
 * @param {number} raceId - ID of the race
 * @returns Rendered start list with sorting and filtering
 */

function StartList({ participants, raceId }) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState('start_time');
  const [sortDirection, setSortDirection] = useState('asc');

  useEffect(() => {
    const handleBeforePrint = () => {
      const dateElements = document.querySelectorAll('.results-page');
      const currentDate = new Date().toLocaleString();
      
      dateElements.forEach(el => {
        el.setAttribute('data-print-date', currentDate);
      });
    };
    
    window.addEventListener('beforeprint', handleBeforePrint);
    
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
    };
  }, []);

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

  const filteredParticipants = participants.filter((participant) => {
    const fullName = `${participant.firstname.toLowerCase()} ${participant.surname.toLowerCase()}`;
    const club = participant.club.toLowerCase();
    const category = participant.category.toLowerCase();
    const track = participant.track.toLowerCase();

    return (
      fullName.includes(searchQuery) ||
      club.includes(searchQuery) ||
      category.includes(searchQuery) ||
      track.includes(searchQuery)
    );
  });

  const sortedParticipants = [...filteredParticipants].sort((a, b) => {
    const modifier = sortDirection === 'asc' ? 1 : -1;
    return a[sortColumn].localeCompare(b[sortColumn]) * modifier;
  });

  return (
    <div className="results-page">
      <div className="results-header">
        <h2 className="results-title">
          {t('raceDetail.participants')} ({filteredParticipants.length})
        </h2>
        
        <div className="results-controls">
          <div className="search-box">
            <input
              type="text"
              placeholder={t('raceDetail.search')}
              value={searchQuery}
              onChange={handleSearch}
              className="search-input"
            />
          </div>
        </div>
      </div>

      <div className="track-section">
        <div className="results-table-wrapper">
          <table className="results-table">
            <thead>
              <tr>
                <th className="results-cell" onClick={() => handleSort('number')}>
                  {t('raceDetail.columns.number')}
                </th>
                <th className="results-cell" onClick={() => handleSort('surname')}>
                  {t('raceDetail.columns.name')}
                </th>
                <th className="results-cell" onClick={() => handleSort('club')}>
                  {t('raceDetail.columns.club')}
                </th>
                <th className="results-cell" onClick={() => handleSort('category')}>
                  {t('raceDetail.columns.category')}
                </th>
                <th className="results-cell" onClick={() => handleSort('track')}>
                  {t('raceDetail.columns.track')}
                </th>
                <th className="results-cell" onClick={() => handleSort('start_time')}>
                  {t('raceDetail.columns.startTime')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedParticipants.length === 0 ? (
                <tr>
                  <td colSpan="6" className="results-cell text-center">
                    {t('raceDetail.noParticipants')}
                  </td>
                </tr>
              ) : (
                sortedParticipants.map((participant, index) => (
                  <tr key={index} className="results-row">
                    <td className="results-cell">{participant.number}</td>
                    <td className="results-cell">{participant.firstname} {participant.surname}</td>
                    <td className="results-cell">{participant.club}</td>
                    <td className="results-cell">{participant.category}</td>
                    <td className="results-cell">{participant.track}</td>
                    <td className="results-cell">{participant.start_time}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default StartList;