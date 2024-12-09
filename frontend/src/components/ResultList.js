// ResultList.js
import React, { useState } from 'react';
import { useTranslation } from '../contexts/LanguageContext';

function ResultList({ participants, raceId }) {
  const { t } = useTranslation();


  return (
    <div className="result-list-container">
      <h2>{t('raceDetail.resultList')}</h2>
      <p>{t('raceDetail.resultsNotImplemented')}</p>
    </div>
  );
}

export default ResultList;