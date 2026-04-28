import { Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import CreateStore from '@/pages/CreateStore';

// Lazy load layouts
const PublicLayout = lazy(() => import('@/components/layouts/PublicLayout'));
const PrivateLayout = lazy(() => import('@/components/layouts/PrivateLayout'));

// Lazy load public routes
const Landing = lazy(() => import('@/pages/initial/home/Landing'));
const Login = lazy(() => import('@/pages/initial/auth/Login'));
const Signup = lazy(() => import('@/pages/initial/auth/SignUp'));
const Terms = lazy(() => import('@/pages/initial/legal/Terms'));
const PrivacyPolicy = lazy(() => import('@/pages/initial/legal/PrivacyPolicy'));

// Lazy load store routes
const Catalog = lazy(() => import('@/pages/store/Catalog'));
const Checkout = lazy(() => import('@/pages/store/Checkout'));
const StoreLayout = lazy(() => import('@/components/layouts/StoreLayout').then(m => ({ default: m.StoreLayout })));

// Lazy load private routes
const Dashboard = lazy(() => import('@/pages/private/admin/dashboard/Dashboard'));
const Activity = lazy(() => import('@/pages/private/admin/dashboard/Activity'));
const Alerts = lazy(() => import('@/pages/private/admin/dashboard/Alerts'));
const Reports = lazy(() => import('@/pages/private/admin/dashboard/Reports'));
const Settings = lazy(() => import('@/pages/private/admin/settings/storeSettings/StoreSettings'));
const Products = lazy(() => import('@/pages/private/admin/products/Products'));
const Users = lazy(() => import('@/pages/private/admin/users/Users'));
const Categories = lazy(() => import('@/pages/private/admin/products/Categories'));
const Legal = lazy(() => import('@/pages/private/admin/support/Legal'));
const FAQ = lazy(() => import('@/pages/private/admin/support/FAQ'));
const Appearance = lazy(() => import('@/pages/private/admin/settings/appearance/Appearance'));
const Orders = lazy(() => import('@/pages/private/admin/commercial/orders/Orders'));
const InventoryByLocationPage = lazy(() => import('@/pages/private/admin/products/inventory/InventoryByLocationPage'));
const TransfersPage = lazy(() => import('@/pages/private/admin/products/inventory/TransfersPage'));
const TransferDetailPage = lazy(() => import('@/pages/private/admin/products/inventory/TransferDetailPage'));
const ProductLifecyclePage = lazy(() => import('@/pages/private/admin/products/inventory/ProductLifecyclePage'));
const ProductLifecycleSelectorPage = lazy(() => import('@/pages/private/admin/products/inventory/ProductLifecycleSelectorPage'));
const StockMovements = lazy(() => import('@/pages/private/admin/products/inventory/StockMovements'));
const PurchasesLedger = lazy(() => import('@/pages/private/admin/products/inventory/PurchasesLedger'));
const PurchaseDocumentsPage = lazy(() => import('@/pages/private/admin/products/inventory/PurchaseDocumentsPage'));
const PurchaseInsightsPage = lazy(() => import('@/pages/private/admin/products/inventory/PurchaseInsightsPage'));
const Suppliers = lazy(() => import('@/pages/private/admin/products/Suppliers'));
const Hours = lazy(() => import('@/pages/private/admin/settings/hours/Hours'));
const MessageSettings = lazy(() => import('@/pages/private/admin/settings/messages/MessageSettings'));
const Security = lazy(() => import('@/pages/private/admin/settings/security/Security'));
const Customers = lazy(() => import('@/pages/private/admin/commercial/customers/Customers'));
const Documentation = lazy(() => import('@/pages/private/admin/support/Documentation'));
const LoyaltyConfig = lazy(() => import('@/pages/private/admin/commercial/loyalty/LoyaltyConfig'));
const AdminMessages = lazy(() => import('@/pages/private/admin/commercial/messages/Messages'));
const Marketing = lazy(() => import('@/pages/private/admin/marketing/Marketing'));
const Payments = lazy(() => import('@/pages/private/admin/payments/Payments'));
const Delivery = lazy(() => import('@/pages/private/admin/delivery/Delivery'));
const SupplierDetailPage = lazy(() => import('@/pages/private/admin/suppliers/SupplierDetailPage'));
const SupplierLifecyclePage = lazy(() => import('@/pages/private/admin/products/inventory/SupplierLifecyclePage'));

// Loading fallback component
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#21A896]"></div>
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
          <Route path="/terms" element={<Terms />} />
          <Route path="/politica-privacidade" element={<PrivacyPolicy />} />
        </Route>

        {/* Store Routes - Also public */}
        <Route element={<StoreLayout><Outlet /></StoreLayout>}>
          <Route path="/s/:storeSlug" element={<Catalog />} />
          <Route path="/checkout" element={<Checkout />} />
        </Route>

        {/* Protected Routes - All wrapped in PrivateLayout */}
        <Route element={<ProtectedRoute />}>
          <Route path="/onboarding/create-store" element={<CreateStore />} />
          <Route element={<PrivateLayout />}>
            <Route path="/admin" element={<Dashboard />} />
            <Route path="/admin/activity" element={<Activity />} />
            <Route path="/admin/alerts" element={<Alerts />} />
            <Route path="/admin/reports" element={<Reports />} />
            <Route path="/admin/settings" element={<Settings />} />
            <Route path="/admin/orders" element={<Orders />} />
            <Route path="/admin/customers" element={<Customers />} />
            <Route path="/admin/products" element={<Products />} />
            <Route path="/admin/categories" element={<Categories />} />
            <Route path="/admin/users" element={<Users />} />
            <Route path="/admin/legal" element={<Legal />} />
            <Route path="/admin/faq" element={<FAQ />} />
            <Route path="/admin/config" element={<Appearance />} />
            <Route path="/admin/inventory" element={<InventoryByLocationPage />} />
            <Route path="/admin/transfers" element={<TransfersPage />} />
            <Route path="/admin/transfers/:id" element={<TransferDetailPage />} />
            <Route path="/admin/products/lifecycle" element={<ProductLifecycleSelectorPage />} />
            <Route path="/admin/products/:id/lifecycle" element={<ProductLifecyclePage />} />
            <Route path="/admin/stock-movements" element={<StockMovements />} />
            <Route path="/admin/stock/entries" element={<Navigate to="/admin/stock-movements?type=entry" replace />} />
            <Route path="/admin/stock/exits" element={<Navigate to="/admin/stock-movements?type=exit" replace />} />
            <Route path="/admin/stock/clearance" element={<Navigate to="/admin/stock-movements?type=clearance" replace />} />
            <Route path="/admin/stock/purchase-documents" element={<PurchaseDocumentsPage />} />
            <Route path="/admin/stock/purchase-insights" element={<PurchaseInsightsPage />} />
            <Route path="/admin/cashbook/purchases" element={<PurchasesLedger />} />

            <Route path="/admin/suppliers" element={<Suppliers />} />
            <Route path="/admin/suppliers/:id" element={<SupplierDetailPage />} />
            <Route path="/admin/suppliers/:supplierId/lifecycle" element={<SupplierLifecyclePage />} />
            <Route path="/admin/hours" element={<Hours />} />
            <Route path="/admin/messages" element={<MessageSettings />} />
            <Route path="/admin/loyalty" element={<LoyaltyConfig />} />
            <Route path="/admin/messages-admin" element={<AdminMessages />} />
            <Route path="/admin/marketing" element={<Marketing />} />
            <Route path="/admin/payments" element={<Payments />} />
            <Route path="/admin/delivery" element={<Delivery />} />
            <Route path="/admin/security" element={<Security />} />
            <Route path="/admin/docs" element={<Documentation />} />
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
                className="bg-[#21A896] text-white px-6 py-2 rounded-lg hover:bg-[#1A867A] transition-colors"
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