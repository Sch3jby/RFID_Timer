import React from "react";
import { useTranslation } from '../contexts/LanguageContext';

function Home() {
  const { t } = useTranslation();
  return (
    <div className="home-container">
      <h1>{t('home.welcome')}</h1>
      <p>{t('home.selectOption')}</p>
    </div>
  );
}

export default Home;