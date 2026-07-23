import { Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { RequirePermission } from '@/components/RequirePermission';
import { RequireActiveStoreMember } from '@/components/RequireActiveStoreMember';
import CreateStore from '@/pages/CreateStore';
import { useSecurityContext } from '@/hooks/useSecurityContext';
import { usePermissions } from '@/hooks/usePermissions';
import { getActiveStoreId } from '@/utils/activeStore';
import { hasEffectivePermission } from '@/utils/permissions';
import { useState, useEffect } from 'react';

function AdminLanding() {
  const activeStoreId = getActiveStoreId();
  const { securityContext, loading: securityLoading } = useSecurityContext();
  const { permissions, loading: permissionsLoading } = usePermissions(activeStoreId);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);

  const activeMembership = securityContext?.memberships?.find(
    (m) => m.store_id === activeStoreId && m.status === 'active'
  ) || securityContext?.primary_membership || null;

  const isOwner = activeMembership?.role === 'owner';
  const hasDashboardView = isOwner || hasEffectivePermission(permissions, 'dashboard.view');

  useEffect(() => {
    if (securityLoading || permissionsLoading || !activeStoreId) return;

    if (hasDashboardView) {
      setRedirectPath('/admin');
    } else {
      setRedirectPath('/admin/my-profile');
    }
  }, [securityLoading, permissionsLoading, activeStoreId, hasDashboardView]);

  if (securityLoading || permissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#19A999]"></div>
      </div>
    );
  }

  if (hasDashboardView) {
    return <Dashboard />;
  }

  if (redirectPath) {
    return <Navigate to={redirectPath} replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#19A999]"></div>
    </div>
  );
}


// Layouts
const PublicLayout = lazy(() => import('@/components/layouts/PublicLayout'));
const PrivateLayout = lazy(() => import('@/components/layouts/PrivateLayout'));

// Initial pages
const Landing = lazy(() => import('@/pages/initial/home/Landing'));
const Login = lazy(() => import('@/pages/initial/auth/Login'));
const Signup = lazy(() => import('@/pages/initial/auth/SignUp'));
const ActivateInvite = lazy(() => import('@/pages/initial/auth/ActivateInvite'));
const ForgotPassword = lazy(() => import('@/pages/initial/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/initial/auth/ResetPassword'));
const Terms = lazy(() => import('@/pages/initial/legal/Terms'));
const PrivacyPolicy = lazy(() => import('@/pages/initial/legal/PrivacyPolicy'));

// Lazy load store routes
const Catalog = lazy(() => import('@/pages/store/Catalog'));
const Checkout = lazy(() => import('@/pages/store/Checkout'));
const PublicOrderTracking = lazy(() => import('@/pages/store/PublicOrderTracking'));
const StoreLayout = lazy(() => import('@/components/layouts/StoreLayout').then(m => ({ default: m.StoreLayout })));

// Dashboard Section
const Dashboard = lazy(() => import('@/pages/private/admin/dashboard/Dashboard'));
const Activity = lazy(() => import('@/pages/private/admin/dashboard/Activity'));
const Alerts = lazy(() => import('@/pages/private/admin/dashboard/Alerts'));
const Reports = lazy(() => import('@/pages/private/admin/dashboard/Reports'));

// Commercial e Customer Section
const Orders = lazy(() => import('@/pages/private/admin/commercial/orders/Orders'));
const DirectSalesPage = lazy(() => import('@/pages/private/admin/commercial/directSales/DirectSalesPage'));
const Customers = lazy(() => import('@/pages/private/admin/customers/Customers'));
const CustomerFormPage = lazy(() => import('@/pages/private/admin/customers/CustomerFormPage'));
const CustomerEditPage = lazy(() => import('@/pages/private/admin/customers/CustomerEditPage'));
const CustomerLifecyclePage = lazy(() => import('@/pages/private/admin/customers/CustomerLifecyclePage'));
const LoyaltyConfig = lazy(() => import('@/pages/private/admin/commercial/loyalty/LoyaltyConfig'));
const LoyaltyAdvancedPage = lazy(() => import('@/pages/private/admin/loyalty/LoyaltyAdvancedPage'));
const CommercialDashboardPage = lazy(() => import('@/pages/private/admin/commercial/dashboard/CommercialDashboardPage'));
const AdminMessages = lazy(() => import('@/pages/private/admin/commercial/messages/Messages'));
const SalesChannelsPage = lazy(() => import('@/pages/private/admin/commercial/salesChannels/SalesChannelsPage'));

