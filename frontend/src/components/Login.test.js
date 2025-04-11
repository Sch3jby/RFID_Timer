import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Login from './Login';
import { LanguageProvider } from '../contexts/LanguageContext';

// Mock axiosConfig directly
jest.mock('../api/axiosConfig', () => {
  return {
    post: jest.fn()
  };
});

// Import the mocked module
import axios from '../api/axiosConfig';

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

describe('Login Component', () => {
  beforeEach(() => {
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        setItem: jest.fn(),
        getItem: jest.fn(),
        removeItem: jest.fn()
      },
      writable: true
    });
    
    // Reset mocks
    jest.clearAllMocks();
  });

  test('renders login form correctly', () => {
    render(
      <LanguageProvider>
        <BrowserRouter>
          <Login />
        </BrowserRouter>
      </LanguageProvider>
    );
    
    // Look for email and password inputs
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    
    // Look for the submit button
    const submitButton = screen.getByRole('button');
    
    expect(emailInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
    expect(submitButton).toBeInTheDocument();
  });

  test('handles input changes', () => {
    render(
      <LanguageProvider>
        <BrowserRouter>
          <Login />
        </BrowserRouter>
      </LanguageProvider>
    );
    
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    
    // Simulate typing in the inputs
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    
    // Check if the input values were updated
    expect(emailInput.value).toBe('test@example.com');
    expect(passwordInput.value).toBe('password123');
  });

  test('handles form submission successfully', async () => {
    // Mock successful API response
    axios.post.mockResolvedValueOnce({
      data: {
        access_token: 'fake-token',
        user: { id: 1, email: 'test@example.com' }
      }
    });
    
    render(
      <LanguageProvider>
        <BrowserRouter>
          <Login />
        </BrowserRouter>
      </LanguageProvider>
    );
    
    // Fill in the form
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    
    // Submit the form
    act(() => {
      fireEvent.click(screen.getByRole('button'));
    });
    
    // Wait for the API call to complete
    await waitFor(() => {
      // Check if axios.post was called correctly
      expect(axios.post).toHaveBeenCalledWith('/api/login', {
        email: 'test@example.com',
        password: 'password123'
      });
      
      // Check if token and user data were stored in localStorage
      expect(localStorage.setItem).toHaveBeenCalledWith('access_token', 'fake-token');
      expect(localStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify({ id: 1, email: 'test@example.com' }));
      
      // Check if navigation occurred
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  test('handles login error', async () => {
    // Mock API error response
    axios.post.mockRejectedValueOnce({
      response: {
        data: {
          message: 'Invalid credentials'
        }
      }
    });
    
    render(
      <LanguageProvider>
        <BrowserRouter>
          <Login />
        </BrowserRouter>
      </LanguageProvider>
    );
    
    // Fill in the form
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrong-password' } });
    
    // Submit the form
    act(() => {
      fireEvent.click(screen.getByRole('button'));
    });
    
    // Wait for the error message to appear
    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
    
    // Verify localStorage was not called
    expect(localStorage.setItem).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});