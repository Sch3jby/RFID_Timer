import React, { useState, useEffect } from "react";
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
  const [userNickname, setUserNickname] = useState('');
  
  useEffect(() => {
    const fetchUserData = async () => {
      const token = localStorage.getItem('access_token');
      if (isLoggedIn && token) {
        try {
          const response = await fetch('http://localhost:5001/api/me', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const userData = await response.json();
            setUserNickname(userData.nickname);
          } else {
            console.error('Failed to fetch user data:', await response.text());
            if (response.status === 401) {
              localStorage.removeItem('access_token');
              setIsLoggedIn(false);
              navigate('/login');
            }
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      }
    };

    fetchUserData();
  }, [isLoggedIn, navigate]);
  
  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setIsLoggedIn(false);
    setUserNickname('');
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
        
        <div className="user-controls">
          {isLoggedIn && userNickname && (
            <span className="user-nickname">{t('nav.welcome')} {userNickname}</span>
          )}
          <button 
            className="login-button"
            onClick={isLoggedIn ? handleLogout : handleLogin}
          >
            {isLoggedIn ? t('nav.logout') : t('nav.login')}
          </button>
        </div>
        <LanguageSwitcher />
      </div>
    </nav>
  );
}

export default Navigation;