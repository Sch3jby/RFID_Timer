import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from '../contexts/LanguageContext';
import LapTimes from './LapTimes';

const ResultRow = ({ result, raceId, isExpanded, onToggle }) => {
  const [lapTimes, setLapTimes] = useState([]);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const fetchLapTimes = async () => {
      if (isExpanded && !lapTimes.length) {
        setLoading(true);
        try {
          const response = await axios.get(`http://localhost:5001/race/${raceId}/racer/${result.number}/laps`);
          setLapTimes(response.data.laps);
        } catch (err) {
          console.error('Failed to fetch lap times:', err);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchLapTimes();
  }, [isExpanded, result.number, raceId]);

  return (
    <>
      <tr className="results-row">
        <td className="results-cell">{result.position_track || result.position_category}</td>
        <td className="results-cell">{result.number}</td>
        <td className="results-cell">{result.name}</td>
        <td className="results-cell">{result.club}</td>
        {result.track && <td className="results-cell">{result.category}</td>}
        <td className="results-cell">
          {result.status ? '--:--:--' : result.race_time}
        </td>
        <td className="results-cell">
          {result.status ? '--:--:--' : (result.behind_time_track || result.behind_time_category)}
        </td>
        <td className="results-cell">
          <button 
            onClick={onToggle}
            className="expand-button"
            aria-label={isExpanded ? 'Hide lap times' : 'Show lap times'}
          >
            {isExpanded ? '▲' : '▼'}
          </button>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan="8" className="expanded-content">
            <LapTimes 
              lapTimes={lapTimes} 
              loading={loading} 
            />
          </td>
        </tr>
      )}
    </>
  );
};

const ResultList = ({ raceId }) => {
  const { t } = useTranslation();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState('category');
  const [expandedRunner, setExpandedRunner] = useState(null);

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

  const handleRowToggle = (number) => {
    setExpandedRunner(expandedRunner === number ? null : number);
  };

  const filteredResults = results.filter((result) => {
    const searchString = `${result.name.toLowerCase()} ${result.club.toLowerCase()} ${result.category.toLowerCase()} ${result.track.toLowerCase()}`;
    return searchString.includes(searchQuery);
  });

  const groupByTrack = (results) => {
    return Object.entries(
      results.reduce((acc, result) => {
        if (!acc[result.track]) {
          acc[result.track] = [];
        }
        acc[result.track].push(result);
        return acc;
      }, {})
    ).map(([track, trackResults]) => ({
      track,
      results: trackResults.sort((a, b) => a.position - b.position)
    }));
  };

  const groupByCategory = (results) => {
    return Object.entries(
      results.reduce((acc, result) => {
        if (!acc[result.category]) {
          acc[result.category] = [];
        }
        acc[result.category].push(result);
        return acc;
      }, {})
    ).map(([category, categoryResults]) => {
      const groupedByTrack = Object.entries(
        categoryResults.reduce((acc, result) => {
          if (!acc[result.track]) {
            acc[result.track] = [];
          }
          acc[result.track].push(result);
          return acc;
        }, {})
      ).map(([track, trackResults]) => ({
        track,
        results: trackResults.sort((a, b) => a.position - b.position)
      }));

      return {
        category,
        tracks: groupedByTrack
      };
    });
  };

  const groupedResults = groupBy === 'category' 
    ? groupByCategory(filteredResults)
    : groupByTrack(filteredResults);

  if (loading) return <div className="results-loading">{t('common.loading')}</div>;
  if (error) return <div className="results-error">{error}</div>;

  return (
    <div className="results-page">
      <div className="results-header">
        <h2 className="results-title">
          {t('raceDetail.resultList')}
        </h2>
        
        <div className="results-controls">
          <div className="view-toggle">
            <button
              className={`view-toggle-button ${groupBy === 'category' ? 'active' : ''}`}
              onClick={() => setGroupBy('category')}
            >
              {t('raceDetail.groupByCategory')}
            </button>
            <button
              className={`view-toggle-button ${groupBy === 'track' ? 'active' : ''}`}
              onClick={() => setGroupBy('track')}
            >
              {t('raceDetail.groupByTrack')}
            </button>
          </div>
          
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

      <div className="results-content">
        {groupBy === 'track' ? (
          <div className="track-results">
            {groupedResults.map(({ track, results }) => (
              <div key={track} className="track-section">
                <h3 className="track-title">{track}</h3>
                <div className="results-table-wrapper">
                  <table className="results-table">
                    <thead>
                      <tr>
                        <th className="results-cell">{t('raceDetail.columns.position')}</th>
                        <th className="results-cell">{t('raceDetail.columns.number')}</th>
                        <th className="results-cell">{t('raceDetail.columns.name')}</th>
                        <th className="results-cell">{t('raceDetail.columns.club')}</th>
                        <th className="results-cell">{t('raceDetail.columns.category')}</th>
                        <th className="results-cell">{t('raceDetail.columns.totalTime')}</th>
                        <th className="results-cell">{t('raceDetail.columns.behindTime')}</th>
                        <th className="results-cell"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((result) => (
                        <ResultRow
                          key={result.number}
                          result={result}
                          raceId={raceId}
                          isExpanded={expandedRunner === result.number}
                          onToggle={() => handleRowToggle(result.number)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="category-results">
            {groupedResults.map(({ category, tracks }) => (
              <div key={category} className="category-section">
                <h3 className="category-title">{category}</h3>
                {tracks.map(({ track, results }) => (
                  <div key={`${category}-${track}`} className="track-subsection">
                    <h4 className="track-subtitle">{track}</h4>
                    <div className="results-table-wrapper">
                      <table className="results-table">
                        <thead>
                          <tr>
                            <th className="results-cell">{t('raceDetail.columns.position')}</th>
                            <th className="results-cell">{t('raceDetail.columns.number')}</th>
                            <th className="results-cell">{t('raceDetail.columns.name')}</th>
                            <th className="results-cell">{t('raceDetail.columns.club')}</th>
                            <th className="results-cell">{t('raceDetail.columns.category')}</th>
                            <th className="results-cell">{t('raceDetail.columns.totalTime')}</th>
                            <th className="results-cell">{t('raceDetail.columns.behindTime')}</th>
                            <th className="results-cell"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.map((result) => (
                            <ResultRow
                              key={result.number}
                              result={result}
                              raceId={raceId}
                              isExpanded={expandedRunner === result.number}
                              onToggle={() => handleRowToggle(result.number)}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {filteredResults.length === 0 && (
          <div className="no-results">
            {t('raceDetail.noResults')}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultList;