import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from '../api/axiosConfig';
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
  const [userRole, setUserRole] = useState(null);
  
  useEffect(() => {
    const fetchUserData = async () => {
      const token = localStorage.getItem('access_token');
      if (isLoggedIn && token) {
        try {
          const response = await axios.get('/api/me', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          setUserNickname(response.data.nickname);
          setUserRole(response.data.role);
          
          if (location.pathname === '/rfid-reader' && response.data.role !== 1) {
            navigate('/');
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          
          if (error.response?.status === 401) {
            localStorage.removeItem('access_token');
            setIsLoggedIn(false);
            navigate('/login');
          }
        }
      }
    };

    fetchUserData();
  }, [isLoggedIn, navigate, location]);
  
  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setIsLoggedIn(false);
    setUserNickname('');
    setUserRole(null);
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
        {userRole === 1 && (
          <Link 
            to="/rfid-reader" 
            className={`nav-button ${location.pathname === '/rfid-reader' ? 'active' : ''}`}
          >
            {t('nav.organizer')}
          </Link>
        )}
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
        <Link 
          to="/aboutus" 
          className={`nav-button ${location.pathname === '/aboutus' ? 'active' : ''}`}
        >
          {t('nav.aboutus')}
        </Link>
        
        <div className="user-controls">
          {isLoggedIn && userNickname && (
            <span className="user-nickname">{t('nav.welcome')} {userNickname}</span>
          )}
          {isLoggedIn && (
            <Link 
              to="/profile" 
              className={`prof-button ${location.pathname === '/profile' ? 'active' : ''}`}
            >
              {t('nav.profile')}
            </Link>
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