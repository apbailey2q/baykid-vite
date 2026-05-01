import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useAuthInit } from './hooks/useAuthInit'
import { getRoleDashboardPath } from './lib/auth'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastProvider } from './components/ui/Toast'
import LandingScreen from './screens/LandingScreen'
import LoginScreen from './screens/LoginScreen'
import SignupScreen from './screens/SignupScreen'
import PendingApprovalScreen from './screens/PendingApprovalScreen'
import ConsumerDashboard from './screens/dashboards/ConsumerDashboard'
import DriverDashboard from './screens/dashboards/DriverDashboard'
import WarehouseDashboard from './screens/dashboards/WarehouseDashboard'
import WarehouseSupervisorDashboard from './screens/dashboards/WarehouseSupervisorDashboard'
import PartnerDashboard from './screens/dashboards/PartnerDashboard'
import AdminDashboard from './screens/dashboards/AdminDashboard'
import ScannerScreen from './screens/ScannerScreen'
import BagDetailScreen from './screens/BagDetailScreen'
import InspectionScreen from './screens/InspectionScreen'
import DriverRoutePage from './screens/driver/DriverRoutePage'
import RouteStopPage from './screens/driver/RouteStopPage'
import WarehouseCheckinPage from './screens/driver/WarehouseCheckinPage'
import DriverScanScreen from './screens/driver/DriverScanScreen'
import DemoSimulationPage from './screens/DemoSimulationPage'

function HomeRedirect() {
  const { user, role, approvalStatus, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: '#060e24' }}
      >
        <div
          className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"
          style={{ borderColor: '#00c8ff', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  // Not logged in
  if (!user) return <LandingScreen />

  // Logged in but no profile row (e.g. demo account created without profile)
  if (!role) {
    console.warn('[HomeRedirect] user has no profile — redirecting to login')
    return <Navigate to="/login" replace />
  }

  // Profile exists but not yet approved
  if (approvalStatus !== 'approved') return <Navigate to="/pending-approval" replace />

  // Approved — go to role dashboard
  return <Navigate to={getRoleDashboardPath(role)} replace />
}

function App() {
  useAuthInit()

  return (
    <ErrorBoundary>
      <ToastProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/demo-simulation" element={<DemoSimulationPage />} />
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/signup" element={<SignupScreen />} />
        <Route
          path="/pending-approval"
          element={
            <ProtectedRoute>
              <PendingApprovalScreen />
            </ProtectedRoute>
          }
        />

        {/* Role dashboards */}
        <Route path="/dashboard/consumer" element={<ProtectedRoute requireApproved><ConsumerDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/driver" element={<ProtectedRoute requireApproved><DriverDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/warehouse" element={<ProtectedRoute requireApproved><WarehouseDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/warehouse-supervisor" element={<ProtectedRoute requireApproved><WarehouseSupervisorDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/partner" element={<ProtectedRoute requireApproved><PartnerDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/admin" element={<ProtectedRoute requireApproved><AdminDashboard /></ProtectedRoute>} />

        {/* Driver route flow */}
        <Route path="/dashboard/driver/route" element={<ProtectedRoute requireApproved><DriverRoutePage /></ProtectedRoute>} />
        <Route path="/dashboard/driver/routes" element={<ProtectedRoute requireApproved><DriverRoutePage /></ProtectedRoute>} />
        <Route path="/dashboard/driver/route-map" element={<ProtectedRoute requireApproved><DriverRoutePage /></ProtectedRoute>} />
        <Route path="/dashboard/driver/route/stop/:stopId" element={<ProtectedRoute requireApproved><RouteStopPage /></ProtectedRoute>} />
        <Route path="/dashboard/driver/warehouse-checkin" element={<ProtectedRoute requireApproved><WarehouseCheckinPage /></ProtectedRoute>} />
        <Route path="/dashboard/driver/scan" element={<ProtectedRoute requireApproved><DriverScanScreen /></ProtectedRoute>} />

        {/* Bag lifecycle */}
        <Route path="/scan" element={<ProtectedRoute requireApproved><ScannerScreen /></ProtectedRoute>} />
        <Route path="/bag/:bagId" element={<ProtectedRoute requireApproved><BagDetailScreen /></ProtectedRoute>} />
        <Route path="/bag/:bagId/inspect" element={<ProtectedRoute requireApproved><InspectionScreen /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  )
}

export default App
