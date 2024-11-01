import React from 'react';
import { useTranslation } from '../contexts/LanguageContext';

function LanguageSwitcher() {
  const { language, toggleLanguage } = useTranslation();

  return (
    <button 
      onClick={toggleLanguage}
      className="language-switcher"
    >
      {language.toUpperCase()}
    </button>
  );
}

export default LanguageSwitcher;