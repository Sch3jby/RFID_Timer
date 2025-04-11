import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ProfilePage from './ProfilePage';
import axios from '../api/axiosConfig';

// Mock the axios instance
jest.mock('../api/axiosConfig', () => ({
  get: jest.fn()
}));

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

// Mock useTranslation hook
jest.mock('../contexts/LanguageContext', () => ({
  useTranslation: () => ({
    t: (key) => {
      // Mock překlady přímo v testu
      const translations = {
        'common.loading': 'Načítání',
        'profile.title': 'Můj profil',
        'profile.email': 'Email',
        'profile.yourRegistrations': 'Vaše přihlášky',
        'profile.noRegistrations': 'Nemáte žádné přihlášky',
        'profile.unauthorized': 'Neautorizovaný přístup',
        'profile.loadError': 'Nepodařilo se načíst data profilu',
        'profile.results': 'výsledky',
        'profile.yourResults': 'Vaše výsledky',
        'profile.laps': 'Počet kol',
        'profile.firstname': 'Jméno',
        'profile.surname': 'Příjmení',
        'profile.race': 'Závod',
        'profile.date': 'Datum',
        'profile.track': 'Trať'
      };
      return translations[key] || key;
    },
    language: 'cs',
    toggleLanguage: jest.fn()
  }),
  LanguageProvider: ({ children }) => <>{children}</> // Nepotřebujeme skutečný provider, protože mockujeme hook
}));

// Mock UserRaceResults component
jest.mock('./UserRaceResults', () => () => <div data-testid="user-race-results">Race Results Component</div>);

