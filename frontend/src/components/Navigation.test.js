import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Navigation from './Navigation';
import { LanguageProvider } from '../contexts/LanguageContext';
import axios from '../api/axiosConfig';

// Mock assets
jest.mock('../styles/other/stopwatch.png', () => 'stopwatch.png', { virtual: true });

// Mock axios
jest.mock('../api/axiosConfig', () => {
  return {
    get: jest.fn()
  };
});

// Mock useLocation and useNavigate
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useLocation: () => ({ pathname: '/' }),
  useNavigate: () => jest.fn()
}));

// Mock the translations module
jest.mock('../locales/translations', () => ({
  translations: {
    cs: {
      nav: {
        home: 'Domů',
        organizer: 'Organizátor',
        competitor: 'Registrace',
        calendar: 'Kalendář závodů',
        aboutus: 'O nás',
        login: 'Přihlásit se',
        logout: 'Odhlásit se',
        welcome: 'Vítejte zpět,',
        profile: 'Profil'
      }
    },
    en: {
      nav: {
        home: 'Home',
        organizer: 'Organizer',
        competitor: 'Registration',
        calendar: 'Race calendar',
        aboutus: 'About Us',
        login: 'Login',
        logout: 'Logout',
        welcome: 'Welcome back,',
        profile: 'Profile'
      }
    }
  }
}));

describe('Navigation Component', () => {
  beforeEach(() => {
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(() => null),
        setItem: jest.fn(),
        removeItem: jest.fn()
      },
      writable: true
    });
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  test('renders navigation with correct links when logged out', () => {
    // Force Czech language for this test to match the actual implementation
    render(
      <LanguageProvider>
        <BrowserRouter>
          <Navigation />
        </BrowserRouter>
      </LanguageProvider>
    );
    
    // Get the desktop navigation links - be more specific with container to avoid duplicates
    const desktopNav = screen.getByRole('navigation').querySelector('.desktop-nav');
    
    // Verify link texts exist within desktop nav
    expect(desktopNav).toHaveTextContent('Domů');
    expect(desktopNav).toHaveTextContent('Registrace');
    expect(desktopNav).toHaveTextContent('Kalendář závodů');
    expect(desktopNav).toHaveTextContent('O nás');
    
    // Check for login button
    const loginButtons = screen.getAllByText('Přihlásit se');
    expect(loginButtons[0]).toBeInTheDocument();
  });

  test('shows user nickname when logged in', async () => {
    // Mock localStorage to return a token
    window.localStorage.getItem.mockImplementation((key) => {
      if (key === 'access_token') return 'fake-token';
      return null;
    });
    
    // Mock successful API response
    axios.get.mockResolvedValue({ 
      data: { 
        nickname: 'TestUser', 
        role: 0
      } 
    });
    
    render(
      <LanguageProvider>
        <BrowserRouter>
          <Navigation />
        </BrowserRouter>
      </LanguageProvider>
    );
    
    // Wait for the nickname to appear (in Czech)
    const nicknames = await screen.findAllByText((content) => {
      return content.includes('TestUser');
    });
    
    // Verify we found at least one
    expect(nicknames.length).toBeGreaterThan(0);
  });

  test('handles logout correctly', () => {
    // Mock localStorage to return a token
    window.localStorage.getItem.mockImplementation((key) => {
      if (key === 'access_token') return 'fake-token';
      return null;
    });
    
    // Mock successful API response
    axios.get.mockResolvedValue({ 
      data: { 
        nickname: 'TestUser', 
        role: 0
      } 
    });
    
    render(
      <LanguageProvider>
        <BrowserRouter>
          <Navigation />
        </BrowserRouter>
      </LanguageProvider>
    );
    
    // Find and click the logout button using getAllByText (to handle multiple matches)
    const logoutButtons = screen.getAllByText('Odhlásit se');
    
    // Use act to wrap the state update
    act(() => {
      logoutButtons[0].click(); // Click the first one (desktop view)
    });
    
    // Check that localStorage.removeItem was called with the correct arguments
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('access_token');
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('user');
  });
});