import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { usePushToken } from './hooks/usePushToken'
import { normalizeRole } from './lib/auth'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ModeBanner } from './components/ModeBanner'
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
import LegalHubPage from './screens/legal/LegalHubPage'
import DataDeletionPage from './screens/legal/DataDeletionPage'
import ContactSupportPage from './screens/legal/ContactSupportPage'
import SafetyPolicyPage from './screens/legal/SafetyPolicyPage'
import DriverSafetyPage from './screens/legal/DriverSafetyPage'
import CommercialTermsPage from './screens/legal/CommercialTermsPage'
import PrivacyPolicy from './screens/legal/PrivacyPolicy'
import TermsOfService from './screens/legal/TermsOfService'
import DemoOverview from './screens/demo/DemoOverview'
import BetaHome from './screens/beta/BetaHome'
import BetaFeedbackPage from './screens/beta/BetaFeedbackPage'
import BetaChecklist from './screens/beta/BetaChecklist'
import ProductionChecklist from './screens/deploy/ProductionChecklist'
import PresentationModePage from './screens/PresentationModePage'
import ReadinessChecklistPage from './screens/ReadinessChecklistPage'
import LaunchChecklistPage from './screens/LaunchChecklistPage'
import CommercialDashboard from './screens/commercial/CommercialDashboard'
import CommercialPickupRequest from './screens/commercial/CommercialPickupRequest'
import CommercialSchedule from './screens/commercial/CommercialSchedule'
import CommercialBins from './screens/commercial/CommercialBins'
import CommercialReports from './screens/commercial/CommercialReports'
import CommercialInvoices from './screens/commercial/CommercialInvoices'
import CommercialHistory from './screens/commercial/CommercialHistory'
import CommercialProfile from './screens/commercial/CommercialProfile'
import DriverHybridDashboard from './screens/driver/DriverHybridDashboard'
import ConsumerRoutes from './screens/driver/ConsumerRoutes'
import CommercialRoutes from './screens/driver/CommercialRoutes'
import DriverDispatchMessages from './screens/driver/DriverDispatchMessages'
import HybridRoutes from './screens/driver/HybridRoutes'
import CommercialSafetyChecklist from './screens/driver/CommercialSafetyChecklist'
import CommercialStopDetail from './screens/driver/CommercialStopDetail'
import CommercialScan from './screens/driver/CommercialScan'
import CommercialInspection from './screens/driver/CommercialInspection'
import AdminCommercialDashboard from './screens/admin/AdminCommercialDashboard'
import AdminCommercialAccounts from './screens/admin/AdminCommercialAccounts'
import AdminCommercialPickups from './screens/admin/AdminCommercialPickups'
import AdminCommercialAlerts from './screens/admin/AdminCommercialAlerts'
import AdminCommercialReports from './screens/admin/AdminCommercialReports'
import AdminCommercialInspectionReview from './screens/admin/AdminCommercialInspectionReview'
import AdminCommercialDispatch from './screens/admin/AdminCommercialDispatch'
import AdminCommercialSupport from './screens/admin/AdminCommercialSupport'
import AdminDriverPayouts from './screens/admin/AdminDriverPayouts'
import AdminWarehouseAnalytics from './screens/admin/AdminWarehouseAnalytics'
import AdminWarehouseDetail from './screens/admin/AdminWarehouseDetail'
import AdminWarehouseAlerts from './screens/admin/AdminWarehouseAlerts'
import WarehouseAlertsPage from './screens/warehouse/WarehouseAlertsPage'
import WarehouseMessages from './screens/warehouse/WarehouseMessages'
import AdminMessagingQA from './screens/admin/AdminMessagingQA'
import DriverEarnings from './screens/driver/DriverEarnings'
import CommercialSupport from './screens/commercial/CommercialSupport'
import NotificationPreferences from './screens/settings/NotificationPreferences'
import CommercialExpectedLoads from './screens/warehouse/CommercialExpectedLoads'
import CommercialIntake from './screens/warehouse/CommercialIntake'
import CommercialProcessing from './screens/warehouse/CommercialProcessing'
import CommercialOnboarding from './screens/commercial/CommercialOnboarding'
import DriverOnboarding from './screens/driver/DriverOnboarding'
import WarehouseOnboarding from './screens/warehouse/WarehouseOnboarding'
import AdminApprovalsPage from './screens/admin/AdminApprovalsPage'
import MunicipalDashboard from './screens/municipal/MunicipalDashboard'
import MunicipalReports from './screens/municipal/MunicipalReports'
import ExecutiveDashboard from './screens/executive/ExecutiveDashboard'
import AdminRegions from './screens/admin/AdminRegions'
import AdminForecasting from './screens/admin/AdminForecasting'
import AdminLaunchRoadmap from './screens/admin/AdminLaunchRoadmap'

<<<<<<< Updated upstream
=======
// ── Loading fallback ───────────────────────────────────────────────────────────
// Shown while any lazy-loaded screen chunk is downloading.
function PageLoader() {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ background: '#060e24' }}
    >
      <div
        className="h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"
        style={{ borderColor: '#00c8ff', borderTopColor: 'transparent' }}
      />
    </div>
  )
}

// ── Lazy screen imports ────────────────────────────────────────────────────────
// Every screen is code-split into its own chunk. Only the chunk for the
// current route downloads; all other screens load on first navigation.
// Reduces initial bundle from ~3 MB to ~150 KB for the average user.

// ─ Public / auth ──────────────────────────────────────────────────────────────
const WelcomePage              = lazy(() => import('./screens/WelcomePage'))
const RealLoginPage            = lazy(() => import('./screens/RealLoginPage'))
const SignupScreen              = lazy(() => import('./screens/SignupScreen'))
const PendingApprovalScreen    = lazy(() => import('./screens/PendingApprovalScreen'))
const WelcomeBack              = lazy(() => import('./screens/WelcomeBack'))

// ─ Role dashboards ────────────────────────────────────────────────────────────
const ConsumerDashboard        = lazy(() => import('./screens/dashboards/ConsumerDashboard'))
const DriverDashboard          = lazy(() => import('./screens/dashboards/DriverDashboard'))
const WarehouseDashboard       = lazy(() => import('./screens/dashboards/WarehouseDashboard'))
const WarehouseSupervisorDashboard = lazy(() => import('./screens/dashboards/WarehouseSupervisorDashboard'))
const PartnerDashboard         = lazy(() => import('./screens/dashboards/PartnerDashboard'))
const AdminDashboard           = lazy(() => import('./screens/dashboards/AdminDashboard'))
const FundraiserDashboard      = lazy(() => import('./screens/dashboards/FundraiserDashboard'))

