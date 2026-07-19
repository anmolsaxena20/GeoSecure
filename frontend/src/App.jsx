import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import {Analytics} from '@vercel/analytics/react'

import GeoSecureHome from './GeoSecureHome.jsx'
import Login from './Login.jsx'
import Signup from './Signup.jsx'
import Profile from './Profile.jsx'
import DigitalTwin from './DigitalTwin.jsx'
import ProcumentOrchestrator from './ProcumentOrchestrator.jsx'
import DisruptionScenario from './DisruptionScenario.jsx'
import ReserveOptimisation from './ReserveOptimisation.jsx'
import { API_ENDPOINTS } from './config/api.js'
import Dashboard from './Dashboard.jsx'

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  // Check authentication status on mount
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const accessToken = searchParams.get('accessToken')
    const userParam = searchParams.get('user')

    if (accessToken) {
      localStorage.setItem('accessToken', accessToken)
      if (userParam) {
        try {
          localStorage.setItem('profileUser', userParam)
        } catch {
          localStorage.setItem('profileUser', userParam)
        }
      }
      window.history.replaceState({}, document.title, window.location.pathname)
    }

    const token = localStorage.getItem('accessToken')
    setIsAuthenticated(!!token)
    setLoading(false)
  }, [])

  const handleLoginSuccess = (data) => {
    if (data?.user) {
      localStorage.setItem('profileUser', JSON.stringify(data.user))
    }
    setIsAuthenticated(true)
  }

  const handleLogout = async () => {
    const token = localStorage.getItem('accessToken')

    if (token) {
      try {
        await fetch(API_ENDPOINTS.AUTH.LOGOUT, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          credentials: 'include',
        })
      } catch {
        // Ignore transport errors and clear local state below.
      }
    }

    localStorage.removeItem('accessToken')
    localStorage.removeItem('profileUser')
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
          element={isAuthenticated ? <Navigate to="/dashboard" /> : <Login onLoginSuccess={handleLoginSuccess} />} 
        />
        <Route 
          path="/signup" 
          element={isAuthenticated ? <Navigate to="/dashboard" /> : <Signup onSignupSuccess={handleLoginSuccess} />} 
        />
        <Route 
          path="/dashboard" 
          element={isAuthenticated ? <Dashboard onLogout={handleLogout} /> : <Navigate to="/login" />} 
        />
        <Route
          path="/procurement-orchestrator"
          element={isAuthenticated ? <ProcumentOrchestrator onLogout={handleLogout} /> : <Navigate to="/login" />}
        />
        <Route
          path="/procument-orchestrator"
          element={<Navigate to="/procurement-orchestrator" replace />}
        />
        <Route
          path="/disruption-scenario"
          element={isAuthenticated ? <DisruptionScenario onLogout={handleLogout} /> : <Navigate to="/login" />}
        />
        <Route
          path="/reserve-optimisation"
          element={isAuthenticated ? <ReserveOptimisation onLogout={handleLogout} /> : <Navigate to="/login" />}
        />
        <Route
          path="/profile"
          element={isAuthenticated ? <Profile onLogout={handleLogout} /> : <Navigate to="/login" />}
        />
        <Route path="/digitaltwin" element={<DigitalTwin isAuthenticated={isAuthenticated} onLogout={handleLogout} />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
    <Analytics />
    </>
  )
}
