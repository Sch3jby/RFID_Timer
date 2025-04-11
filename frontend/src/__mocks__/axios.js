// Mock for axios module
const axios = jest.createMockFromModule('axios');

// Create a mock implementation of axios.create that returns a mock instance
axios.create = jest.fn(() => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  patch: jest.fn()
}));

// Add the default methods to the main axios mock as well
axios.get = jest.fn();
axios.post = jest.fn();
axios.put = jest.fn();
axios.delete = jest.fn();
axios.patch = jest.fn();

module.exports = axios;