// ─ Live mode (Supabase-backed) ────────────────────────────────────────────────
const LiveDashboardPage        = lazy(() => import('./screens/LiveDashboardPage'))
const LiveBagsPage             = lazy(() => import('./screens/live/LiveBagsPage'))
const LiveFundraisersPage      = lazy(() => import('./screens/live/LiveFundraisersPage'))
const LiveWalletPage           = lazy(() => import('./screens/live/LiveWalletPage'))
const LiveScanPage             = lazy(() => import('./screens/LiveScanPage'))
const LiveInspectionPage       = lazy(() => import('./screens/LiveInspectionPage'))
const LiveFundraiserDetailPage = lazy(() => import('./screens/live/LiveFundraiserDetailPage'))
const LiveMyFundraisersPage    = lazy(() => import('./screens/live/LiveMyFundraisersPage'))
const LiveFundraiserDashboardPage = lazy(() => import('./screens/live/LiveFundraiserDashboardPage'))
const LiveNotificationsPage    = lazy(() => import('./screens/live/LiveNotificationsPage'))
const LivePayoutAdminPage      = lazy(() => import('./screens/live/LivePayoutAdminPage'))
const LiveReportsPage          = lazy(() => import('./screens/live/LiveReportsPage'))
const LiveAdminPage            = lazy(() => import('./screens/live/LiveAdminPage'))
const LiveAuditLogPage         = lazy(() => import('./screens/live/LiveAuditLogPage'))
const LiveSettingsPage         = lazy(() => import('./screens/live/LiveSettingsPage'))
const LiveWarehouseDashboard   = lazy(() => import('./screens/live/LiveWarehouseDashboard'))
const LiveWarehouseReviewPage  = lazy(() => import('./screens/live/LiveWarehouseReviewPage'))

// ─ Consumer ───────────────────────────────────────────────────────────────────
// Phase G.7 — ScannerScreen + WalletPage archived to src/screens/dev/; the
// /scan and /wallet routes now redirect to /live-scan and /live-wallet.
const BagDetailScreen          = lazy(() => import('./screens/BagDetailScreen'))
const InspectionScreen         = lazy(() => import('./screens/InspectionScreen'))
// Phase G.9 — NotificationsPage archived to src/screens/dev/; /notifications redirects to /live-notifications.
const ConsumerOnboarding       = lazy(() => import('./screens/onboarding/ConsumerOnboarding'))
const OnboardingDispatcher     = lazy(() => import('./screens/onboarding/OnboardingDispatcher'))
const WaitlistScreen           = lazy(() => import('./screens/onboarding/WaitlistScreen'))
const FundraiserOnboarding     = lazy(() => import('./screens/onboarding/FundraiserOnboarding'))
const CommercialOnboardingG4   = lazy(() => import('./screens/onboarding/CommercialOnboarding'))
const ConsumerPickupRequest    = lazy(() => import('./screens/consumer/ConsumerPickupRequest'))
const QRScanPage               = lazy(() => import('./screens/fundraisers/QRScanPage'))
const ScanResultPage           = lazy(() => import('./screens/fundraisers/ScanResultPage'))
const MyFundraiserPage         = lazy(() => import('./screens/fundraisers/MyFundraiserPage'))

// ─ Fundraisers (public + auth) ────────────────────────────────────────────────
const FundraisersPage          = lazy(() => import('./screens/fundraisers/FundraisersPage'))
const FundraiserDetailPage     = lazy(() => import('./screens/fundraisers/FundraiserDetailPage'))
const CreateFundraiserPage     = lazy(() => import('./screens/fundraisers/CreateFundraiserPage'))
const LeaderboardPage          = lazy(() => import('./screens/LeaderboardPage'))
const DonationReceiptPage      = lazy(() => import('./screens/DonationReceiptPage'))
const RecyclingDestinationPage = lazy(() => import('./screens/RecyclingDestinationPage'))

// ─ Driver ─────────────────────────────────────────────────────────────────────
const DriverScanScreen         = lazy(() => import('./screens/driver/DriverScanScreen'))
const DriverResidentialRouteMap= lazy(() => import('./screens/driver/DriverResidentialRouteMap'))
const WarehouseCheckin         = lazy(() => import('./screens/driver/WarehouseCheckin').then(m => ({ default: m.WarehouseCheckin })))
const DriverHybridDashboard    = lazy(() => import('./screens/driver/DriverHybridDashboard'))
const ConsumerRoutes           = lazy(() => import('./screens/driver/ConsumerRoutes'))
const CommercialRoutes         = lazy(() => import('./screens/driver/CommercialRoutes'))
const HybridRoutes             = lazy(() => import('./screens/driver/HybridRoutes'))
const DriverDispatchMessages   = lazy(() => import('./screens/driver/DriverDispatchMessages'))
const CommercialSafetyChecklist= lazy(() => import('./screens/driver/CommercialSafetyChecklist'))
const CommercialStopDetail     = lazy(() => import('./screens/driver/CommercialStopDetail'))
const CommercialScan           = lazy(() => import('./screens/driver/CommercialScan'))
const CommercialInspection     = lazy(() => import('./screens/driver/CommercialInspection'))
const DriverEarnings           = lazy(() => import('./screens/driver/DriverEarnings'))
const DriverModeSelect         = lazy(() => import('./screens/driver/DriverModeSelect'))
const DriverModeLanding        = lazy(() => import('./screens/driver/DriverModeLanding'))
const DriverScanInspect        = lazy(() => import('./screens/driver/DriverScanInspect'))
const DriverOnboarding         = lazy(() => import('./screens/driver/DriverOnboarding'))
const DriverComplianceWizard   = lazy(() => import('./screens/driver/DriverComplianceWizard'))
const EarningsDashboardPage    = lazy(() => import('./screens/EarningsDashboardPage'))
const DriverRoutesPage         = lazy(() => import('./screens/DriverRoutesPage'))

// ─ Warehouse ──────────────────────────────────────────────────────────────────
const WarehouseAlertsPage      = lazy(() => import('./screens/warehouse/WarehouseAlertsPage'))
const WarehouseMessages        = lazy(() => import('./screens/warehouse/WarehouseMessages'))
const CommercialExpectedLoads  = lazy(() => import('./screens/warehouse/CommercialExpectedLoads'))
const CommercialIntake         = lazy(() => import('./screens/warehouse/CommercialIntake'))
const CommercialProcessing     = lazy(() => import('./screens/warehouse/CommercialProcessing'))
const WarehouseOnboarding      = lazy(() => import('./screens/warehouse/WarehouseOnboarding'))
// Phase G.9 — BagInspectionPage + BagLifecyclePage archived to src/screens/dev/.
// /bag-inspection and /bag-lifecycle now redirect to /live-inspection.
const ContaminationAlertsPage  = lazy(() => import('./screens/ContaminationAlertsPage'))