// Cashbook/Payments/Financial Section
const CashbookPage = lazy(() => import('@/pages/private/admin/financial/cashbook/CashbookPage'));
const AccountPlanPage = lazy(() => import('@/pages/private/admin/financial/accountPlan/AccountPlanPage'));
const FinancialAccountsSettingsPage = lazy(() => import('@/pages/private/admin/settings/financialAccounts/FinancialAccountsSettingsPage'));

// Products/Inventory/Suppliers/Purchases Section
const Products = lazy(() => import('@/pages/private/admin/products/Products'));
const InventoryByLocationPage = lazy(() => import('@/pages/private/admin/products/inventory/InventoryByLocationPage'));
const TransfersPage = lazy(() => import('@/pages/private/admin/products/inventory/TransfersPage'));
const TransferDetailPage = lazy(() => import('@/pages/private/admin/products/inventory/TransferDetailPage'));
const Categories = lazy(() => import('@/pages/private/admin/products/Categories'));
const ProductLifecyclePage = lazy(() => import('@/pages/private/admin/products/inventory/ProductLifecyclePage'));
const ProductLifecycleSelectorPage = lazy(() => import('@/pages/private/admin/products/inventory/ProductLifecycleSelectorPage'));
const StockMovements = lazy(() => import('@/pages/private/admin/products/inventory/StockMovements'));
const PurchasesLedger = lazy(() => import('@/pages/private/admin/products/inventory/PurchasesLedger'));
const PurchaseDocumentsPage = lazy(() => import('@/pages/private/admin/products/inventory/PurchaseDocumentsPage'));
const PurchaseQuotationsPage = lazy(() => import('@/pages/private/admin/products/inventory/PurchaseQuotationsPage'));
const PurchaseInsightsPage = lazy(() => import('@/pages/private/admin/products/inventory/PurchaseInsightsPage'));
const Suppliers = lazy(() => import('@/pages/private/admin/products/Suppliers'));
const SupplierLifecyclePage = lazy(() => import('@/pages/private/admin/products/inventory/SupplierLifecyclePage'));
const SupplierDetailPage = lazy(() => import('@/pages/private/admin/suppliers/SupplierDetailPage'));
// Users Section
const Users = lazy(() => import('@/pages/private/admin/users/Users'));

// Legal/Support/Setting Section
const Legal = lazy(() => import('@/pages/private/admin/support/Legal'));
const FAQ = lazy(() => import('@/pages/private/admin/support/FAQ'));
const Settings = lazy(() => import('@/pages/private/admin/settings/storeSettings/StoreSettings'));
const Profile = lazy(() => import('@/pages/private/admin/settings/profile/Profile'));
const MyHistory = lazy(() => import('@/pages/private/admin/settings/myHistory/MyHistory'));
const MessageSettings = lazy(() => import('@/pages/private/admin/settings/messages/MessageSettings'));
const Security = lazy(() => import('@/pages/private/admin/settings/security/Security'));
const Documentation = lazy(() => import('@/pages/private/admin/support/Documentation'));

// Marketing Section
const MarketingCenterPage = lazy(() => import('@/pages/private/admin/marketing/MarketingCenterPage'));

// Loading fallback component
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#19A999]"></div>
  </div>
);

