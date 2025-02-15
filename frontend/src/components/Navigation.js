import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "../contexts/LanguageContext";
import LanguageSwitcher from "./LanguageSwitcher";
import logo from '../styles/other/stopwatch.png'

function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isLoggedIn, setIsLoggedIn] = useState(
    localStorage.getItem('access_token') !== null
  );
  
  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setIsLoggedIn(false);
    navigate('/');
  };
  
  const handleLogin = () => {
    navigate('/login');
  };
  
  return (
    <nav className="navigation">
      <div className="nav-container">
        <img src={logo} alt="Logo" id="logo" />
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
        
        {/* Přihlašovací/odhlašovací tlačítko */}
        <button 
          className="login-button"
          onClick={isLoggedIn ? handleLogout : handleLogin}
        >
          {isLoggedIn ? t('nav.logout') : t('nav.login')}
        </button>
      </div>
    </nav>
  );
}

export default Navigation;