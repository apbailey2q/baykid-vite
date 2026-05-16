import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastProvider } from './components/ui/Toast'
import WelcomePage from './screens/WelcomePage'
import RealLoginPage from './screens/RealLoginPage'
import LiveDashboardPage from './screens/LiveDashboardPage'
import LiveBagsPage from './screens/live/LiveBagsPage'
import LiveFundraisersPage from './screens/live/LiveFundraisersPage'
import LiveWalletPage from './screens/live/LiveWalletPage'
import { RequireAuth } from './components/RequireAuth'
import { RequireRole } from './components/RequireRole'
import LoginScreen from './screens/LoginScreen'
import SignupScreen from './screens/SignupScreen'
import PendingApprovalScreen from './screens/PendingApprovalScreen'
import ConsumerDashboard from './screens/dashboards/ConsumerDashboard'
import DriverDashboard from './screens/dashboards/DriverDashboard'
import WarehouseDashboard from './screens/dashboards/WarehouseDashboard'
import WarehouseSupervisorDashboard from './screens/dashboards/WarehouseSupervisorDashboard'
import PartnerDashboard from './screens/dashboards/PartnerDashboard'
import AdminDashboard from './screens/dashboards/AdminDashboard'
import FundraiserDashboard from './screens/dashboards/FundraiserDashboard'
import ScannerScreen from './screens/ScannerScreen'
import BagDetailScreen from './screens/BagDetailScreen'
import InspectionScreen from './screens/InspectionScreen'
import DriverRoutePage from './screens/driver/DriverRoutePage'
import RouteStopPage from './screens/driver/RouteStopPage'
import WarehouseCheckinPage from './screens/driver/WarehouseCheckinPage'
import DriverScanScreen from './screens/driver/DriverScanScreen'
import DemoSimulationPage from './screens/DemoSimulationPage'
import FullDemoHUD from './components/FullDemoHUD'
import FundraisersPage from './screens/fundraisers/FundraisersPage'
import FundraiserDetailPage from './screens/fundraisers/FundraiserDetailPage'
import MyFundraiserPage from './screens/fundraisers/MyFundraiserPage'
import ScanResultPage from './screens/fundraisers/ScanResultPage'
import CreateFundraiserPage from './screens/fundraisers/CreateFundraiserPage'
import QRScanPage from './screens/fundraisers/QRScanPage'
import EarningsDashboardPage from './screens/EarningsDashboardPage'
import DriverRoutesPage from './screens/DriverRoutesPage'
import BagInspectionPage from './screens/BagInspectionPage'
import AdminDashboardPage from './screens/AdminDashboardPage'
import BagLifecyclePage from './screens/BagLifecyclePage'
import ContaminationAlertsPage from './screens/ContaminationAlertsPage'
import RecyclingDestinationPage from './screens/RecyclingDestinationPage'
import PartnerDashboardPage from './screens/PartnerDashboardPage'
import LeaderboardPage from './screens/LeaderboardPage'
import ReportsCenterPage from './screens/ReportsCenterPage'
import DonationReceiptPage from './screens/DonationReceiptPage'
import AIRecommendationsPage from './screens/AIRecommendationsPage'
import NotificationsPage from './screens/NotificationsPage'
import FraudDetectionPage from './screens/FraudDetectionPage'
import WalletPage from './screens/WalletPage'
import FundraiserAdminPage from './screens/FundraiserAdminPage'
import LiveScanPage from './screens/LiveScanPage'
import LiveInspectionPage from './screens/LiveInspectionPage'
import LiveFundraiserDetailPage from './screens/live/LiveFundraiserDetailPage'
import LiveMyFundraisersPage from './screens/live/LiveMyFundraisersPage'
import LiveFundraiserDashboardPage from './screens/live/LiveFundraiserDashboardPage'
import LiveNotificationsPage from './screens/live/LiveNotificationsPage'
import LivePayoutAdminPage from './screens/live/LivePayoutAdminPage'
import LiveReportsPage from './screens/live/LiveReportsPage'
import LiveAdminPage from './screens/live/LiveAdminPage'
import LiveAuditLogPage from './screens/live/LiveAuditLogPage'
import LiveSettingsPage from './screens/live/LiveSettingsPage'
import LiveWarehouseDashboard from './screens/live/LiveWarehouseDashboard'
import LiveWarehouseReviewPage from './screens/live/LiveWarehouseReviewPage'
import TermsPage from './screens/TermsPage'
import PrivacyPage from './screens/PrivacyPage'
import ConsentPage from './screens/ConsentPage'
import PresentationModePage from './screens/PresentationModePage'
import ReadinessChecklistPage from './screens/ReadinessChecklistPage'
import LaunchChecklistPage from './screens/LaunchChecklistPage'