// ─ Commercial (customer-facing) ───────────────────────────────────────────────
const CommercialDashboard      = lazy(() => import('./screens/commercial/CommercialDashboard'))
const CommercialPickupRequest  = lazy(() => import('./screens/commercial/CommercialPickupRequest'))
const CommercialSchedule       = lazy(() => import('./screens/commercial/CommercialSchedule'))
const CommercialBins           = lazy(() => import('./screens/commercial/CommercialBins'))
const CommercialReports        = lazy(() => import('./screens/commercial/CommercialReports'))
const CommercialInvoices       = lazy(() => import('./screens/commercial/CommercialInvoices'))
const CommercialHistory        = lazy(() => import('./screens/commercial/CommercialHistory'))
const CommercialProfile        = lazy(() => import('./screens/commercial/CommercialProfile'))
const CommercialSupport        = lazy(() => import('./screens/commercial/CommercialSupport'))
const CommercialOnboarding        = lazy(() => import('./screens/commercial/CommercialOnboarding'))
const CommercialBillingDashboard  = lazy(() => import('./screens/commercial/CommercialBillingDashboard'))

// ─ Admin ──────────────────────────────────────────────────────────────────────
// Phase G.7 — AdminDashboardPage archived to src/screens/dev/; /admin-dashboard redirects to /dashboard/admin.
const AIMarketingCenter              = lazy(() => import('./screens/admin/AIMarketingCenter'))
const AdminCommercialDashboard       = lazy(() => import('./screens/admin/AdminCommercialDashboard'))
const AdminCommercialAccounts        = lazy(() => import('./screens/admin/AdminCommercialAccounts'))
const AdminCommercialPickups         = lazy(() => import('./screens/admin/AdminCommercialPickups'))
const AdminCommercialAlerts          = lazy(() => import('./screens/admin/AdminCommercialAlerts'))
const AdminCommercialReports         = lazy(() => import('./screens/admin/AdminCommercialReports'))
const AdminCommercialInspectionReview= lazy(() => import('./screens/admin/AdminCommercialInspectionReview'))
const AdminCommercialDispatch        = lazy(() => import('./screens/admin/AdminCommercialDispatch'))
const AdminCommercialSupport         = lazy(() => import('./screens/admin/AdminCommercialSupport'))
const AdminDriverPayouts             = lazy(() => import('./screens/admin/AdminDriverPayouts'))
const AdminPayoutsCenter             = lazy(() => import('./screens/admin/AdminPayoutsCenter'))
const PayoutWalletPage               = lazy(() => import('./screens/wallet/PayoutWalletPage'))
const AdminWarehouseAnalytics        = lazy(() => import('./screens/admin/AdminWarehouseAnalytics'))
const AdminRecyclingAnalytics        = lazy(() => import('./screens/admin/AdminRecyclingAnalytics'))
const InvestorDashboard              = lazy(() => import('./screens/admin/InvestorDashboard'))
const DispatcherLiveMap              = lazy(() => import('./screens/admin/DispatcherLiveMap'))
const AdminWarehouseDetail           = lazy(() => import('./screens/admin/AdminWarehouseDetail'))
const AdminWarehouseAlerts           = lazy(() => import('./screens/admin/AdminWarehouseAlerts'))
const AdminMessagingQA               = lazy(() => import('./screens/admin/AdminMessagingQA'))
const AdminApprovalsPage             = lazy(() => import('./screens/admin/AdminApprovalsPage'))
const AdminDriverCompliance          = lazy(() => import('./screens/admin/AdminDriverCompliance'))
const AdminRegions                   = lazy(() => import('./screens/admin/AdminRegions'))
const AdminForecasting               = lazy(() => import('./screens/admin/AdminForecasting'))
const AdminLaunchRoadmap             = lazy(() => import('./screens/admin/AdminLaunchRoadmap'))
const ReleaseNotesPage               = lazy(() => import('./screens/admin/ReleaseNotesPage'))
const LaunchCenter                   = lazy(() => import('./screens/admin/launch/LaunchCenter'))
const FraudDetectionPage             = lazy(() => import('./screens/FraudDetectionPage'))
const AIRecommendationsPage          = lazy(() => import('./screens/AIRecommendationsPage'))
// Phase G.7 — FundraiserAdminPage archived to src/screens/dev/; /fundraiser-admin redirects to /live-fundraiser-dashboard.
const PartnerDashboardPage           = lazy(() => import('./screens/PartnerDashboardPage'))
const ReportsCenterPage              = lazy(() => import('./screens/ReportsCenterPage'))

// ─ Municipal / Executive / Special roles ──────────────────────────────────────
const MunicipalDashboard       = lazy(() => import('./screens/municipal/MunicipalDashboard'))
const MunicipalReports         = lazy(() => import('./screens/municipal/MunicipalReports'))
const ExecutiveDashboard       = lazy(() => import('./screens/executive/ExecutiveDashboard'))

// ─ Billing ────────────────────────────────────────────────────────────────────
const PricingPage              = lazy(() => import('./screens/billing/PricingPage'))
const UsageDashboard           = lazy(() => import('./screens/billing/UsageDashboard'))

// ─ Settings ───────────────────────────────────────────────────────────────────
const NotificationPreferences  = lazy(() => import('./screens/settings/NotificationPreferences'))

// ─ Marketing / Public ─────────────────────────────────────────────────────────
const MarketingHome            = lazy(() => import('./screens/marketing/MarketingHome'))
const FeaturesPage             = lazy(() => import('./screens/marketing/FeaturesPage'))
const MarketingPricingPage     = lazy(() => import('./screens/marketing/MarketingPricingPage'))
const AboutPage                = lazy(() => import('./screens/marketing/AboutPage'))
const ContactPage              = lazy(() => import('./screens/marketing/ContactPage'))

// ─ Legal ──────────────────────────────────────────────────────────────────────
const TermsPage                = lazy(() => import('./screens/TermsPage'))
const PrivacyPage              = lazy(() => import('./screens/PrivacyPage'))
const ConsentPage              = lazy(() => import('./screens/ConsentPage'))
const LegalHubPage             = lazy(() => import('./screens/legal/LegalHubPage'))
const DataDeletionPage         = lazy(() => import('./screens/legal/DataDeletionPage'))
const ContactSupportPage       = lazy(() => import('./screens/legal/ContactSupportPage'))
const SafetyPolicyPage         = lazy(() => import('./screens/legal/SafetyPolicyPage'))
const DriverSafetyPage         = lazy(() => import('./screens/legal/DriverSafetyPage'))
const CommercialTermsPage      = lazy(() => import('./screens/legal/CommercialTermsPage'))
const PrivacyPolicy            = lazy(() => import('./screens/legal/PrivacyPolicy'))
const TermsOfService           = lazy(() => import('./screens/legal/TermsOfService'))

