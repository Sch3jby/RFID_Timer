// contexts/LanguageContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import { translations } from '../locales/translations';

/**
 * Language context provider for application translations.
 * Manages language state and provides translation function.
 * 
 * @param {React.ReactNode} children - Child components that will have access to language context
 * @returns Language context provider with translation capabilities
 */

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    const savedLanguage = localStorage.getItem('selectedLanguage');
    return savedLanguage || 'cs';
  });

  const toggleLanguage = () => {
    setLanguage(prev => {
      const newLanguage = prev === 'cs' ? 'en' : 'cs';
      localStorage.setItem('selectedLanguage', newLanguage);
      return newLanguage;
    });
  };

  const t = (key) => {
    const keys = key.split('.');
    let value = translations[language];
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

/**
 * Hook for accessing language context and translations.
 * Provides language state, toggle function, and translation function.
 * @returns {Object} Language context with language state and translation functions
 */

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}