const ROLE_HOME: Record<string, string> = {
  admin:      '/dashboard/admin',
  consumer:   '/dashboard/consumer',
  driver:     '/dashboard/driver',
  warehouse:  '/dashboard/warehouse',
  fundraiser: '/dashboard/fundraiser',
  partner:    '/dashboard/partner',
}

function normalizeRole(role: string | null | undefined): string | null {
  if (!role) return null
  const r = role.toLowerCase().trim()
  if (r === 'warehouse_employee' || r === 'warehouse_supervisor') return 'warehouse'
  return r
}

function HomeRedirect() {
  const { user, role, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: '#060e24' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: '#00c8ff', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (!user) return <Navigate to="/real-login" replace />

  const normalized = normalizeRole(role)
  const dest = (normalized && ROLE_HOME[normalized]) ?? '/real-login'
  return <Navigate to={dest} replace />
}

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/real-login" element={<RealLoginPage />} />
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

        {/* Role dashboards — access controlled by routePermissions.ts */}
        <Route path="/dashboard/consumer" element={<ProtectedRoute requireApproved allowDemo><ConsumerDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/driver" element={<ProtectedRoute requireApproved><DriverDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/warehouse" element={<ProtectedRoute requireApproved><WarehouseDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/warehouse-supervisor" element={<ProtectedRoute requireApproved><WarehouseSupervisorDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/partner" element={<ProtectedRoute requireApproved><PartnerDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/admin" element={<ProtectedRoute requireApproved><AdminDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/fundraiser" element={<ProtectedRoute requireApproved><FundraiserDashboard /></ProtectedRoute>} />

        {/* Driver route flow */}
        <Route path="/dashboard/driver/route" element={<ProtectedRoute requireApproved><DriverRoutePage /></ProtectedRoute>} />
        <Route path="/dashboard/driver/routes" element={<ProtectedRoute requireApproved><DriverRoutePage /></ProtectedRoute>} />
        <Route path="/dashboard/driver/route-map" element={<ProtectedRoute requireApproved><DriverRoutePage /></ProtectedRoute>} />
        <Route path="/dashboard/driver/route/stop/:stopId" element={<ProtectedRoute requireApproved><RouteStopPage /></ProtectedRoute>} />
        <Route path="/dashboard/driver/warehouse-checkin" element={<ProtectedRoute requireApproved><WarehouseCheckinPage /></ProtectedRoute>} />
        <Route path="/dashboard/driver/scan" element={<ProtectedRoute requireApproved><DriverScanScreen /></ProtectedRoute>} />

        {/* Bag lifecycle */}
        <Route path="/scan" element={<ProtectedRoute requireApproved allowDemo><ScannerScreen /></ProtectedRoute>} />
        <Route path="/bag/:bagId" element={<ProtectedRoute requireApproved><BagDetailScreen /></ProtectedRoute>} />
        <Route path="/bag/:bagId/inspect" element={<ProtectedRoute requireApproved><InspectionScreen /></ProtectedRoute>} />

        {/* Fundraisers — no auth required */}
        <Route path="/fundraisers" element={<FundraisersPage />} />
        <Route path="/fundraisers/:id" element={<FundraiserDetailPage />} />
        <Route path="/my-fundraiser" element={<MyFundraiserPage />} />
        <Route path="/scan-result" element={<ScanResultPage />} />
        <Route path="/create-fundraiser" element={<CreateFundraiserPage />} />
        <Route path="/qr-scan" element={<QRScanPage />} />
        <Route path="/earnings" element={<EarningsDashboardPage />} />
        <Route path="/driver-routes" element={<DriverRoutesPage />} />
        <Route path="/bag-inspection" element={<BagInspectionPage />} />
        <Route path="/admin-dashboard" element={<AdminDashboardPage />} />
        <Route path="/bag-lifecycle" element={<BagLifecyclePage />} />
        <Route path="/contamination-alerts" element={<ContaminationAlertsPage />} />
        <Route path="/recycling-destination" element={<RecyclingDestinationPage />} />
        <Route path="/partner-dashboard" element={<PartnerDashboardPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/reports" element={<ReportsCenterPage />} />
        <Route path="/donation-receipt" element={<DonationReceiptPage />} />
        <Route path="/ai-recommendations" element={<AIRecommendationsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/fraud-detection" element={<FraudDetectionPage />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/fundraiser-admin" element={<FundraiserAdminPage />} />

        {/* Legacy demo shortcuts → redirect to canonical dashboard routes */}
        <Route path="/consumer"   element={<Navigate to="/dashboard/consumer"   replace />} />
        <Route path="/driver"     element={<Navigate to="/dashboard/driver"     replace />} />
        <Route path="/warehouse"  element={<Navigate to="/dashboard/warehouse"  replace />} />
        <Route path="/partner"    element={<Navigate to="/dashboard/partner"    replace />} />
        <Route path="/fundraiser" element={<Navigate to="/dashboard/fundraiser" replace />} />
        <Route path="/admin"      element={<Navigate to="/dashboard/admin"      replace />} />

        {/* ── Live mode routes (Supabase-backed, guarded by RequireAuth) ── */}
        <Route path="/live-dashboard"   element={<RequireAuth><LiveDashboardPage /></RequireAuth>} />
        <Route path="/live-bags"        element={<RequireAuth><LiveBagsPage /></RequireAuth>} />
        <Route path="/live-fundraisers" element={<RequireAuth><LiveFundraisersPage /></RequireAuth>} />
        <Route path="/live-wallet"      element={<RequireAuth><RequireRole roles={['consumer']}><LiveWalletPage /></RequireRole></RequireAuth>} />
        <Route path="/cashout"          element={<RequireAuth><RequireRole roles={['consumer']}><LiveWalletPage /></RequireRole></RequireAuth>} />
        <Route path="/live-scan"              element={<RequireAuth><RequireRole roles={['consumer']}><LiveScanPage /></RequireRole></RequireAuth>} />
        <Route path="/live-inspection"        element={<RequireAuth><LiveInspectionPage /></RequireAuth>} />
        <Route path="/live-fundraisers/:id"   element={<RequireAuth><LiveFundraiserDetailPage /></RequireAuth>} />
        <Route path="/live-my-fundraisers"         element={<RequireAuth><LiveMyFundraisersPage /></RequireAuth>} />
        <Route path="/live-fundraiser-dashboard"  element={<RequireAuth><RequireRole roles={['fundraiser_admin', 'admin']}><LiveFundraiserDashboardPage /></RequireRole></RequireAuth>} />
        <Route path="/live-notifications"         element={<RequireAuth><LiveNotificationsPage /></RequireAuth>} />
        <Route path="/live-payout-admin"          element={<RequireAuth><RequireRole roles={['admin']}><LivePayoutAdminPage /></RequireRole></RequireAuth>} />
        <Route path="/live-reports"               element={<RequireAuth><RequireRole roles={['admin', 'partner']}><LiveReportsPage /></RequireRole></RequireAuth>} />
        <Route path="/live-admin"                 element={<RequireAuth><RequireRole roles={['admin']}><LiveAdminPage /></RequireRole></RequireAuth>} />
        <Route path="/live-audit-log"             element={<RequireAuth><RequireRole roles={['admin']}><LiveAuditLogPage /></RequireRole></RequireAuth>} />
        <Route path="/live-settings"              element={<RequireAuth><RequireRole roles={['admin']}><LiveSettingsPage /></RequireRole></RequireAuth>} />
        <Route path="/live-warehouse"             element={<RequireAuth><RequireRole roles={['warehouse_employee','warehouse_supervisor']}><LiveWarehouseDashboard /></RequireRole></RequireAuth>} />
        <Route path="/live-warehouse-review"      element={<RequireAuth><RequireRole roles={['warehouse_employee','warehouse_supervisor']}><LiveWarehouseReviewPage /></RequireRole></RequireAuth>} />
        <Route path="/terms"   element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/consent" element={<ConsentPage />} />
        <Route path="/presentation-mode"          element={<PresentationModePage />} />
        <Route path="/readiness-checklist"        element={<ReadinessChecklistPage />} />
        <Route path="/launch-checklist"           element={<LaunchChecklistPage />} />
      </Routes>
      <FullDemoHUD />
    </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  )
}

export default App
