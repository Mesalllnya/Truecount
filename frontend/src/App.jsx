import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"           element={<LandingPage />} />
        <Route path="/masuk"      element={<LoginPage />} />
        <Route path="/login"      element={<Navigate to="/masuk" replace />} />
        <Route path="/daftar"     element={<RegisterPage />} />
        <Route path="/register"   element={<Navigate to="/daftar" replace />} />
        <Route path="/dasbor"     element={<DashboardPage />} />
        <Route path="/dashboard"  element={<Navigate to="/dasbor" replace />} />
        <Route path="*"           element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