// ─ Beta / deploy / QA ─────────────────────────────────────────────────────────
const BetaHome                 = lazy(() => import('./screens/beta/BetaHome'))
// Phase G.7 — BetaFeedbackV2 is the canonical /beta/feedback screen.
// The duplicate Route declaration that mounted BetaFeedbackPage was dead
// (React Router matches the first match); it has been removed.
const BetaFeedbackV2           = lazy(() => import('./screens/beta/BetaFeedbackV2'))
const BetaChecklist            = lazy(() => import('./screens/beta/BetaChecklist'))
const ProductionChecklist      = lazy(() => import('./screens/deploy/ProductionChecklist'))
const AIMarketingQAChecklist   = lazy(() => import('./screens/qa/AIMarketingQAChecklist'))
const SupportContactPage       = lazy(() => import('./screens/support/SupportContactPage'))
const PresentationModePage     = lazy(() => import('./screens/PresentationModePage'))
const ReadinessChecklistPage   = lazy(() => import('./screens/ReadinessChecklistPage'))
const LaunchChecklistPage      = lazy(() => import('./screens/LaunchChecklistPage'))

// ── Role → home route map ─────────────────────────────────────────────────────
>>>>>>> Stashed changes
// Uses canonical DB role values (warehouse_employee, not 'warehouse').
// normalizeRole() from lib/auth is the single shared implementation.
const ROLE_HOME: Record<string, string> = {
  admin:                '/dashboard/admin',
  consumer:             '/dashboard/consumer',
  commercial:           '/dashboard/commercial',
  driver:               '/dashboard/driver',
  warehouse_employee:   '/dashboard/warehouse',
  warehouse_supervisor: '/dashboard/warehouse-supervisor',
  fundraiser:           '/dashboard/fundraiser',
  partner:              '/dashboard/partner',
  municipal_viewer:     '/dashboard/municipal',
  municipal_manager:    '/dashboard/municipal',
  city_admin:           '/dashboard/municipal',
  executive:            '/dashboard/executive',
  investor_viewer:      '/dashboard/executive',
  regional_admin:       '/dashboard/admin/regions',
  city_manager:         '/dashboard/admin/regions',
}

function HomeRedirect() {
  const { user, role, profile, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: '#060e24' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: '#00c8ff', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (!user) return <Navigate to="/real-login" replace />

  const normalized = normalizeRole(role)

  // Commercial account_type override
  if (profile?.account_type === 'commercial' || normalized === 'commercial') {
    return <Navigate to="/dashboard/commercial" replace />
  }

  // Driver routing by service type
  if (normalized === 'driver') {
    const dst = profile?.driver_service_type
    if (dst === 'consumer_only')  return <Navigate to="/dashboard/driver/consumer-routes" replace />
    if (dst === 'commercial_only') return <Navigate to="/dashboard/driver/commercial-routes" replace />
    return <Navigate to="/dashboard/driver/hybrid-routes" replace />
  }

  const dest = (normalized && ROLE_HOME[normalized]) ?? '/real-login'
  return <Navigate to={dest} replace />
}

function PushTokenManager() {
  usePushToken()
  return null
}

function ServiceWorkerManager() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})

    function onMessage(event: MessageEvent) {
      if (event.data?.type === 'navigate' && typeof event.data.target_route === 'string') {
        navigate(event.data.target_route)
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [navigate])

  return null
}

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
    <BrowserRouter>
      <PushTokenManager />
      <ServiceWorkerManager />
      <ModeBanner />
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

