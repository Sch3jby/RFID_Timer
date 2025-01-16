import React from 'react';
import { useTranslation } from '../contexts/LanguageContext';

const LapTimes = ({ lapTimes, loading }) => {
  const { t } = useTranslation();

  if (loading) {
    return <div className="loading-indicator">{t('common.loading')}</div>;
  }

  return (
    <table className="lap-times-table">
      <thead>
        <tr>
          <th>{t('raceDetail.columns.lap')}</th>
          <th>{t('raceDetail.columns.lapTime')}</th>
          <th>{t('raceDetail.columns.totalTime')}</th>
        </tr>
      </thead>
      <tbody>
        {lapTimes.map((lap) => (
          <tr key={lap.lap_number}>
            <td>{lap.lap_number}</td>
            <td>{lap.lap_time}</td>
            <td>{lap.total_time}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default LapTimes;