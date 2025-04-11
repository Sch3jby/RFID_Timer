// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Silence React 18 ReactDOM.render and act warnings
const originalConsoleError = console.error;
console.error = (...args) => {
  if (
    typeof args[0] === 'string' && (
      args[0].includes('ReactDOM.render is no longer supported') || 
      args[0].includes('Warning: `ReactDOMTestUtils.act`') || 
      args[0].includes('Warning: An update to') ||
      args[0].includes('inside a test was not wrapped in act') ||
      args[0].includes('Error fetching user data:') ||
      args[0].includes('act(...) is not supported in production builds of React')
    )
  ) {
    return; // Ignore these specific warnings
  }
  originalConsoleError(...args);
};

// Mock window.matchMedia to avoid errors
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock window.scrollTo to avoid errors
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: jest.fn()
});

// Mock window.location.reload
Object.defineProperty(window, 'location', {
  writable: true,
  value: {
    ...window.location,
    reload: jest.fn()
  }
});

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: jest.fn(() => null),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
  },
  writable: true
});

// Setup global mocks for commonly used components and functions
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock Element.closest for tests
Element.prototype.closest = jest.fn().mockImplementation(function(selector) {
  return this.parentElement?.matches(selector) 
    ? this.parentElement 
    : this.parentElement?.closest(selector);
});