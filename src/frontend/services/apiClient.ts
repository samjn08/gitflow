import axios from 'axios'

// Create a configured axios instance that points directly to the backend
const apiClient = axios.create({
  baseURL: 'http://localhost:3001',
  headers: {
    'Content-Type': 'application/json',
  },
})

export default apiClient
