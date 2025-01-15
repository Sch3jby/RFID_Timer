// LapTimes.js
import React from 'react';
import { useTranslation } from '../contexts/LanguageContext';

const LapTimes = ({ lapTimes, onClose }) => {
  const { t } = useTranslation();

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3 className="modal-title">
            {t('raceDetail.lapTimes')}
          </h3>
          <button 
            onClick={onClose}
            className="close-button"
          >
            ✕
          </button>
        </div>

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
      </div>
    </div>
  );
};

export default LapTimes;