import axios from 'axios'

// API client configuration
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add API key
apiClient.interceptors.request.use(
  (config) => {
    const apiKey = localStorage.getItem('api_key') || "wst_dev_key_12345"
    if (apiKey) {
      config.headers['X-API-Key'] = apiKey
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear API key and redirect to login
      localStorage.removeItem('api_key')
      window.location.href = '/'
    }
    return Promise.reject(error)
  }
)

export default apiClient