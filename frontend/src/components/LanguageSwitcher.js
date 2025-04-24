// components/LanguageSwitcher.js
import React from 'react';
import { useTranslation } from '../contexts/LanguageContext';

/**
 * Language switching button component.
 * Toggles between Czech and English languages.
 * @returns Rendered language switching button
 */

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