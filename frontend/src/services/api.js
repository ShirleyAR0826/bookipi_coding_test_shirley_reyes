import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
apiClient.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error);
    
    // Handle network errors
    if (!error.response) {
      throw new Error('Network error - please check your connection');
    }
    
    // Handle server errors
    const message = error.response.data?.error || 
                   error.response.data?.message || 
                   `Server error: ${error.response.status}`;
    
    throw new Error(message);
  }
);

export const flashSaleAPI = {
  /**
   * Get current flash sale status
   */
  async getSaleStatus() {
    try {
      const response = await apiClient.get('/flash-sale/status');
      return response.data;
    } catch (error) {
      console.error('Failed to get sale status:', error);
      throw error;
    }
  },

  /**
   * Attempt to purchase item
   */
  async attemptPurchase(userId) {
    try {
      const response = await apiClient.post('/flash-sale/purchase', { userId });
      return response.data;
    } catch (error) {
      // For purchase attempts, we want to return the error response data
      // as it contains useful information about the failure reason
      if (error.response && error.response.data) {
        return error.response.data;
      }
      console.error('Failed to attempt purchase:', error);
      throw error;
    }
  },

  /**
   * Check user's purchase status
   */
  async getUserPurchase(userId) {
    try {
      const response = await apiClient.get(`/flash-sale/purchase/${encodeURIComponent(userId)}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get user purchase:', error);
      throw error;
    }
  },

  /**
   * Get sale configuration
   */
  async getSaleConfig() {
    try {
      const response = await apiClient.get('/flash-sale/config');
      return response.data;
    } catch (error) {
      console.error('Failed to get sale config:', error);
      throw error;
    }
  },

  /**
   * Reset sale data (development only)
   */
  async resetSaleData() {
    try {
      const response = await apiClient.post('/flash-sale/reset');
      return response.data;
    } catch (error) {
      console.error('Failed to reset sale data:', error);
      throw error;
    }
  }
};

export default apiClient;