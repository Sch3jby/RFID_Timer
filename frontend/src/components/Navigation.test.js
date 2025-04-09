// src/components/Navigation.test.js
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Navigation from './Navigation';
import axios from 'axios';

// Mock axios
jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  create: jest.fn().mockReturnValue({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn(), eject: jest.fn() },
      response: { use: jest.fn(), eject: jest.fn() }
    }
  })
}));

// Mock the translation context
jest.mock('../contexts/LanguageContext', () => ({
  useTranslation: () => ({
    t: (key) => {
      const translations = {
        'nav.home': 'Home',
        'nav.organizer': 'Organizer',
        'nav.competitor': 'Registration',
        'nav.calendar': 'Race calendar',
        'nav.aboutus': 'About Us',
        'nav.login': 'Login',
        'nav.logout': 'Logout',
        'nav.profile': 'Profile',
        'nav.welcome': 'Welcome back,'
      };
      return translations[key] || key;
    }
  }),
  useContext: () => ({
    language: 'en',
    toggleLanguage: jest.fn()
  })
}));

// Mock the language switcher component
jest.mock('../components/LanguageSwitcher', () => {
  return function DummyLanguageSwitcher() {
    return <button>Language</button>;
  };
});

// Mock navigate function
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/' })
}));

describe('Navigation Component', () => {
  beforeEach(() => {
    // Clear mocks before each test
    jest.clearAllMocks();
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn()
      },
      writable: true
    });
  });

  it('renders navigation elements when user is not logged in', () => {
    // Mock localStorage.getItem to return null for access_token
    localStorage.getItem.mockReturnValue(null);
    
    render(
      <BrowserRouter>
        <Navigation />
      </BrowserRouter>
    );
    
    // Check if basic navigation links are rendered
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Registration')).toBeInTheDocument();
    expect(screen.getByText('Race calendar')).toBeInTheDocument();
    expect(screen.getByText('About Us')).toBeInTheDocument();
    
    // Check if login button is rendered
    expect(screen.getByText('Login')).toBeInTheDocument();
    
    // Organizer link should not be visible when not logged in as admin
    expect(screen.queryByText('Organizer')).not.toBeInTheDocument();
  });

  it('renders user-specific elements when user is logged in', async () => {
    // Mock localStorage.getItem to return a token
    localStorage.getItem.mockImplementation((key) => {
      if (key === 'access_token') return 'fake-token';
      return null;
    });
    
    // Mock the API response for user data
    axios.get.mockResolvedValueOnce({
      data: {
        nickname: 'TestUser',
        role: 0 // Non-admin role
      }
    });
    
    render(
      <BrowserRouter>
        <Navigation />
      </BrowserRouter>
    );
    
    // Wait for the user data to be loaded
    await waitFor(() => {
      // Welcome message with username should be visible
      expect(screen.getByText(/Welcome back, TestUser/)).toBeInTheDocument();
      
      // Profile link should be visible
      expect(screen.getByText('Profile')).toBeInTheDocument();
      
      // Logout button should be visible
      expect(screen.getByText('Logout')).toBeInTheDocument();
      
      // Organizer link should still not be visible for non-admin
      expect(screen.queryByText('Organizer')).not.toBeInTheDocument();
    });
  });

  it('renders admin-specific elements when admin is logged in', async () => {
    localStorage.getItem.mockImplementation((key) => {
      if (key === 'access_token') return 'fake-token';
      return null;
    });
    
    axios.get.mockResolvedValueOnce({
      data: {
        nickname: 'AdminUser',
        role: 1
      }
    });
    
    render(
      <BrowserRouter>
        <Navigation />
      </BrowserRouter>
    );
    
    // Wait for the user data to be loaded
    await waitFor(() => {
      // Welcome message with username should be visible
      expect(screen.getByText(/Welcome back, AdminUser/)).toBeInTheDocument();
      
      // Organizer link should be visible for admin
      expect(screen.getByText('Organizer')).toBeInTheDocument();
    });
  });

  it('handles logout correctly', async () => {
    localStorage.getItem.mockImplementation((key) => {
      if (key === 'access_token') return 'fake-token';
      return null;
    });
    
    axios.get.mockResolvedValueOnce({
      data: {
        nickname: 'TestUser',
        role: 0
      }
    });
    
    render(
      <BrowserRouter>
        <Navigation />
      </BrowserRouter>
    );
    
    // Wait for the user data to be loaded
    await waitFor(() => {
      expect(screen.getByText(/Welcome back, TestUser/)).toBeInTheDocument();
    });
    
    // Click the logout button
    fireEvent.click(screen.getByText('Logout'));
    
    // Check if localStorage items were removed
    expect(localStorage.removeItem).toHaveBeenCalledWith('access_token');
    expect(localStorage.removeItem).toHaveBeenCalledWith('user');
    
    // Check if navigation happened
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('shows and hides mobile menu when hamburger is clicked', async () => {
    localStorage.getItem.mockReturnValue(null);
    
    render(
      <BrowserRouter>
        <Navigation />
      </BrowserRouter>
    );
    
    // The mobile menu should be hidden
    expect(screen.queryByRole('button', { name: 'Home' })).not.toBeInTheDocument();
    
    const hamburgerButton = screen.getByLabelText('Toggle navigation menu');
    
    // Click the hamburger button to open the menu
    fireEvent.click(hamburgerButton);
    
    // Check if mobile menu is now visible
    await waitFor(() => {
      // In the mobile menu, navigation items are buttons
      const mobileMenu = document.querySelector('.mobile-menu.active');
      expect(mobileMenu).toBeInTheDocument();
    });
    
    // Click the hamburger button again to close the menu
    fireEvent.click(hamburgerButton);
    
    // Check if mobile menu is hidden again
    await waitFor(() => {
      const mobileMenu = document.querySelector('.mobile-menu.active');
      expect(mobileMenu).not.toBeInTheDocument();
    });
  });
});