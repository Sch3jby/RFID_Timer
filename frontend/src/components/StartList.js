// StartList.js
import React, { useState } from 'react';
import { useTranslation } from '../contexts/LanguageContext';

function StartList({ participants, raceId }) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState('start_time');
  const [sortDirection, setSortDirection] = useState('asc');

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
    const fullName = `${participant.forename.toLowerCase()} ${participant.surname.toLowerCase()}`;
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
    <div className="start-list-container">
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
            <th onClick={() => handleSort('number')}>{t('raceDetail.columns.number')}</th>
            <th onClick={() => handleSort('surname')}>{t('raceDetail.columns.name')}</th>
            <th onClick={() => handleSort('club')}>{t('raceDetail.columns.club')}</th>
            <th onClick={() => handleSort('category')}>{t('raceDetail.columns.category')}</th>
            <th onClick={() => handleSort('track')}>{t('raceDetail.columns.track')}</th>
            <th onClick={() => handleSort('start_time')}>{t('raceDetail.columns.startTime')}</th>
          </tr>
        </thead>
        <tbody>
          {sortedParticipants.length === 0 ? (
            <tr>
              <td colSpan="6" className="text-center">
                {t('raceDetail.noParticipants')}
              </td>
            </tr>
          ) : (
            sortedParticipants.map((participant, index) => (
              <tr key={index}>
                <td>{participant.number}</td>
                <td>{participant.forename} {participant.surname}</td>
                <td>{participant.club}</td>
                <td>{participant.category}</td>
                <td>{participant.track}</td>
                <td>{participant.start_time}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default StartList;