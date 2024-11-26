import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "../contexts/LanguageContext";
import LanguageSwitcher from "./LanguageSwitcher";

function Navigation() {
  const location = useLocation();
  const { t } = useTranslation();
  
  return (
    <nav className="navigation">
      <div className="nav-container">
        <Link 
          to="/" 
          className={`nav-button ${location.pathname === '/' ? 'active' : ''}`}
        >
          {t('nav.home')}
        </Link>
        <Link 
          to="/rfid-reader" 
          className={`nav-button ${location.pathname === '/rfid-reader' ? 'active' : ''}`}
        >
          {t('nav.organizer')}
        </Link>
        <Link 
          to="/registration" 
          className={`nav-button ${location.pathname === '/registration' ? 'active' : ''}`}
        >
          {t('nav.competitor')}
        </Link>
        <Link 
          to="/calendar" 
          className={`nav-button ${location.pathname === '/calendar' ? 'active' : ''}`}
        >
          {t('nav.calendar')}
        </Link>
        <LanguageSwitcher />
      </div>
    </nav>
  );
}

export default Navigation;