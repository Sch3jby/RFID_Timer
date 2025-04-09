// src/__tests__/Login.test.js
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Login from '../components/Login';

// Mock the dependencies
jest.mock('axios', () => ({
  post: jest.fn(() => Promise.resolve({ 
    data: { 
      access_token: 'fake-token',
      user: { id: 1, email: 'test@example.com' }
    }
  }))
}));

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

// Mock the translation context
jest.mock('../contexts/LanguageContext', () => ({
  useTranslation: () => ({
    t: (key) => {
      return {
        'login.logTitle': 'Login',
        'login.email': 'Email',
        'login.password': 'Password',
        'login.submit': 'Login',
        'login.genericError': 'An error occurred during login',
        'login.forgotPassword': 'Forgot password?',
        'login.register': 'Registration',
        'login.noAccount': 'Dont have account?',
        'login.loggingIn': 'Logging in...'
      }[key] || key;
    }
  })
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn()
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

const originalLocation = window.location;
delete window.location;
window.location = { reload: jest.fn() };

describe('Login Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    window.location = originalLocation;
  });

  it('allows entering email and password', () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );
    
    // Use getByLabelText with exact: false to match labels even with extra spaces/colons
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    
    expect(emailInput.value).toBe('test@example.com');
    expect(passwordInput.value).toBe('password123');
  });

  it('submits the form with correct data', async () => {
    const axios = require('axios');
    
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );
    
    // Fill in the form
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    
    // Submit the form - use getByRole to find the button
    const submitButton = screen.getByRole('button', { name: /login/i });
    fireEvent.click(submitButton);
    
    // Verify axios was called with the right data
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith('/api/login', {
        email: 'test@example.com',
        password: 'password123'
      });
      
      // Verify localStorage was called
      expect(localStorageMock.setItem).toHaveBeenCalledWith('access_token', 'fake-token');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('user', JSON.stringify({ id: 1, email: 'test@example.com' }));
      
      // Verify navigation occurred
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });
});