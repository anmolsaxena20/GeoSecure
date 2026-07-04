import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import {Analytics} from '@vercel/analytics/react'

import GeoSecureHome from './GeoSecureHome.jsx'
import Login from './Login.jsx'
import Signup from './Signup.jsx'

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  // Check authentication status on mount
  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    setIsAuthenticated(!!token)
    setLoading(false)
  }, [])

  const handleLoginSuccess = (data) => {
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('accessToken')
    setIsAuthenticated(false)
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a0e27 0%, #1a1a2e 50%, #16213e 100%)',
        color: '#4ff0d7',
        fontSize: '18px',
      }}>
        Loading...
      </div>
    )
  }

  return (
    <>
    <Router>
      <Routes>
        <Route 
          path="/" 
          element={<GeoSecureHome onLogout={handleLogout} isAuthenticated={isAuthenticated} />} 
        />
        <Route 
          path="/login" 
          element={isAuthenticated ? <Navigate to="/" /> : <Login onLoginSuccess={handleLoginSuccess} />} 
        />
        <Route 
          path="/signup" 
          element={isAuthenticated ? <Navigate to="/" /> : <Signup onSignupSuccess={handleLoginSuccess} />} 
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
    <Analytics />
    </>
  )
}
