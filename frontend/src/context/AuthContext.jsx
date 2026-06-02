import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

// разбираем JWT payload без проверки подписи
function parseToken(token) {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload))
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)

  // при первом рендере читаем токен из storage
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      const decoded = parseToken(token)
      if (decoded) setUser(decoded)
    }
  }, [])

  // сохраняем токен и ставим пользователя
  function login(token) {
    localStorage.setItem('token', token)
    const decoded = parseToken(token)
    setUser(decoded)
  }

  // чистим токен и сбрасываем состояние
  function logout() {
    localStorage.removeItem('token')
    setUser(null)
  }

  const isAuthenticated = !!user

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
