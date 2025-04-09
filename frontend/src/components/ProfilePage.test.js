// src/components/ProfilePage.test.js
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import ProfilePage from './ProfilePage';
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

// Mock UserRaceResults component
jest.mock('../components/UserRaceResults', () => {
  return function MockUserRaceResults({ raceId }) {
    return <div data-testid={`race-results-${raceId}`}>Race Results for Race {raceId}</div>;
  };
});

// Mock navigate function
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

// Mock the translation context
jest.mock('../contexts/LanguageContext', () => ({
  useTranslation: () => ({
    t: (key) => {
      const translations = {
        'profile.title': 'My profile',
        'profile.email': 'Email',
        'profile.yourRegistrations': 'Your registrations',
        'profile.firstname': 'Firstname',
        'profile.surname': 'Surname',
        'profile.race': 'Race',
        'profile.date': 'Date',
        'profile.track': 'Track',
        'profile.laps': 'Number of laps',
        'profile.results': 'results',
        'profile.unauthorized': 'Unauthorized',
        'profile.loadError': 'Failed to load profile data',
        'profile.noRegistrations': 'No registrations found',
        'common.loading': 'Loading'
      };
      return translations[key] || key;
    }
  })
}));

describe('ProfilePage Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn().mockReturnValue('fake-token'),
        setItem: jest.fn(),
        removeItem: jest.fn()
      },
      writable: true
    });
  });

  it('redirects to login if no token is available', async () => {
    localStorage.getItem.mockReturnValueOnce(null);
    
    render(<ProfilePage />);
    
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  it('shows loading state initially', () => {
    axios.get.mockImplementationOnce(() => new Promise(resolve => {
      setTimeout(() => {
        resolve({
          data: {
            user: { firstname: 'Jan', surname: 'Schejbal', nickname: 'JanS', email: 'Jan@example.com' },
            registrations: []
          }
        });
      }, 100);
    }));
    
    render(<ProfilePage />);
    
    // Should show loading initially
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  it('displays user profile and registrations after successful API call', async () => {
    const mockUser = { 
      firstname: 'Jan', 
      surname: 'Schejbal', 
      nickname: 'JanS', 
      email: 'Jan@example.com' 
    };
    
    const mockRegistrations = [
      {
        registration_id: 1,
        user: { firstname: 'Jan', surname: 'Schejbal' },
        race: { id: 101, name: 'Spring Race', date: '2023-04-15' },
        track: { name: 'Track A', distance: 10, number_of_laps: 3 }
      },
      {
        registration_id: 2,
        user: { firstname: 'Jan', surname: 'Schejbal' },
        race: { id: 102, name: 'Summer Race', date: '2023-06-20' },
        track: { name: 'Track B', distance: 5, number_of_laps: 2 }
      }
    ];
    
    axios.get.mockImplementation((url) => {
      if (url === '/api/me/registrations') {
        return Promise.resolve({ 
          data: { 
            user: mockUser, 
            registrations: mockRegistrations 
          } 
        });
      }
      return Promise.reject(new Error('Not mocked'));
    });
    
    render(<ProfilePage />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('My profile')).toBeInTheDocument();
    });
    
    // Check user info
    expect(screen.getByText('Jan Schejbal (JanS)')).toBeInTheDocument();
    expect(screen.getByText('Email: Jan@example.com')).toBeInTheDocument();
    
    // Check registrations
    expect(screen.getByText('Your registrations')).toBeInTheDocument();
    expect(screen.getByText('Jan')).toBeInTheDocument();
    expect(screen.getByText('Schejbal')).toBeInTheDocument();
    expect(screen.getByText('Spring Race')).toBeInTheDocument();
    expect(screen.getByText('Summer Race')).toBeInTheDocument();
    expect(screen.getByText('2023-04-15')).toBeInTheDocument();
    expect(screen.getByText('2023-06-20')).toBeInTheDocument();
    expect(screen.getByText('Track A (10 km, Number of laps: 3)')).toBeInTheDocument();
    expect(screen.getByText('Track B (5 km, Number of laps: 2)')).toBeInTheDocument();
    
    // Check race results sections
    expect(screen.getByText('Spring Race - results')).toBeInTheDocument();
    expect(screen.getByText('Summer Race - results')).toBeInTheDocument();
    expect(screen.getByTestId('race-results-101')).toBeInTheDocument();
    expect(screen.getByTestId('race-results-102')).toBeInTheDocument();
  });

  it('shows message when no registrations are found', async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        user: { firstname: 'Jan', surname: 'Schejbal', nickname: 'JanS', email: 'Jan@example.com' },
        registrations: []
      }
    });
    
    render(<ProfilePage />);
    
    await waitFor(() => {
      expect(screen.getByText('Jan Schejbal (JanS)')).toBeInTheDocument();
    });
    
    // Check for no registrations message
    expect(screen.getByText('No registrations found')).toBeInTheDocument();
  });

  it('displays error message on API failure', async () => {
    axios.get.mockRejectedValueOnce({
      response: { status: 500 }
    });
    
    render(<ProfilePage />);
    
    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText('Failed to load profile data')).toBeInTheDocument();
    });
  });

  it('redirects to login on unauthorized error', async () => {
    // Mock unauthorized API error
    axios.get.mockRejectedValueOnce({
      response: { status: 401 }
    });
    
    render(<ProfilePage />);
    
    await waitFor(() => {
      expect(localStorage.removeItem).toHaveBeenCalledWith('access_token');
      expect(mockNavigate).toHaveBeenCalledWith('/login');
      expect(screen.getByText('Unauthorized')).toBeInTheDocument();
    });
  });

  it('groups registrations by unique races for results display', async () => {
    // Mock API response with multiple registrations for the same race
    const mockRegistrations = [
      {
        registration_id: 1,
        user: { firstname: 'Jan', surname: 'Schejbal' },
        race: { id: 101, name: 'Spring Race', date: '2023-04-15' },
        track: { name: 'Track A', distance: 10, number_of_laps: 3 }
      },
      {
        registration_id: 2,
        user: { firstname: 'Jan', surname: 'Schejbal' },
        race: { id: 101, name: 'Spring Race', date: '2023-04-15' }, // Same race
        track: { name: 'Track B', distance: 5, number_of_laps: 2 }
      },
      {
        registration_id: 3,
        user: { firstname: 'Jan', surname: 'Schejbal' },
        race: { id: 102, name: 'Summer Race', date: '2023-06-20' },
        track: { name: 'Track C', distance: 7, number_of_laps: 1 }
      }
    ];
    
    axios.get.mockResolvedValueOnce({
      data: {
        user: { firstname: 'Jan', surname: 'Schejbal', nickname: 'JanS', email: 'Jan@example.com' },
        registrations: mockRegistrations
      }
    });
    
    render(<ProfilePage />);
    
    await waitFor(() => {
      expect(screen.getByText('My profile')).toBeInTheDocument();
    });
    
    // Should only display 2 race results sections despite having 3 registrations
    // This checks that the unique race grouping logic works
    const raceResults = screen.getAllByText(/results/);
    expect(raceResults).toHaveLength(2);
    expect(screen.getByText('Spring Race - results')).toBeInTheDocument();
    expect(screen.getByText('Summer Race - results')).toBeInTheDocument();
    
    // Only one UserRaceResults component per unique race ID
    expect(screen.getByTestId('race-results-101')).toBeInTheDocument();
    expect(screen.getByTestId('race-results-102')).toBeInTheDocument();
  });
});