<<<<<<< Updated upstream
        {/* Role dashboards — access controlled by routePermissions.ts */}
        <Route path="/dashboard/consumer" element={<ProtectedRoute requireApproved allowDemo><ConsumerDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/driver" element={<ProtectedRoute requireApproved><DriverDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/driver/consumer-routes" element={<ProtectedRoute requireApproved><ConsumerRoutes /></ProtectedRoute>} />
        <Route path="/dashboard/driver/hybrid-routes"   element={<ProtectedRoute requireApproved><HybridRoutes /></ProtectedRoute>} />
        <Route path="/dashboard/warehouse" element={<ProtectedRoute requireApproved><WarehouseDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/warehouse-supervisor" element={<ProtectedRoute requireApproved><WarehouseSupervisorDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/partner" element={<ProtectedRoute requireApproved><PartnerDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/admin" element={<ProtectedRoute requireApproved><AdminDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/fundraiser" element={<ProtectedRoute requireApproved><FundraiserDashboard /></ProtectedRoute>} />

        {/* Commercial customer routes */}
        <Route path="/dashboard/commercial"          element={<ProtectedRoute requireApproved><CommercialDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/commercial/pickup"   element={<ProtectedRoute requireApproved><CommercialPickupRequest /></ProtectedRoute>} />
        <Route path="/dashboard/commercial/schedule" element={<ProtectedRoute requireApproved><CommercialSchedule /></ProtectedRoute>} />
        <Route path="/dashboard/commercial/bins"     element={<ProtectedRoute requireApproved><CommercialBins /></ProtectedRoute>} />
        <Route path="/dashboard/commercial/reports"  element={<ProtectedRoute requireApproved><CommercialReports /></ProtectedRoute>} />
        <Route path="/dashboard/commercial/invoices" element={<ProtectedRoute requireApproved><CommercialInvoices /></ProtectedRoute>} />
        <Route path="/dashboard/commercial/history"  element={<ProtectedRoute requireApproved><CommercialHistory /></ProtectedRoute>} />
        <Route path="/dashboard/commercial/profile"  element={<ProtectedRoute requireApproved><CommercialProfile /></ProtectedRoute>} />

        {/* Admin commercial */}
        <Route path="/dashboard/admin/commercial"          element={<ProtectedRoute requireApproved><AdminCommercialDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/admin/commercial/accounts" element={<ProtectedRoute requireApproved><AdminCommercialAccounts /></ProtectedRoute>} />
        <Route path="/dashboard/admin/commercial/pickups"  element={<ProtectedRoute requireApproved><AdminCommercialPickups /></ProtectedRoute>} />
        <Route path="/dashboard/admin/commercial/alerts"   element={<ProtectedRoute requireApproved><AdminCommercialAlerts /></ProtectedRoute>} />
        <Route path="/dashboard/admin/commercial/reports"       element={<ProtectedRoute requireApproved><AdminCommercialReports /></ProtectedRoute>} />
        <Route path="/dashboard/admin/commercial/inspections"  element={<ProtectedRoute requireApproved><AdminCommercialInspectionReview /></ProtectedRoute>} />
        <Route path="/dashboard/admin/commercial/dispatch"     element={<ProtectedRoute requireApproved><AdminCommercialDispatch /></ProtectedRoute>} />
        <Route path="/dashboard/admin/commercial/support"      element={<ProtectedRoute requireApproved><AdminCommercialSupport /></ProtectedRoute>} />
        <Route path="/dashboard/admin/driver-payouts"         element={<ProtectedRoute requireApproved><AdminDriverPayouts /></ProtectedRoute>} />
        <Route path="/dashboard/admin/warehouse-analytics"   element={<ProtectedRoute requireApproved><AdminWarehouseAnalytics /></ProtectedRoute>} />
        <Route path="/dashboard/admin/warehouses/:warehouseId" element={<ProtectedRoute requireApproved><AdminWarehouseDetail /></ProtectedRoute>} />
        <Route path="/dashboard/admin/warehouse-alerts"       element={<ProtectedRoute requireApproved><AdminWarehouseAlerts /></ProtectedRoute>} />
        <Route path="/dashboard/admin/messaging-qa"           element={<ProtectedRoute requireApproved><AdminMessagingQA /></ProtectedRoute>} />
        <Route path="/dashboard/commercial/support"            element={<ProtectedRoute requireApproved><CommercialSupport /></ProtectedRoute>} />
        <Route path="/dashboard/commercial/onboarding"        element={<ProtectedRoute><CommercialOnboarding /></ProtectedRoute>} />
=======
              {/* Role dashboards — access controlled by routePermissions.ts */}
              <Route path="/dashboard/consumer"           element={<ProtectedRoute requireApproved><ConsumerDashboard /></ProtectedRoute>} />
              <Route path="/dashboard/consumer/pickup"    element={<ProtectedRoute requireApproved><ConsumerPickupRequest /></ProtectedRoute>} />
              <Route path="/dashboard/driver"             element={<ProtectedRoute requireApproved><DriverDashboard /></ProtectedRoute>} />
              <Route path="/dashboard/driver/consumer-routes" element={<ProtectedRoute requireApproved><ConsumerRoutes /></ProtectedRoute>} />
              <Route path="/dashboard/driver/hybrid-routes"   element={<ProtectedRoute requireApproved><HybridRoutes /></ProtectedRoute>} />
              <Route path="/dashboard/warehouse"          element={<ProtectedRoute requireApproved><WarehouseDashboard /></ProtectedRoute>} />
              <Route path="/dashboard/warehouse-supervisor" element={<ProtectedRoute requireApproved><WarehouseSupervisorDashboard /></ProtectedRoute>} />
              <Route path="/dashboard/partner"            element={<ProtectedRoute requireApproved><PartnerDashboard /></ProtectedRoute>} />
              <Route path="/dashboard/admin"              element={<ProtectedRoute requireApproved><AdminDashboard /></ProtectedRoute>} />
              <Route path="/dashboard/fundraiser"         element={<ProtectedRoute requireApproved><FundraiserDashboard /></ProtectedRoute>} />
              <Route path="/dashboard/fundraiser/wallet" element={<ProtectedRoute requireApproved><PayoutWalletPage /></ProtectedRoute>} />

              {/* Commercial customer routes */}
              <Route path="/dashboard/commercial"          element={<ProtectedRoute requireApproved><CommercialDashboard /></ProtectedRoute>} />
              <Route path="/dashboard/commercial/pickup"   element={<ProtectedRoute requireApproved><CommercialPickupRequest /></ProtectedRoute>} />
              <Route path="/dashboard/commercial/schedule" element={<ProtectedRoute requireApproved><CommercialSchedule /></ProtectedRoute>} />
              <Route path="/dashboard/commercial/bins"     element={<ProtectedRoute requireApproved><CommercialBins /></ProtectedRoute>} />
              <Route path="/dashboard/commercial/reports"  element={<ProtectedRoute requireApproved><CommercialReports /></ProtectedRoute>} />
              <Route path="/dashboard/commercial/invoices" element={<ProtectedRoute requireApproved><CommercialInvoices /></ProtectedRoute>} />
              <Route path="/dashboard/commercial/history"  element={<ProtectedRoute requireApproved><CommercialHistory /></ProtectedRoute>} />
              <Route path="/dashboard/commercial/profile"  element={<ProtectedRoute requireApproved><CommercialProfile /></ProtectedRoute>} />
              <Route path="/dashboard/commercial/support"  element={<ProtectedRoute requireApproved><CommercialSupport /></ProtectedRoute>} />
              <Route path="/dashboard/commercial/onboarding" element={<ProtectedRoute><CommercialOnboarding /></ProtectedRoute>} />
              <Route path="/dashboard/commercial/billing"   element={<ProtectedRoute requireApproved><CommercialBillingDashboard /></ProtectedRoute>} />
              <Route path="/dashboard/commercial/wallet"   element={<ProtectedRoute requireApproved><PayoutWalletPage /></ProtectedRoute>} />

              {/* Admin commercial */}
              <Route path="/dashboard/admin/commercial"               element={<ProtectedRoute requireApproved><AdminCommercialDashboard /></ProtectedRoute>} />
              <Route path="/dashboard/admin/commercial/accounts"      element={<ProtectedRoute requireApproved><AdminCommercialAccounts /></ProtectedRoute>} />
              <Route path="/dashboard/admin/commercial/pickups"       element={<ProtectedRoute requireApproved><AdminCommercialPickups /></ProtectedRoute>} />
              <Route path="/dashboard/admin/commercial/alerts"        element={<ProtectedRoute requireApproved><AdminCommercialAlerts /></ProtectedRoute>} />
              <Route path="/dashboard/admin/commercial/reports"       element={<ProtectedRoute requireApproved><AdminCommercialReports /></ProtectedRoute>} />
              <Route path="/dashboard/admin/commercial/inspections"   element={<ProtectedRoute requireApproved><AdminCommercialInspectionReview /></ProtectedRoute>} />
              <Route path="/dashboard/admin/commercial/dispatch"      element={<ProtectedRoute requireApproved><AdminCommercialDispatch /></ProtectedRoute>} />
              <Route path="/dashboard/admin/commercial/support"       element={<ProtectedRoute requireApproved><AdminCommercialSupport /></ProtectedRoute>} />
              <Route path="/dashboard/admin/driver-payouts"          element={<ProtectedRoute requireApproved><AdminDriverPayouts /></ProtectedRoute>} />
              {/* Phase G.3 — Payouts Center (replaces driver-payouts for all payee types) */}
              <Route path="/dashboard/admin/payouts"              element={<ProtectedRoute requireApproved><AdminPayoutsCenter /></ProtectedRoute>} />
              <Route path="/dashboard/admin/warehouse-analytics"     element={<ProtectedRoute requireApproved><AdminWarehouseAnalytics /></ProtectedRoute>} />
              <Route path="/dashboard/admin/analytics"              element={<ProtectedRoute requireApproved><AdminRecyclingAnalytics /></ProtectedRoute>} />
              <Route path="/dashboard/admin/investor"              element={<ProtectedRoute requireApproved><InvestorDashboard /></ProtectedRoute>} />
              <Route path="/dashboard/admin/dispatch-map"          element={<ProtectedRoute requireApproved><DispatcherLiveMap /></ProtectedRoute>} />
              <Route path="/dashboard/admin/warehouses/:warehouseId" element={<ProtectedRoute requireApproved><AdminWarehouseDetail /></ProtectedRoute>} />
              <Route path="/dashboard/admin/warehouse-alerts"        element={<ProtectedRoute requireApproved><AdminWarehouseAlerts /></ProtectedRoute>} />
              <Route path="/dashboard/admin/messaging-qa"            element={<ProtectedRoute requireApproved><AdminMessagingQA /></ProtectedRoute>} />
              <Route path="/dashboard/admin/approvals"               element={<ProtectedRoute requireApproved><AdminApprovalsPage /></ProtectedRoute>} />
              <Route path="/dashboard/admin/driver-compliance"       element={<ProtectedRoute requireApproved><AdminDriverCompliance /></ProtectedRoute>} />
              <Route path="/dashboard/admin/regions"                 element={<ProtectedRoute requireApproved><AdminRegions /></ProtectedRoute>} />
              <Route path="/dashboard/admin/forecasting"             element={<ProtectedRoute requireApproved><AdminForecasting /></ProtectedRoute>} />
              <Route path="/dashboard/admin/launch-roadmap"          element={<ProtectedRoute requireApproved><AdminLaunchRoadmap /></ProtectedRoute>} />
              <Route path="/dashboard/admin/ai-marketing"            element={<ProtectedRoute requireApproved><AIMarketingCenter /></ProtectedRoute>} />
              <Route path="/dashboard/municipal"                     element={<ProtectedRoute requireApproved><MunicipalDashboard /></ProtectedRoute>} />
              <Route path="/dashboard/municipal/reports"             element={<ProtectedRoute requireApproved><MunicipalReports /></ProtectedRoute>} />
              <Route path="/dashboard/executive"                     element={<ProtectedRoute requireApproved><ExecutiveDashboard /></ProtectedRoute>} />
>>>>>>> Stashed changes

        {/* Onboarding — accessible before approval so new users can complete their application */}
        <Route path="/dashboard/driver/onboarding"            element={<ProtectedRoute><DriverOnboarding /></ProtectedRoute>} />
        <Route path="/dashboard/warehouse/onboarding"         element={<ProtectedRoute><WarehouseOnboarding /></ProtectedRoute>} />
        <Route path="/dashboard/admin/approvals"              element={<ProtectedRoute requireApproved><AdminApprovalsPage /></ProtectedRoute>} />
        <Route path="/dashboard/municipal"                    element={<ProtectedRoute requireApproved><MunicipalDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/municipal/reports"            element={<ProtectedRoute requireApproved><MunicipalReports /></ProtectedRoute>} />
        <Route path="/dashboard/executive"                    element={<ProtectedRoute requireApproved><ExecutiveDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/admin/regions"               element={<ProtectedRoute requireApproved><AdminRegions /></ProtectedRoute>} />
        <Route path="/dashboard/admin/forecasting"           element={<ProtectedRoute requireApproved><AdminForecasting /></ProtectedRoute>} />
        <Route path="/dashboard/admin/launch-roadmap"        element={<ProtectedRoute requireApproved><AdminLaunchRoadmap /></ProtectedRoute>} />

        {/* Settings */}
        <Route path="/settings/notifications" element={<ProtectedRoute requireApproved><NotificationPreferences /></ProtectedRoute>} />

        {/* Warehouse commercial */}
        <Route path="/dashboard/warehouse/expected-loads" element={<ProtectedRoute requireApproved><CommercialExpectedLoads /></ProtectedRoute>} />
        <Route path="/dashboard/warehouse/commercial-intake" element={<ProtectedRoute requireApproved><CommercialIntake /></ProtectedRoute>} />
        <Route path="/dashboard/warehouse/commercial-processing" element={<ProtectedRoute requireApproved><CommercialProcessing /></ProtectedRoute>} />
        <Route path="/dashboard/warehouse/alerts"              element={<ProtectedRoute requireApproved><WarehouseAlertsPage /></ProtectedRoute>} />
        <Route path="/dashboard/warehouse/messages"            element={<ProtectedRoute requireApproved><WarehouseMessages /></ProtectedRoute>} />

        {/* Driver route flow */}
        <Route path="/dashboard/driver/hybrid"                    element={<ProtectedRoute requireApproved><DriverHybridDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/driver/commercial-routes"         element={<ProtectedRoute requireApproved><CommercialRoutes /></ProtectedRoute>} />
        <Route path="/dashboard/driver/commercial-safety"         element={<ProtectedRoute requireApproved><CommercialSafetyChecklist /></ProtectedRoute>} />
        <Route path="/dashboard/driver/commercial-stop/:stopId"   element={<ProtectedRoute requireApproved><CommercialStopDetail /></ProtectedRoute>} />
        <Route path="/dashboard/driver/commercial-scan"           element={<ProtectedRoute requireApproved><CommercialScan /></ProtectedRoute>} />
        <Route path="/dashboard/driver/commercial-inspection"     element={<ProtectedRoute requireApproved><CommercialInspection /></ProtectedRoute>} />
        <Route path="/dashboard/driver/dispatch-messages"         element={<ProtectedRoute requireApproved><DriverDispatchMessages /></ProtectedRoute>} />
        <Route path="/dashboard/driver/route" element={<ProtectedRoute requireApproved><DriverRoutePage /></ProtectedRoute>} />
        <Route path="/dashboard/driver/routes" element={<ProtectedRoute requireApproved><DriverRoutePage /></ProtectedRoute>} />
        <Route path="/dashboard/driver/route-map" element={<ProtectedRoute requireApproved><DriverRoutePage /></ProtectedRoute>} />
        <Route path="/dashboard/driver/route/stop/:stopId" element={<ProtectedRoute requireApproved><RouteStopPage /></ProtectedRoute>} />
        <Route path="/dashboard/driver/warehouse-checkin" element={<ProtectedRoute requireApproved><WarehouseCheckinPage /></ProtectedRoute>} />
        <Route path="/dashboard/driver/scan"     element={<ProtectedRoute requireApproved><DriverScanScreen /></ProtectedRoute>} />
        <Route path="/dashboard/driver/earnings" element={<ProtectedRoute requireApproved><DriverEarnings /></ProtectedRoute>} />

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

<<<<<<< Updated upstream
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
        <Route path="/legal"                    element={<LegalHubPage />} />
        <Route path="/legal/data-deletion"      element={<DataDeletionPage />} />
        <Route path="/legal/contact"            element={<ContactSupportPage />} />
        <Route path="/legal/safety"             element={<SafetyPolicyPage />} />
        <Route path="/legal/driver-safety"      element={<DriverSafetyPage />} />
        <Route path="/legal/commercial-terms"   element={<CommercialTermsPage />} />
        <Route path="/legal/privacy-policy"     element={<PrivacyPolicy />} />
        <Route path="/legal/terms-of-service"   element={<TermsOfService />} />
        <Route path="/demo"                      element={<DemoOverview />} />
        <Route path="/beta"                      element={<BetaHome />} />
        <Route path="/beta/feedback"             element={<BetaFeedbackPage />} />
        <Route path="/beta/checklist"            element={<BetaChecklist />} />
        <Route path="/deploy/checklist"          element={<ProductionChecklist />} />
        <Route path="/presentation-mode"          element={<PresentationModePage />} />
        <Route path="/readiness-checklist"        element={<ReadinessChecklistPage />} />
        <Route path="/launch-checklist"           element={<LaunchChecklistPage />} />
      </Routes>
      <FullDemoHUD />
    </BrowserRouter>
=======
              {/* Settings */}
              <Route path="/settings/notifications" element={<ProtectedRoute requireApproved><NotificationPreferences /></ProtectedRoute>} />

              {/* Warehouse commercial */}
              <Route path="/dashboard/warehouse/expected-loads"       element={<ProtectedRoute requireApproved><CommercialExpectedLoads /></ProtectedRoute>} />
              <Route path="/dashboard/warehouse/commercial-intake"    element={<ProtectedRoute requireApproved><CommercialIntake /></ProtectedRoute>} />
              <Route path="/dashboard/warehouse/commercial-processing" element={<ProtectedRoute requireApproved><CommercialProcessing /></ProtectedRoute>} />
              <Route path="/dashboard/warehouse/alerts"               element={<ProtectedRoute requireApproved><WarehouseAlertsPage /></ProtectedRoute>} />
              <Route path="/dashboard/warehouse/messages"             element={<ProtectedRoute requireApproved><WarehouseMessages /></ProtectedRoute>} />

              {/* Driver route flow */}
              {/* Residential drivers land on the map-preview screen. */}
              <Route path="/dashboard/driver/route-map"      element={<ProtectedRoute requireApproved><DriverResidentialRouteMap /></ProtectedRoute>} />
              <Route path="/dashboard/driver/route"          element={<ProtectedRoute requireApproved><DriverResidentialRouteMap /></ProtectedRoute>} />
              <Route path="/dashboard/driver/routes"         element={<ProtectedRoute requireApproved><DriverResidentialRouteMap /></ProtectedRoute>} />
              {/* Commercial drivers get the Smart Driver Routing screen. */}
              <Route path="/dashboard/driver/commercial-route"      element={<ProtectedRoute requireApproved><DriverRoutesPage /></ProtectedRoute>} />
              <Route path="/dashboard/driver/hybrid"                element={<ProtectedRoute requireApproved><DriverHybridDashboard /></ProtectedRoute>} />
              <Route path="/dashboard/driver/commercial-routes"     element={<ProtectedRoute requireApproved><CommercialRoutes /></ProtectedRoute>} />
              {/* Phase G.5 — /dashboard/commercial-driver spec alias. CommercialRoutes already covers the screen. */}
              <Route path="/dashboard/commercial-driver"             element={<ProtectedRoute requireApproved><CommercialRoutes /></ProtectedRoute>} />
              <Route path="/dashboard/driver/commercial-safety"     element={<ProtectedRoute requireApproved><CommercialSafetyChecklist /></ProtectedRoute>} />
              <Route path="/dashboard/driver/commercial-stop/:stopId" element={<ProtectedRoute requireApproved><CommercialStopDetail /></ProtectedRoute>} />
              <Route path="/dashboard/driver/commercial-scan"       element={<ProtectedRoute requireApproved><CommercialScan /></ProtectedRoute>} />
              <Route path="/dashboard/driver/commercial-inspection" element={<ProtectedRoute requireApproved><CommercialInspection /></ProtectedRoute>} />
              <Route path="/dashboard/driver/dispatch-messages"     element={<ProtectedRoute requireApproved><DriverDispatchMessages /></ProtectedRoute>} />
              <Route path="/dashboard/driver/scan"                  element={<ProtectedRoute requireApproved><DriverScanScreen /></ProtectedRoute>} />
              <Route path="/dashboard/driver/earnings"              element={<ProtectedRoute requireApproved><DriverEarnings /></ProtectedRoute>} />
              {/* Phase G.3 — User Wallet (payout ledger view) */}
              <Route path="/dashboard/driver/wallet"              element={<ProtectedRoute requireApproved><PayoutWalletPage /></ProtectedRoute>} />

              {/* Bag lifecycle */}
              {/* Phase G.7 — /scan was a mock preview screen; redirect to the Supabase-backed /live-scan */}
              <Route path="/scan"              element={<Navigate to="/live-scan" replace />} />
              <Route path="/bag/:bagId"        element={<ProtectedRoute requireApproved><BagDetailScreen /></ProtectedRoute>} />
              <Route path="/bag/:bagId/inspect" element={<ProtectedRoute requireApproved><InspectionScreen /></ProtectedRoute>} />

              {/* Fundraisers — public (marketing / community pages) */}
              <Route path="/fundraisers"           element={<FundraisersPage />} />
              <Route path="/fundraisers/:id"       element={<FundraiserDetailPage />} />
              <Route path="/create-fundraiser"     element={<CreateFundraiserPage />} />
              <Route path="/leaderboard"           element={<LeaderboardPage />} />
              <Route path="/recycling-destination" element={<RecyclingDestinationPage />} />
              <Route path="/donation-receipt"      element={<DonationReceiptPage />} />

              {/* Auth-required: any approved user */}
              <Route path="/my-fundraiser" element={<RequireAuth><MyFundraiserPage /></RequireAuth>} />
              <Route path="/scan-result"   element={<RequireAuth><ScanResultPage /></RequireAuth>} />
              <Route path="/qr-scan"       element={<RequireAuth><QRScanPage /></RequireAuth>} />
              {/* Phase G.9 — /notifications was a hardcoded mock; redirect to Supabase-backed /live-notifications. */}
              <Route path="/notifications" element={<Navigate to="/live-notifications" replace />} />

              {/* Driver / Admin only */}
              <Route path="/earnings"      element={<RequireAuth><RequireRole roles={['driver','admin']}><EarningsDashboardPage /></RequireRole></RequireAuth>} />
              <Route path="/driver-routes" element={<RequireAuth><RequireRole roles={['driver','admin']}><DriverRoutesPage /></RequireRole></RequireAuth>} />

              {/* Warehouse / Admin only */}
              {/* Phase G.9 — mock screens archived; redirect to live /live-inspection. */}
              <Route path="/bag-inspection"       element={<Navigate to="/live-inspection" replace />} />
              <Route path="/bag-lifecycle"        element={<Navigate to="/live-inspection" replace />} />
              <Route path="/contamination-alerts" element={<RequireAuth><RequireRole roles={['admin','warehouse_employee','warehouse_supervisor']}><ContaminationAlertsPage /></RequireRole></RequireAuth>} />

              {/* Partner / Admin only */}
              <Route path="/partner-dashboard" element={<RequireAuth><RequireRole roles={['partner','admin']}><PartnerDashboardPage /></RequireRole></RequireAuth>} />
              <Route path="/reports"           element={<RequireAuth><RequireRole roles={['admin','partner']}><ReportsCenterPage /></RequireRole></RequireAuth>} />

              {/* Consumer only */}
              {/* Phase G.7 — /wallet was a mock screen; redirect to the Supabase-backed /live-wallet */}
              <Route path="/wallet" element={<Navigate to="/live-wallet" replace />} />

              {/* Admin only */}
              {/* Phase G.7 — /admin-dashboard mounted a hardcoded "City Impact" mock; redirect to the live /dashboard/admin */}
              <Route path="/admin-dashboard"    element={<Navigate to="/dashboard/admin" replace />} />
              <Route path="/fraud-detection"    element={<RequireAuth><RequireRole roles={['admin']}><FraudDetectionPage /></RequireRole></RequireAuth>} />
              <Route path="/ai-recommendations" element={<RequireAuth><RequireRole roles={['admin']}><AIRecommendationsPage /></RequireRole></RequireAuth>} />
              {/* Phase G.7 — /fundraiser-admin was a mock; redirect to the live per-campaign dashboard */}
              <Route path="/fundraiser-admin"   element={<Navigate to="/live-fundraiser-dashboard" replace />} />

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
              <Route path="/live-scan"                   element={<RequireAuth><RequireRole roles={['consumer']}><LiveScanPage /></RequireRole></RequireAuth>} />
              <Route path="/live-inspection"             element={<RequireAuth><LiveInspectionPage /></RequireAuth>} />
              <Route path="/live-fundraisers/:id"        element={<RequireAuth><LiveFundraiserDetailPage /></RequireAuth>} />
              <Route path="/live-my-fundraisers"         element={<RequireAuth><LiveMyFundraisersPage /></RequireAuth>} />
              <Route path="/live-fundraiser-dashboard"   element={<RequireAuth><RequireRole roles={['fundraiser_admin','admin']}><LiveFundraiserDashboardPage /></RequireRole></RequireAuth>} />
              <Route path="/live-notifications"          element={<RequireAuth><LiveNotificationsPage /></RequireAuth>} />
              <Route path="/live-payout-admin"           element={<RequireAuth><RequireRole roles={['admin']}><LivePayoutAdminPage /></RequireRole></RequireAuth>} />
              <Route path="/live-reports"                element={<RequireAuth><RequireRole roles={['admin','partner']}><LiveReportsPage /></RequireRole></RequireAuth>} />
              <Route path="/live-admin"                  element={<RequireAuth><RequireRole roles={['admin']}><LiveAdminPage /></RequireRole></RequireAuth>} />
              <Route path="/live-audit-log"              element={<RequireAuth><RequireRole roles={['admin']}><LiveAuditLogPage /></RequireRole></RequireAuth>} />
              <Route path="/live-settings"               element={<RequireAuth><RequireRole roles={['admin']}><LiveSettingsPage /></RequireRole></RequireAuth>} />
              <Route path="/live-warehouse"              element={<RequireAuth><RequireRole roles={['warehouse_employee','warehouse_supervisor']}><LiveWarehouseDashboard /></RequireRole></RequireAuth>} />
              <Route path="/live-warehouse-review"       element={<RequireAuth><RequireRole roles={['warehouse_employee','warehouse_supervisor']}><LiveWarehouseReviewPage /></RequireRole></RequireAuth>} />

              {/* Legal */}
              <Route path="/terms"   element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/consent" element={<ConsentPage />} />
              <Route path="/legal"                    element={<LegalHubPage />} />
              <Route path="/legal/data-deletion"      element={<DataDeletionPage />} />
              <Route path="/legal/contact"            element={<ContactSupportPage />} />
              <Route path="/legal/safety"             element={<SafetyPolicyPage />} />
              <Route path="/legal/driver-safety"      element={<DriverSafetyPage />} />
              <Route path="/legal/commercial-terms"   element={<CommercialTermsPage />} />
              <Route path="/legal/privacy-policy"     element={<PrivacyPolicy />} />
              <Route path="/legal/terms-of-service"   element={<TermsOfService />} />

              {/* ── Internal ops — admin only ── */}
              <Route path="/beta"             element={<RequireRole roles={['admin']}><BetaHome /></RequireRole>} />
              {/* Phase G.7 — /beta/feedback already declared at the top of this Routes block (BetaFeedbackV2); duplicate removed */}
              <Route path="/beta/checklist"   element={<RequireRole roles={['admin']}><BetaChecklist /></RequireRole>} />
              <Route path="/deploy/checklist" element={<RequireRole roles={['admin']}><ProductionChecklist /></RequireRole>} />
              <Route path="/presentation-mode"   element={<RequireRole roles={['admin']}><PresentationModePage /></RequireRole>} />
              <Route path="/readiness-checklist" element={<RequireRole roles={['admin']}><ReadinessChecklistPage /></RequireRole>} />
              <Route path="/launch-checklist"    element={<RequireRole roles={['admin']}><LaunchChecklistPage /></RequireRole>} />
            </Routes>
          </Suspense>
        </BrowserRouter>
>>>>>>> Stashed changes
      </ToastProvider>
    </ErrorBoundary>
  )
}

export default App
