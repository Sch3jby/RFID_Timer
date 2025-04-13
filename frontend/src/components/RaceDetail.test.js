// src/components/RaceDetail.test.js
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import RaceDetail from './RaceDetail';
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

// Mock components
jest.mock('../components/StartList', () => {
  return function MockStartList({ participants }) {
    return (
      <div data-testid="mock-start-list">
        Start List with {participants?.length || 0} participants
      </div>
    );
  };
});

jest.mock('../components/ResultList', () => {
  return function MockResultList({ participants }) {
    return (
      <div data-testid="mock-result-list">
        Result List with {participants?.length || 0} participants
      </div>
    );
  };
});

// Mock useParams to return a race ID
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ id: '1' }),
  useNavigate: () => jest.fn()
}));

// Mock the translation context
jest.mock('../contexts/LanguageContext', () => ({
  useTranslation: () => ({
    t: (key) => {
      const translations = {
        'raceDetail.date': 'Date',
        'raceDetail.description': 'Description',
        'raceDetail.register': 'Register',
        'raceDetail.startList': 'Start list',
        'raceDetail.resultList': 'Result list',
        'raceDetail.error': 'Error loading race data',
        'raceDetail.noData': 'No race data found',
        'common.loading': 'Loading',
        'raceManagement.startType': 'Start type',
        'raceManagement.massStart': 'Mass start',
        'raceManagement.intervalStart': 'Interval start'
      };
      return translations[key] || key;
    }
  })
}));

describe('RaceDetail Component', () => {
  const mockRace = {
    id: 1,
    name: 'Test Race 2023',
    date: '2023-05-15',
    description: 'This is a test race description',
    start: 'M',
    participants: [
      { id: 101, firstname: 'John', surname: 'Doe', number: '1', start_time: '10:00:00' },
      { id: 102, firstname: 'Jane', surname: 'Smith', number: '2', start_time: '10:05:00' }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('displays loading state initially', () => {
    // Mock API call that doesn't resolve immediately
    axios.get.mockImplementationOnce(() => new Promise(resolve => {
      setTimeout(() => {
        resolve({ data: { race: mockRace } });
      }, 100);
    }));
    
    render(
      <BrowserRouter>
        <RaceDetail />
      </BrowserRouter>
    );
    
    // Should show loading initially
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  it('renders race details after successful API call', async () => {
    // Mock successful API response
    axios.get.mockResolvedValueOnce({ data: { race: mockRace } });
    
    render(
      <BrowserRouter>
        <RaceDetail />
      </BrowserRouter>
    );
    
    // Wait for race details to load
    await waitFor(() => {
      expect(screen.getByText('Test Race 2023')).toBeInTheDocument();
    });
    
    // Check if details are rendered correctly
    expect(screen.getByText('Date:')).toBeInTheDocument();
    expect(screen.getByText('2023-05-15')).toBeInTheDocument();
    expect(screen.getByText('Start type: Mass start')).toBeInTheDocument();
    expect(screen.getByText('Description:')).toBeInTheDocument();
    expect(screen.getByText('This is a test race description')).toBeInTheDocument();
    expect(screen.getByText('Register')).toBeInTheDocument();
    
    // Check if tabs are rendered
    expect(screen.getByText('Start list')).toBeInTheDocument();
    expect(screen.getByText('Result list')).toBeInTheDocument();
    
    // Check if start list is shown by default
    expect(screen.getByTestId('mock-start-list')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-result-list')).not.toBeInTheDocument();
  });

  it('displays error message on API failure', async () => {
    // Mock API error
    axios.get.mockRejectedValueOnce(new Error('API error'));
    
    render(
      <BrowserRouter>
        <RaceDetail />
      </BrowserRouter>
    );
    
    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText('Error loading race data')).toBeInTheDocument();
    });
  });

  it('displays no data message when race is null', async () => {
    // Mock API response with null race
    axios.get.mockResolvedValueOnce({ data: { race: null } });
    
    render(
      <BrowserRouter>
        <RaceDetail />
      </BrowserRouter>
    );
    
    // Wait for no data message
    await waitFor(() => {
      expect(screen.getByText('No race data found')).toBeInTheDocument();
    });
  });

  it('switches between start list and result list tabs', async () => {
    // Mock successful API response
    axios.get.mockResolvedValueOnce({ data: { race: mockRace } });
    
    render(
      <BrowserRouter>
        <RaceDetail />
      </BrowserRouter>
    );
    
    // Wait for race details to load
    await waitFor(() => {
      expect(screen.getByText('Test Race 2023')).toBeInTheDocument();
    });
    
    // Initially start list should be shown
    expect(screen.getByTestId('mock-start-list')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-result-list')).not.toBeInTheDocument();
    
    // Click on result list tab
    fireEvent.click(screen.getByText('Result list'));
    
    // Result list should be shown now
    expect(screen.queryByTestId('mock-start-list')).not.toBeInTheDocument();
    expect(screen.getByTestId('mock-result-list')).toBeInTheDocument();
    
    // Click back on start list tab
    fireEvent.click(screen.getByText('Start list'));
    
    // Start list should be shown again
    expect(screen.getByTestId('mock-start-list')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-result-list')).not.toBeInTheDocument();
  });

  it('renders interval start type correctly', async () => {
    // Mock successful API response with interval start
    const intervalRace = {
      ...mockRace,
      start: 'I'
    };
    axios.get.mockResolvedValueOnce({ data: { race: intervalRace } });
    
    render(
      <BrowserRouter>
        <RaceDetail />
      </BrowserRouter>
    );
    
    // Wait for race details to load
    await waitFor(() => {
      expect(screen.getByText('Test Race 2023')).toBeInTheDocument();
    });
    
    // Check for interval start text
    expect(screen.getByText('Start type: Interval start')).toBeInTheDocument();
  });
});