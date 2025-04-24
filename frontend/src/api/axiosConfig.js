// src/api/axiosConfig.js
import axios from 'axios';

/**
 * Axios instance configuration.
 * Creates a configured axios instance with base URL from environment variables.
 * @returns Configured axios instance
 */

const axiosInstance = axios.create({
  baseURL: process.env.REACT_APP_API_URL
});

export default axiosInstance;