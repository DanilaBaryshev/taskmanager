import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import Projects from './pages/Projects'
import Board from './pages/Board'

// защищённый маршрут — если не авторизован, шлём на /login
function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

function App() {
  const { isAuthenticated } = useAuth()

  return (
    <Routes>
      {/* корень редиректит в зависимости от авторизации */}
      <Route
        path="/"
        element={<Navigate to={isAuthenticated ? '/projects' : '/login'} replace />}
      />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/projects"
        element={
          <PrivateRoute>
            <Projects />
          </PrivateRoute>
        }
      />
      <Route
        path="/projects/:id"
        element={
          <PrivateRoute>
            <Board />
          </PrivateRoute>
        }
      />
    </Routes>
  )
}

export default App