describe('ProfilePage Component', () => {
  beforeEach(() => {
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(() => 'fake-token'),
        setItem: jest.fn(),
        removeItem: jest.fn()
      },
      writable: true
    });
    
    // Reset mocks
    jest.clearAllMocks();
  });

  test('displays loading state initially', () => {
    // Mock API call but don't resolve it yet
    axios.get.mockImplementationOnce(() => new Promise(() => {}));
    
    render(
      <BrowserRouter>
        <ProfilePage />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Načítání')).toBeInTheDocument();
  });

  test('displays user profile and registrations after successful API call', async () => {
    // Mock successful API responses for both calls
    axios.get.mockImplementation((url) => {
      if (url === '/api/me') {
        return Promise.resolve({
          data: {
            email: 'test@example.com',
            firstname: 'Jan',
            surname: 'Schejbal',
            nickname: 'JanS'
          }
        });
      } else if (url === '/api/me/registrations') {
        return Promise.resolve({
          data: {
            user: {
              email: 'test@example.com',
              firstname: 'Jan',
              surname: 'Schejbal',
              nickname: 'JanS'
            },
            registrations: [
              {
                registration_id: 1,
                user: {
                  firstname: 'Jan',
                  surname: 'Schejbal'
                },
                race: {
                  id: 1,
                  name: 'Spring Marathon',
                  date: '2025-05-01'
                },
                track: {
                  name: 'Track 1',
                  distance: 10,
                  number_of_laps: 2
                }
              }
            ]
          }
        });
      }
      return Promise.reject(new Error('Unexpected URL'));
    });
    
    render(
      <BrowserRouter>
        <ProfilePage />
      </BrowserRouter>
    );
    
    // Wait for data to load and test content
    await waitFor(() => {
      // Check user info is displayed
      expect(screen.getByText(/Jan Schejbal \(JanS\)/i)).toBeInTheDocument();
    });
    
    // Check headings
    expect(screen.getByText('Můj profil')).toBeInTheDocument();
    expect(screen.getByText('Vaše přihlášky')).toBeInTheDocument();
    
    // Check registration is displayed
    expect(screen.getByText('Spring Marathon')).toBeInTheDocument();
    // Use function matcher for text that may be broken across elements
    expect(screen.getByText((content) => {
      return content.includes('Track 1') && 
             content.includes('10') && 
             content.includes('Počet kol') && 
             content.includes('2');
    })).toBeInTheDocument();
  });

  test('shows message when no registrations are found', async () => {
    // Mock API responses with empty registrations
    axios.get.mockImplementation((url) => {
      if (url === '/api/me') {
        return Promise.resolve({
          data: {
            email: 'test@example.com',
            firstname: 'Jan',
            surname: 'Schejbal',
            nickname: 'JanS'
          }
        });
      } else if (url === '/api/me/registrations') {
        return Promise.resolve({
          data: {
            user: {
              email: 'test@example.com',
              firstname: 'Jan',
              surname: 'Schejbal',
              nickname: 'JanS'
            },
            registrations: []
          }
        });
      }
      return Promise.reject(new Error('Unexpected URL'));
    });
    
    render(
      <BrowserRouter>
        <ProfilePage />
      </BrowserRouter>
    );
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText(/Jan Schejbal \(JanS\)/i)).toBeInTheDocument();
    });
    
    // Check "no registrations" message is displayed
    expect(screen.getByText('Nemáte žádné přihlášky')).toBeInTheDocument();
  });

  test('redirects to login on unauthorized error', async () => {
    // Mock localStorage to return null token to simulate the case where the token check fails
    window.localStorage.getItem.mockReturnValue(null);
    
    render(
      <BrowserRouter>
        <ProfilePage />
      </BrowserRouter>
    );
    
    // Wait for navigation to occur
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  test('handles unauthorized API error', async () => {
    // Mock API to throw 401 error
    axios.get.mockRejectedValueOnce({
      response: {
        status: 401,
        data: {
          message: 'Unauthorized'
        }
      }
    });
    
    render(
      <BrowserRouter>
        <ProfilePage />
      </BrowserRouter>
    );
    
    // Wait for error handling
    await waitFor(() => {
      expect(localStorage.removeItem).toHaveBeenCalledWith('access_token');
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  test('displays error message on API error', async () => {
    // Mock API to throw a general error
    axios.get.mockRejectedValueOnce({
      response: {
        status: 500,
        data: {
          message: 'Server error'
        }
      }
    });
    
    render(
      <BrowserRouter>
        <ProfilePage />
      </BrowserRouter>
    );
    
    // Wait for error message to be displayed
    await waitFor(() => {
      expect(screen.getByText('Nepodařilo se načíst data profilu')).toBeInTheDocument();
    });
  });

  test('groups registrations by unique races for results display', async () => {
    // Mock API with multiple registrations for the same race
    axios.get.mockImplementation((url) => {
      if (url === '/api/me') {
        return Promise.resolve({
          data: {
            email: 'test@example.com',
            firstname: 'Jan',
            surname: 'Schejbal',
            nickname: 'JanS'
          }
        });
      } else if (url === '/api/me/registrations') {
        return Promise.resolve({
          data: {
            user: {
              email: 'test@example.com',
              firstname: 'Jan',
              surname: 'Schejbal',
              nickname: 'JanS'
            },
            registrations: [
              {
                registration_id: 1,
                user: {
                  firstname: 'Jan',
                  surname: 'Schejbal'
                },
                race: {
                  id: 1,
                  name: 'Spring Marathon',
                  date: '2025-05-01'
                },
                track: {
                  name: 'Track 1',
                  distance: 10,
                  number_of_laps: 2
                }
              },
              {
                registration_id: 2,
                user: {
                  firstname: 'Jan',
                  surname: 'Schejbal'
                },
                race: {
                  id: 1, // Same race ID
                  name: 'Spring Marathon',
                  date: '2025-05-01'
                },
                track: {
                  name: 'Track 2',
                  distance: 5,
                  number_of_laps: 1
                }
              }
            ]
          }
        });
      }
      return Promise.reject(new Error('Unexpected URL'));
    });
    
    render(
      <BrowserRouter>
        <ProfilePage />
      </BrowserRouter>
    );
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText(/Jan Schejbal \(JanS\)/i)).toBeInTheDocument();
    });
    
    // Check for results section using a more flexible approach
    const heading = screen.getByText((content, element) => {
      return element.tagName.toLowerCase() === 'h3' && 
             content.includes('Spring Marathon') && 
             content.includes('výsledky');
    });
    expect(heading).toBeInTheDocument();
    
    // Check that the results component is rendered
    expect(screen.getByTestId('user-race-results')).toBeInTheDocument();
  });
});