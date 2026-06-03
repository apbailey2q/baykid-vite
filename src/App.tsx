import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { usePushToken } from './hooks/usePushToken'
import { normalizeRole } from './lib/auth'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastProvider } from './components/ui/Toast'
import { RequireAuth } from './components/RequireAuth'
import { RequireRole } from './components/RequireRole'

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
const ScannerScreen            = lazy(() => import('./screens/ScannerScreen'))
const BagDetailScreen          = lazy(() => import('./screens/BagDetailScreen'))
const InspectionScreen         = lazy(() => import('./screens/InspectionScreen'))
const WalletPage               = lazy(() => import('./screens/WalletPage'))
const NotificationsPage        = lazy(() => import('./screens/NotificationsPage'))
const ConsumerOnboarding       = lazy(() => import('./screens/onboarding/ConsumerOnboarding'))
const OnboardingDispatcher     = lazy(() => import('./screens/onboarding/OnboardingDispatcher'))
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
const EarningsDashboardPage    = lazy(() => import('./screens/EarningsDashboardPage'))
const DriverRoutesPage         = lazy(() => import('./screens/DriverRoutesPage'))

// ─ Warehouse ──────────────────────────────────────────────────────────────────
const WarehouseAlertsPage      = lazy(() => import('./screens/warehouse/WarehouseAlertsPage'))
const WarehouseMessages        = lazy(() => import('./screens/warehouse/WarehouseMessages'))
const CommercialExpectedLoads  = lazy(() => import('./screens/warehouse/CommercialExpectedLoads'))
const CommercialIntake         = lazy(() => import('./screens/warehouse/CommercialIntake'))
const CommercialProcessing     = lazy(() => import('./screens/warehouse/CommercialProcessing'))
const WarehouseOnboarding      = lazy(() => import('./screens/warehouse/WarehouseOnboarding'))
const BagInspectionPage        = lazy(() => import('./screens/BagInspectionPage'))
const BagLifecyclePage         = lazy(() => import('./screens/BagLifecyclePage'))
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
const AdminDashboardPage             = lazy(() => import('./screens/AdminDashboardPage'))
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
const AdminWarehouseAnalytics        = lazy(() => import('./screens/admin/AdminWarehouseAnalytics'))
const AdminRecyclingAnalytics        = lazy(() => import('./screens/admin/AdminRecyclingAnalytics'))
const InvestorDashboard              = lazy(() => import('./screens/admin/InvestorDashboard'))
const DispatcherLiveMap              = lazy(() => import('./screens/admin/DispatcherLiveMap'))
const AdminWarehouseDetail           = lazy(() => import('./screens/admin/AdminWarehouseDetail'))
const AdminWarehouseAlerts           = lazy(() => import('./screens/admin/AdminWarehouseAlerts'))
const AdminMessagingQA               = lazy(() => import('./screens/admin/AdminMessagingQA'))
const AdminApprovalsPage             = lazy(() => import('./screens/admin/AdminApprovalsPage'))
const AdminRegions                   = lazy(() => import('./screens/admin/AdminRegions'))
const AdminForecasting               = lazy(() => import('./screens/admin/AdminForecasting'))
const AdminLaunchRoadmap             = lazy(() => import('./screens/admin/AdminLaunchRoadmap'))
const ReleaseNotesPage               = lazy(() => import('./screens/admin/ReleaseNotesPage'))
const LaunchCenter                   = lazy(() => import('./screens/admin/launch/LaunchCenter'))
const FraudDetectionPage             = lazy(() => import('./screens/FraudDetectionPage'))
const AIRecommendationsPage          = lazy(() => import('./screens/AIRecommendationsPage'))
const FundraiserAdminPage            = lazy(() => import('./screens/FundraiserAdminPage'))
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
const BetaFeedbackPage         = lazy(() => import('./screens/beta/BetaFeedbackPage'))
const BetaFeedbackV2           = lazy(() => import('./screens/beta/BetaFeedbackV2'))
const BetaChecklist            = lazy(() => import('./screens/beta/BetaChecklist'))
const ProductionChecklist      = lazy(() => import('./screens/deploy/ProductionChecklist'))
const AIMarketingQAChecklist   = lazy(() => import('./screens/qa/AIMarketingQAChecklist'))
const SupportContactPage       = lazy(() => import('./screens/support/SupportContactPage'))
const PresentationModePage     = lazy(() => import('./screens/PresentationModePage'))
const ReadinessChecklistPage   = lazy(() => import('./screens/ReadinessChecklistPage'))
const LaunchChecklistPage      = lazy(() => import('./screens/LaunchChecklistPage'))

