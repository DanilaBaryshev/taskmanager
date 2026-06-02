import axios from 'axios'

// базовый URL берём из env, по умолчанию localhost
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const client = axios.create({ baseURL })

// перед каждым запросом добавляем токен из localStorage
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// при 401 чистим токен и отправляем на логин
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default client