export default function AppRoutes() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        {/* Public Routes - All wrapped in PublicLayout */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/activate-invite" element={<ActivateInvite />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/politica-privacidade" element={<PrivacyPolicy />} />
        </Route>

        {/* Store Routes - Also public */}
        <Route element={<StoreLayout><Outlet /></StoreLayout>}>
          <Route path="/s/:storeSlug" element={<Catalog />} />
          <Route path="/loja/:storeSlug" element={<Catalog />} />
          <Route path="/cardapio/:storeSlug" element={<Catalog />} />
          <Route path="/q/:storeSlug/:tableCode" element={<Catalog />} />
          <Route path="/mesa/:storeSlug/:tableCode" element={<Catalog />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/p/:publicOrderToken" element={<PublicOrderTracking />} />
        </Route>

        {/* Protected Routes - All wrapped in PrivateLayout */}
        <Route element={<ProtectedRoute />}>
          <Route path="/onboarding/create-store" element={<CreateStore />} />
          <Route element={<PrivateLayout />}>
            // Dashboard Section
            <Route path="/admin" element={<AdminLanding />} />
            <Route path="/admin/activity" element={<RequirePermission permission="dashboard.activity.view"><Activity /></RequirePermission>} />
            <Route path="/admin/alerts" element={<RequirePermission permission="dashboard.alerts.view"><Alerts /></RequirePermission>} />
            <Route path="/admin/reports" element={<RequirePermission permission="reports.view"><Reports /></RequirePermission>} />

            // Commercial Section
            <Route
              path="/admin/orders"
              element={
                <RequirePermission permission="orders.view">
                  <Orders />
                </RequirePermission>
              }
            />
            <Route
              path="/admin/direct-sales"
              element={
                <RequirePermission permission="orders.manage">
                  <DirectSalesPage />
                </RequirePermission>
              }
            />
            <Route path="/admin/sales-channels" element={<RequirePermission permission="commercial.sales_channels.view"><SalesChannelsPage /></RequirePermission>} />
            <Route path="/admin/payment-methods" element={<Navigate to="/admin/settings?tab=payment" replace />} />
            <Route path="/admin/payments" element={<Navigate to="/admin/settings?tab=payment" replace />} />
            <Route path="/admin/delivery" element={<Navigate to="/admin/settings?tab=delivery" replace />} />
            <Route path="/admin/commercial-dashboard" element={<RequirePermission permission="commercial.dashboard.view"><CommercialDashboardPage /></RequirePermission>} />
            <Route path="/admin/commercial-settings" element={<Navigate to="/admin/settings?tab=commercial" replace />} />
            <Route path="/admin/customers" element={<RequirePermission permission="customers.view"><Customers /></RequirePermission>} />
            <Route path="/admin/loyalty" element={<RequirePermission permission="loyalty.view"><LoyaltyConfig /></RequirePermission>} />
            <Route path="/admin/loyalty/advanced" element={<RequirePermission permission="loyalty.view"><LoyaltyAdvancedPage /></RequirePermission>} />
            <Route path="/admin/messages-admin" element={<RequirePermission permission="messages.view"><AdminMessages /></RequirePermission>} />
            <Route path="/admin/marketing" element={<RequirePermission permission="marketing.view"><MarketingCenterPage /></RequirePermission>} />

            // Customers Section
            <Route path="/admin/customers/new" element={<RequirePermission permission="customers.view"><CustomerFormPage /></RequirePermission>} />
            <Route path="/admin/customers/:customerId/edit" element={<RequirePermission permission="customers.view"><CustomerEditPage /></RequirePermission>} />
            <Route path="/admin/customers/:customerId" element={<RequirePermission permission="customers.view"><CustomerLifecyclePage /></RequirePermission>} />

            // Financial Section
            <Route path="/admin/cashbook" element={<RequirePermission permission="cashbook.view"><CashbookPage /></RequirePermission>} />
            <Route path="/admin/account-plan" element={<RequirePermission permission="financial.account_plan.view"><AccountPlanPage /></RequirePermission>} />
            <Route path="/admin/financial-accounts" element={<RequirePermission permission="financial.accounts.view"><FinancialAccountsSettingsPage /></RequirePermission>} />

            // Products Section
            <Route
              path="/admin/products"
              element={
                <RequirePermission permission="products.manage">
                  <Products />
                </RequirePermission>
              }
            />
            <Route path="/admin/categories" element={<RequirePermission permission="categories.view"><Categories /></RequirePermission>} />
            <Route path="/admin/inventory" element={<RequirePermission permission="stock.view"><InventoryByLocationPage /></RequirePermission>} />
            <Route path="/admin/products/lifecycle" element={<RequirePermission permission="products.manage"><ProductLifecycleSelectorPage /></RequirePermission>} />
            <Route path="/admin/products/:id/lifecycle" element={<RequirePermission permission="products.manage"><ProductLifecyclePage /></RequirePermission>} />
            <Route
              path="/admin/transfers"
              element={
                <RequirePermission permission="transfers.view">
                  <TransfersPage />
                </RequirePermission>
              }
            />
            <Route path="/admin/transfers/:id" element={<RequirePermission permission="transfers.view"><TransferDetailPage /></RequirePermission>} />
            <Route path="/admin/suppliers" element={<RequirePermission permission="suppliers.view"><Suppliers /></RequirePermission>} />
            <Route path="/admin/suppliers/:supplierId/lifecycle" element={<RequirePermission permission="suppliers.view"><SupplierLifecyclePage /></RequirePermission>} />
            <Route path="/admin/suppliers/:id" element={<RequirePermission permission="suppliers.view"><SupplierDetailPage /></RequirePermission>} />
            <Route path="/admin/cashbook/purchases" element={<RequirePermission permission="purchases.view"><PurchasesLedger /></RequirePermission>} />
            <Route path="/admin/stock/purchase-documents" element={<RequirePermission permission="purchases.view"><PurchaseDocumentsPage /></RequirePermission>} />
            <Route path="/admin/stock/purchase-insights" element={<RequirePermission permission="purchases.view"><PurchaseInsightsPage /></RequirePermission>} />
            <Route path="/admin/stock/quotations" element={<RequirePermission permission="quotes.view"><PurchaseQuotationsPage /></RequirePermission>} />
            <Route path="/admin/stock/movements" element={<RequirePermission permission="stock.view"><StockMovements /></RequirePermission>} />
            <Route path="/admin/stock-movements" element={<Navigate to="/admin/stock/movements" replace />} />
            <Route path="/admin/stock/entries" element={<Navigate to="/admin/stock-movements?type=entry" replace />} />
            <Route path="/admin/stock/exits" element={<Navigate to="/admin/stock-movements?type=exit" replace />} />
            <Route path="/admin/stock-settings" element={<Navigate to="/admin/settings?tab=stock" replace />} />
            <Route path="/admin/stock/clearance" element={<Navigate to="/admin/stock-movements?type=clearance" replace />} />

            //Users Section
            <Route
              path="/admin/users"
              element={
                <RequirePermission permission="users.view">
                  <Users />
                </RequirePermission>
              }
            />

            //Settings Section
            <Route path="/admin/config" element={<Navigate to="/admin/settings?tab=orders" replace />} />
            <Route
              path="/admin/settings"
              element={
                <RequirePermission permissions={['settings.view']}>
                  <Settings />
                </RequirePermission>
              }
            />
            <Route
              path="/admin/my-profile"
              element={
                <RequireActiveStoreMember>
                  <Profile />
                </RequireActiveStoreMember>
              }
            />
            <Route
              path="/admin/meus-dados"
              element={
                <RequireActiveStoreMember>
                  <Profile />
                </RequireActiveStoreMember>
              }
            />
            <Route
              path="/admin/my-history"
              element={
                <RequireActiveStoreMember>
                  <MyHistory />
                </RequireActiveStoreMember>
              }
            />
            <Route path="/admin/hours" element={<Navigate to="/admin/settings?tab=hours" replace />} />
            <Route path="/admin/messages" element={<RequirePermission permission="messages.view"><MessageSettings /></RequirePermission>} />
            <Route
              path="/admin/security"
              element={
                <RequirePermission permissions={['security.view']}>
                  <Security />
                </RequirePermission>
              }
            />

            //Help Section
            <Route path="/admin/legal" element={<RequirePermission permission="support.view"><Legal /></RequirePermission>} />
            <Route path="/admin/faq" element={<RequirePermission permission="support.view"><FAQ /></RequirePermission>} />
            <Route path="/admin/docs" element={<RequirePermission permission="support.view"><Documentation /></RequirePermission>} />
          </Route>
        </Route>

        {/* 404 Route */}
        <Route path="*" element={
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-4">404</h1>
              <p className="text-xl text-gray-600 dark:text-gray-300 mb-6">
                Página não encontrada
              </p>
              <button
                onClick={() => window.history.back()}
                className="bg-[#19A999] text-white px-6 py-2 rounded-lg hover:bg-[#14887B] transition-colors"
              >
                Voltar
              </button>
            </div>
          </div>
        } />
      </Routes>
    </Suspense>
  );
}
