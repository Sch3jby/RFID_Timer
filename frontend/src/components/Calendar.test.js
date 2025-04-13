// src/components/Calendar.test.js
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Calendar from './Calendar';
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

// Mock react-router-dom Link
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  Link: ({ to, children }) => <a href={to}>{children}</a>
}));

// Mock the translation context
jest.mock('../../contexts/LanguageContext', () => ({
  useTranslation: () => ({
    t: (key) => {
      const translations = {
        'calendar.title': 'Race calendar',
        'calendar.search': 'Search',
        'calendar.error': 'Error loading races',
        'common.loading': 'Loading',
        'calendar.columns.name': 'Race',
        'calendar.columns.date': 'Date'
      };
      return translations[key] || key;
    }
  })
}));

describe('Calendar Component', () => {
  const mockRaces = [
    { id: 1, name: 'Spring Race', date: '2023-04-15' },
    { id: 2, name: 'Summer Championship', date: '2023-06-20' },
    { id: 3, name: 'Fall Marathon', date: '2023-09-10' },
    { id: 4, name: 'Winter Race', date: '2023-12-05' }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('displays loading state initially', async () => {
    axios.get.mockImplementationOnce(() => new Promise(resolve => {
      setTimeout(() => {
        resolve({ data: { races: mockRaces } });
      }, 100);
    }));
    
    render(
      <BrowserRouter>
        <Calendar />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  it('displays races after successful API call', async () => {
    axios.get.mockResolvedValueOnce({ data: { races: mockRaces } });
    
    render(
      <BrowserRouter>
        <Calendar />
      </BrowserRouter>
    );
    
    // Wait for races to load
    await waitFor(() => {
      expect(screen.getByText('Race calendar')).toBeInTheDocument();
    });
    
    // All races should be displayed
    expect(screen.getByText('Spring Race')).toBeInTheDocument();
    expect(screen.getByText('Summer Championship')).toBeInTheDocument();
    expect(screen.getByText('Fall Marathon')).toBeInTheDocument();
    expect(screen.getByText('Winter Race')).toBeInTheDocument();
    
    // Check dates are displayed
    expect(screen.getByText('2023-04-15')).toBeInTheDocument();
    expect(screen.getByText('2023-06-20')).toBeInTheDocument();
    expect(screen.getByText('2023-09-10')).toBeInTheDocument();
    expect(screen.getByText('2023-12-05')).toBeInTheDocument();
    
    // Check that column headers are rendered
    expect(screen.getByText('Race')).toBeInTheDocument();
    expect(screen.getByText('Date')).toBeInTheDocument();
  });

  it('displays error message on API failure', async () => {
    axios.get.mockRejectedValueOnce(new Error('API error'));
    
    render(
      <BrowserRouter>
        <Calendar />
      </BrowserRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Error loading races')).toBeInTheDocument();
    });
    
    // Table should not be displayed
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('filters races based on search input', async () => {
    axios.get.mockResolvedValueOnce({ data: { races: mockRaces } });
    
    render(
      <BrowserRouter>
        <Calendar />
      </BrowserRouter>
    );
    
    // Wait for races to load
    await waitFor(() => {
      expect(screen.getByText('Spring Race')).toBeInTheDocument();
    });
    
    // Enter search term
    const searchInput = screen.getByPlaceholderText('Search');
    fireEvent.change(searchInput, { target: { value: 'summer' } });
    
    // Only summer championship should be visible now
    expect(screen.getByText('Summer Championship')).toBeInTheDocument();
    expect(screen.queryByText('Spring Race')).not.toBeInTheDocument();
    expect(screen.queryByText('Fall Marathon')).not.toBeInTheDocument();
    expect(screen.queryByText('Winter Race')).not.toBeInTheDocument();
    
    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } });
    
    // All races should be visible again
    expect(screen.getByText('Spring Race')).toBeInTheDocument();
    expect(screen.getByText('Summer Championship')).toBeInTheDocument();
    expect(screen.getByText('Fall Marathon')).toBeInTheDocument();
    expect(screen.getByText('Winter Race')).toBeInTheDocument();
  });

  it('filters races by date as well', async () => {
    axios.get.mockResolvedValueOnce({ data: { races: mockRaces } });
    
    render(
      <BrowserRouter>
        <Calendar />
      </BrowserRouter>
    );
    
    // Wait for races to load
    await waitFor(() => {
      expect(screen.getByText('Spring Race')).toBeInTheDocument();
    });
    
    // Search by part of a date
    const searchInput = screen.getByPlaceholderText('Search');
    fireEvent.change(searchInput, { target: { value: '09-10' } });
    
    // Only the Fall Marathon should be visible
    expect(screen.getByText('Fall Marathon')).toBeInTheDocument();
    expect(screen.queryByText('Spring Race')).not.toBeInTheDocument();
    expect(screen.queryByText('Summer Championship')).not.toBeInTheDocument();
    expect(screen.queryByText('Winter Race')).not.toBeInTheDocument();
  });

  it('creates proper links to race details', async () => {
    axios.get.mockResolvedValueOnce({ data: { races: mockRaces } });
    
    render(
      <BrowserRouter>
        <Calendar />
      </BrowserRouter>
    );
    
    // Wait for races to load
    await waitFor(() => {
      expect(screen.getByText('Spring Race')).toBeInTheDocument();
    });
    
    // Check that links are created with correct URLs
    const springRaceLink = screen.getByText('Spring Race').closest('a');
    const summerChampionshipLink = screen.getByText('Summer Championship').closest('a');
    
    expect(springRaceLink).toHaveAttribute('href', '/race/1');
    expect(summerChampionshipLink).toHaveAttribute('href', '/race/2');
  });
});