// ── Role → home route map ─────────────────────────────────────────────────────
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

  // Unauthenticated visitors land on the public marketing site. They can
  // navigate to /real-login or /signup from there. Authenticated users
  // continue through the role-based dashboard redirects below.
  if (!user) return <Navigate to="/marketing" replace />

  const normalized = normalizeRole(role)

  // Commercial account_type override
  if (profile?.account_type === 'commercial' || normalized === 'commercial') {
    return <Navigate to="/dashboard/commercial" replace />
  }

  // Driver routing by service type
  if (normalized === 'driver') {
    const dst = profile?.driver_service_type
    if (dst === 'consumer_only')   return <Navigate to="/dashboard/driver/consumer-routes" replace />
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
          {/* Suspense catches any lazy chunk that is still loading */}
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<HomeRedirect />} />
              <Route path="/welcome" element={<WelcomePage />} />
              <Route path="/real-login" element={<RealLoginPage />} />
              <Route path="/login" element={<Navigate to="/real-login" replace />} />
              <Route path="/signup" element={<SignupScreen />} />
              <Route
                path="/pending-approval"
                element={
                  <ProtectedRoute>
                    <PendingApprovalScreen />
                  </ProtectedRoute>
                }
              />
              {/* Driver-specific landing for unapproved drivers — same screen,
                  role-aware copy. PendingApprovalScreen detects the URL prefix. */}
              <Route
                path="/driver/pending-approval"
                element={
                  <ProtectedRoute>
                    <PendingApprovalScreen />
                  </ProtectedRoute>
                }
              />

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
              <Route path="/dashboard/admin/warehouse-analytics"     element={<ProtectedRoute requireApproved><AdminWarehouseAnalytics /></ProtectedRoute>} />
              <Route path="/dashboard/admin/analytics"              element={<ProtectedRoute requireApproved><AdminRecyclingAnalytics /></ProtectedRoute>} />
              <Route path="/dashboard/admin/investor"              element={<ProtectedRoute requireApproved><InvestorDashboard /></ProtectedRoute>} />
              <Route path="/dashboard/admin/dispatch-map"          element={<ProtectedRoute requireApproved><DispatcherLiveMap /></ProtectedRoute>} />
              <Route path="/dashboard/admin/warehouses/:warehouseId" element={<ProtectedRoute requireApproved><AdminWarehouseDetail /></ProtectedRoute>} />
              <Route path="/dashboard/admin/warehouse-alerts"        element={<ProtectedRoute requireApproved><AdminWarehouseAlerts /></ProtectedRoute>} />
              <Route path="/dashboard/admin/messaging-qa"            element={<ProtectedRoute requireApproved><AdminMessagingQA /></ProtectedRoute>} />
              <Route path="/dashboard/admin/approvals"               element={<ProtectedRoute requireApproved><AdminApprovalsPage /></ProtectedRoute>} />
              <Route path="/dashboard/admin/regions"                 element={<ProtectedRoute requireApproved><AdminRegions /></ProtectedRoute>} />
              <Route path="/dashboard/admin/forecasting"             element={<ProtectedRoute requireApproved><AdminForecasting /></ProtectedRoute>} />
              <Route path="/dashboard/admin/launch-roadmap"          element={<ProtectedRoute requireApproved><AdminLaunchRoadmap /></ProtectedRoute>} />
              <Route path="/dashboard/admin/ai-marketing"            element={<ProtectedRoute requireApproved><AIMarketingCenter /></ProtectedRoute>} />
              <Route path="/dashboard/municipal"                     element={<ProtectedRoute requireApproved><MunicipalDashboard /></ProtectedRoute>} />
              <Route path="/dashboard/municipal/reports"             element={<ProtectedRoute requireApproved><MunicipalReports /></ProtectedRoute>} />
              <Route path="/dashboard/executive"                     element={<ProtectedRoute requireApproved><ExecutiveDashboard /></ProtectedRoute>} />

              {/* Onboarding — accessible before approval so new users can complete their application */}
              <Route path="/dashboard/driver/onboarding"    element={<ProtectedRoute><DriverOnboarding /></ProtectedRoute>} />
              <Route path="/dashboard/warehouse/onboarding" element={<ProtectedRoute><WarehouseOnboarding /></ProtectedRoute>} />
              <Route path="/onboarding"                      element={<ProtectedRoute><OnboardingDispatcher /></ProtectedRoute>} />
              <Route path="/onboarding/consumer"             element={<ProtectedRoute><ConsumerOnboarding /></ProtectedRoute>} />
              <Route path="/welcome-back"                    element={<ProtectedRoute><WelcomeBack /></ProtectedRoute>} />

              {/* ── Driver mode flow (approved drivers only) ── */}
              <Route path="/driver/mode"             element={<ProtectedRoute requireApproved><DriverModeSelect /></ProtectedRoute>} />
              <Route path="/driver/residential"      element={<ProtectedRoute requireApproved><DriverModeLanding mode="residential" /></ProtectedRoute>} />
              <Route path="/driver/commercial"       element={<ProtectedRoute requireApproved><DriverModeLanding mode="commercial"  /></ProtectedRoute>} />
              <Route path="/driver/scan"             element={<ProtectedRoute requireApproved><DriverScanInspect mode="residential" /></ProtectedRoute>} />
              <Route path="/driver/commercial-scan"  element={<ProtectedRoute requireApproved><DriverScanInspect mode="commercial"  /></ProtectedRoute>} />
              <Route path="/driver/warehouse-checkin" element={<ProtectedRoute requireApproved><WarehouseCheckin /></ProtectedRoute>} />

              {/* SaaS billing */}
              <Route path="/admin/billing/plans" element={<ProtectedRoute requireApproved><PricingPage /></ProtectedRoute>} />
              <Route path="/admin/billing/usage" element={<ProtectedRoute requireApproved><UsageDashboard /></ProtectedRoute>} />

              {/* Beta launch surfaces (QA + support + release notes + beta feedback) */}
              <Route path="/admin/qa/ai-marketing" element={<ProtectedRoute requireApproved><AIMarketingQAChecklist /></ProtectedRoute>} />
              <Route path="/admin/release-notes"   element={<ProtectedRoute requireApproved><ReleaseNotesPage /></ProtectedRoute>} />
              <Route path="/support/contact"       element={<ProtectedRoute><SupportContactPage /></ProtectedRoute>} />
              <Route path="/beta/feedback"         element={<ProtectedRoute><BetaFeedbackV2 /></ProtectedRoute>} />

              {/* Launch Execution Center — admin-only hub */}
              <Route path="/admin/launch" element={<ProtectedRoute requireApproved><LaunchCenter /></ProtectedRoute>} />

              {/* Public marketing site — no auth required */}
              <Route path="/marketing" element={<MarketingHome />} />
              <Route path="/features"  element={<FeaturesPage />} />
              <Route path="/pricing"   element={<MarketingPricingPage />} />
              <Route path="/about"     element={<AboutPage />} />
              <Route path="/contact"   element={<ContactPage />} />

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
              <Route path="/dashboard/driver/commercial-safety"     element={<ProtectedRoute requireApproved><CommercialSafetyChecklist /></ProtectedRoute>} />
              <Route path="/dashboard/driver/commercial-stop/:stopId" element={<ProtectedRoute requireApproved><CommercialStopDetail /></ProtectedRoute>} />
              <Route path="/dashboard/driver/commercial-scan"       element={<ProtectedRoute requireApproved><CommercialScan /></ProtectedRoute>} />
              <Route path="/dashboard/driver/commercial-inspection" element={<ProtectedRoute requireApproved><CommercialInspection /></ProtectedRoute>} />
              <Route path="/dashboard/driver/dispatch-messages"     element={<ProtectedRoute requireApproved><DriverDispatchMessages /></ProtectedRoute>} />
              <Route path="/dashboard/driver/scan"                  element={<ProtectedRoute requireApproved><DriverScanScreen /></ProtectedRoute>} />
              <Route path="/dashboard/driver/earnings"              element={<ProtectedRoute requireApproved><DriverEarnings /></ProtectedRoute>} />

              {/* Bag lifecycle */}
              <Route path="/scan"              element={<ProtectedRoute requireApproved><ScannerScreen /></ProtectedRoute>} />
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
              <Route path="/notifications" element={<RequireAuth><NotificationsPage /></RequireAuth>} />

              {/* Driver / Admin only */}
              <Route path="/earnings"      element={<RequireAuth><RequireRole roles={['driver','admin']}><EarningsDashboardPage /></RequireRole></RequireAuth>} />
              <Route path="/driver-routes" element={<RequireAuth><RequireRole roles={['driver','admin']}><DriverRoutesPage /></RequireRole></RequireAuth>} />

              {/* Warehouse / Admin only */}
              <Route path="/bag-inspection"       element={<RequireAuth><RequireRole roles={['admin','warehouse_employee','warehouse_supervisor']}><BagInspectionPage /></RequireRole></RequireAuth>} />
              <Route path="/bag-lifecycle"        element={<RequireAuth><RequireRole roles={['admin','warehouse_employee','warehouse_supervisor']}><BagLifecyclePage /></RequireRole></RequireAuth>} />
              <Route path="/contamination-alerts" element={<RequireAuth><RequireRole roles={['admin','warehouse_employee','warehouse_supervisor']}><ContaminationAlertsPage /></RequireRole></RequireAuth>} />

              {/* Partner / Admin only */}
              <Route path="/partner-dashboard" element={<RequireAuth><RequireRole roles={['partner','admin']}><PartnerDashboardPage /></RequireRole></RequireAuth>} />
              <Route path="/reports"           element={<RequireAuth><RequireRole roles={['admin','partner']}><ReportsCenterPage /></RequireRole></RequireAuth>} />

              {/* Consumer only */}
              <Route path="/wallet" element={<RequireAuth><RequireRole roles={['consumer','admin']}><WalletPage /></RequireRole></RequireAuth>} />

              {/* Admin only */}
              <Route path="/admin-dashboard"    element={<RequireAuth><RequireRole roles={['admin']}><AdminDashboardPage /></RequireRole></RequireAuth>} />
              <Route path="/fraud-detection"    element={<RequireAuth><RequireRole roles={['admin']}><FraudDetectionPage /></RequireRole></RequireAuth>} />
              <Route path="/ai-recommendations" element={<RequireAuth><RequireRole roles={['admin']}><AIRecommendationsPage /></RequireRole></RequireAuth>} />
              <Route path="/fundraiser-admin"   element={<RequireAuth><RequireRole roles={['admin','fundraiser']}><FundraiserAdminPage /></RequireRole></RequireAuth>} />

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
              <Route path="/beta/feedback"    element={<RequireRole roles={['admin']}><BetaFeedbackPage /></RequireRole>} />
              <Route path="/beta/checklist"   element={<RequireRole roles={['admin']}><BetaChecklist /></RequireRole>} />
              <Route path="/deploy/checklist" element={<RequireRole roles={['admin']}><ProductionChecklist /></RequireRole>} />
              <Route path="/presentation-mode"   element={<RequireRole roles={['admin']}><PresentationModePage /></RequireRole>} />
              <Route path="/readiness-checklist" element={<RequireRole roles={['admin']}><ReadinessChecklistPage /></RequireRole>} />
              <Route path="/launch-checklist"    element={<RequireRole roles={['admin']}><LaunchChecklistPage /></RequireRole>} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  )
}

export default App
