// components/Navigation.js
import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from '../api/axiosConfig';
import { useTranslation } from "../contexts/LanguageContext";
import LanguageSwitcher from "./LanguageSwitcher";
import logo from '../styles/other/stopwatch.png'

/**
 * Main navigation component.
 * Displays navigation links based on user role and authentication status.
 * Handles responsive menu behavior and scrolling effects.
 * @returns Rendered navigation with links and user controls
 */

function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isLoggedIn, setIsLoggedIn] = useState(
    localStorage.getItem('access_token') !== null
  );
  const [userNickname, setUserNickname] = useState('');
  const [userRole, setUserRole] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNavHidden, setIsNavHidden] = useState(false);
  const lastScrollY = useRef(0);
  
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
  
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        setIsNavHidden(true);
      } else {
        setIsNavHidden(false);
      }
      
      lastScrollY.current = currentScrollY;
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);
  
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
  
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };
  
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location]);
  
  return (
    <nav className={`navigation ${isNavHidden ? 'nav-hidden' : ''}`}>
      <div className="nav-container">
        <img src={logo} alt="Logo" id="logo" />
        
        <div className="desktop-nav">
          <div className="nav-links">
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
          </div>
          
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
            <LanguageSwitcher />
          </div>
        </div>
        
        <button 
          className={`hamburger ${isMenuOpen ? 'active' : ''}`}
          onClick={toggleMenu}
          aria-label="Toggle navigation menu"
        >
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
        </button>
        
        {/* Mobile Menu */}
        <div className={`mobile-menu ${isMenuOpen ? 'active' : ''}`}>
          <div className="mobile-nav-links">
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
            
            <div className="mobile-user-info">
              {isLoggedIn && userNickname && (
                <span className="user-nickname">{t('nav.welcome')} {userNickname}</span>
              )}
              <div className="mobile-language-switcher">
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navigation;