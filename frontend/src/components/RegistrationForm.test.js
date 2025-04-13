// src/__tests__/RegistrationForm.test.js
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RegistrationForm from '../components/RegistrationForm';

// Mock axios
jest.mock('axios', () => ({
  get: jest.fn((url) => {
    if (url === '/api/me') {
      return Promise.resolve({
        data: {
          email: 'test@example.com',
          role: 0
        }
      });
    } else if (url === '/api/races') {
      return Promise.resolve({
        data: {
          races: [
            { id: 1, name: 'Test Race 1', date: '2023-01-01' },
            { id: 2, name: 'Test Race 2', date: '2023-02-01' }
          ]
        }
      });
    } else if (url.includes('/api/tracks')) {
      return Promise.resolve({
        data: {
          tracks: [
            { id: 1, name: 'Track 1', distance: 5 },
            { id: 2, name: 'Track 2', distance: 10 }
          ]
        }
      });
    }
    return Promise.reject(new Error('Not mocked'));
  }),
  post: jest.fn(() => Promise.resolve({ status: 200 }))
}));

// Mock navigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({
    pathname: '/registration',
    state: null
  })
}));

// Mock the translation context
jest.mock('../contexts/LanguageContext', () => ({
  useTranslation: () => ({
    t: (key) => {
      return {
        'registration.title': 'Registration',
        'registration.firstName': 'First Name',
        'registration.lastName': 'Last Name',
        'registration.birthYear': 'Birth Year',
        'registration.club': 'Club / City',
        'registration.email': 'Email',
        'registration.gender': 'Gender',
        'registration.select': 'Select...',
        'registration.male': 'Male',
        'registration.female': 'Female',
        'registration.race': 'Race',
        'registration.track': 'Track',
        'registration.register': 'Register',
        'registration.success': 'User has been successfully registered',
        'registration.error': 'Registration error',
        'registration.errorLoadingData': 'Error loading data',
        'common.loading': 'Loading'
      }[key] || key;
    }
  })
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(() => 'fake-token'),
  setItem: jest.fn(),
  removeItem: jest.fn()
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('Registration Form', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('redirects to login if no token is available', async () => {
    // Override the mock to return null
    localStorageMock.getItem.mockReturnValueOnce(null);
    
    render(<RegistrationForm />);
    
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  it('displays the registration form with user data', async () => {
    render(<RegistrationForm />);
    
    // Initially should show loading
    expect(screen.getByText('Loading')).toBeInTheDocument();
    
    // After loading, form should be visible
    await waitFor(() => {
      expect(screen.getByText('Registration')).toBeInTheDocument();
    });
    
    // Test that form fields are present, use queryBy to avoid errors if not found yet
    await waitFor(() => {
      // Use a regex to match labels that might have colons or spaces after them
      expect(screen.queryByText(/Race/)).toBeInTheDocument();
      expect(screen.queryByText(/Track/)).toBeInTheDocument();
      expect(screen.queryByText(/First Name/)).toBeInTheDocument();
      expect(screen.queryByText(/Last Name/)).toBeInTheDocument();
      expect(screen.queryByText(/Birth Year/)).toBeInTheDocument();
      expect(screen.queryByText(/Club/)).toBeInTheDocument();
    });
    
    // Check for the email field specifically which should have the user's email
    await waitFor(() => {
      const emailInput = screen.getByLabelText(/Email/i);
      expect(emailInput).toHaveValue('test@example.com');
      expect(emailInput).toHaveAttribute('readonly');
    });
  });

  it('can submit the form', async () => {
    const axios = require('axios');
    
    render(<RegistrationForm />);
    
    // Wait for form to load
    await waitFor(() => {
      expect(screen.getByText('Registration')).toBeInTheDocument();
    });
    
    // Fill out the form
    // Use queryAllBy to find form inputs even if there are duplicates
    const raceInput = screen.queryAllByPlaceholderText('Select...')[0];
    fireEvent.change(raceInput, { target: { value: 'Test Race 1 - 2023-01-01' } });
    
    // Wait for tracks to load
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith('/api/tracks?race_id=1', expect.anything());
    });
    
    // Fill other form fields
    const trackInput = screen.queryAllByPlaceholderText('Select...')[1];
    fireEvent.change(trackInput, { target: { value: 'Track 1 - 5km' } });
    
    // Fill required fields with input[name] selectors which are more reliable
    const firstnameInput = screen.getByRole('textbox', { name: /First Name/i });
    const surnameInput = screen.getByRole('textbox', { name: /Last Name/i });
    const yearInput = screen.getByRole('textbox', { name: /Birth Year/i });
    const clubInput = screen.getByRole('textbox', { name: /Club/i });
    
    fireEvent.change(firstnameInput, { target: { value: 'Jan' } });
    fireEvent.change(surnameInput, { target: { value: 'Schejbal' } });
    fireEvent.change(yearInput, { target: { value: '1990' } });
    fireEvent.change(clubInput, { target: { value: 'Test Club' } });
    
    // Select gender
    const genderSelect = screen.getByRole('combobox', { name: /Gender/i });
    fireEvent.change(genderSelect, { target: { value: 'M' } });
    
    // Submit the form
    const submitButton = screen.getByRole('button', { name: /Register/i });
    fireEvent.click(submitButton);
    
    // Verify form submission
    await waitFor(() => {
      // Check that axios.post was called
      expect(axios.post).toHaveBeenCalledWith(
        '/api/registration',
        expect.objectContaining({
          firstname: 'Jan',
          surname: 'Schejbal',
          year: '1990',
          club: 'Test Club',
          email: 'test@example.com',
          gender: 'M'
        }),
        expect.anything()
      );
    });
  });
});