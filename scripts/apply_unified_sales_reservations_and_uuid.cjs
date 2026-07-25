const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function write(file, content) {
  fs.writeFileSync(path.join(root, file), content, 'utf8');
}

function ensure(content, search, replacement, label) {
  if (content.includes(replacement)) return content;
  if (!content.includes(search)) throw new Error(`[unified-sales] Trecho não encontrado: ${label}`);
  return content.replace(search, replacement);
}

const directSalesPath = 'src/pages/private/admin/commercial/directSales/DirectSalesPage.tsx';
let directSales = read(directSalesPath);
if (!directSales.includes("import { createClientUuid } from '@/utils/clientUuid';")) {
  directSales = ensure(
    directSales,
    "import QuickPosModal from './components/QuickPosModal';",
    "import QuickPosModal from './components/QuickPosModal';\nimport { createClientUuid } from '@/utils/clientUuid';",
    'import UUID compatível'
  );
}
directSales = directSales.replaceAll('crypto.randomUUID()', 'createClientUuid()');
write(directSalesPath, directSales);

const routesPath = 'src/AppRoutes.tsx';
let routes = read(routesPath);
routes = ensure(
  routes,
  "const DirectSalesPage = lazy(() => import('@/pages/private/admin/commercial/directSales/DirectSalesPage'));",
  "const DirectSalesPage = lazy(() => import('@/pages/private/admin/commercial/directSales/DirectSalesPage'));\nconst SalesPage = lazy(() => import('@/pages/private/admin/commercial/sales/SalesPage'));",
  'lazy SalesPage'
);
routes = ensure(
  routes,
  "const StockDiscrepanciesPage = lazy(() => import('@/pages/private/admin/products/inventory/StockDiscrepanciesPage'));",
  "const StockDiscrepanciesPage = lazy(() => import('@/pages/private/admin/products/inventory/StockDiscrepanciesPage'));\nconst StockReservationsPage = lazy(() => import('@/pages/private/admin/products/inventory/StockReservationsPage'));",
  'lazy StockReservationsPage'
);
routes = ensure(
  routes,
  `            <Route\n              path="/admin/direct-sales"`,
  `            <Route\n              path="/admin/sales"\n              element={\n                <RequirePermission permission="orders.view">\n                  <SalesPage />\n                </RequirePermission>\n              }\n            />\n            <Route path="/admin/pdv/sales" element={<Navigate to="/admin/sales" replace />} />\n            <Route\n              path="/admin/direct-sales"`,
  'rota central de vendas'
);
routes = ensure(
  routes,
  "            <Route path=\"/admin/stock/divergences\" element={<RequirePermission permission=\"stock.view\"><StockDiscrepanciesPage /></RequirePermission>} />",
  "            <Route path=\"/admin/stock/divergences\" element={<RequirePermission permission=\"stock.view\"><StockDiscrepanciesPage /></RequirePermission>} />\n            <Route path=\"/admin/stock/reservations\" element={<RequirePermission permission=\"stock.view\"><StockReservationsPage /></RequirePermission>} />",
  'rota reservas'
);
write(routesPath, routes);

const layoutPath = 'src/components/layouts/PrivateLayout.tsx';
let layout = read(layoutPath);
layout = ensure(
  layout,
  "            { path: '/admin/direct-sales', icon: BadgeDollarSign, label: 'Venda direta', permission: 'orders.manage' },",
  "            { path: '/admin/sales', icon: ShoppingBag, label: 'Vendas', permission: 'orders.view' },\n            { path: '/admin/direct-sales', icon: BadgeDollarSign, label: 'Venda direta', permission: 'orders.manage' },",
  'menu Vendas'
);
layout = ensure(
  layout,
  "            { path: '/admin/stock/divergences', icon: TriangleAlert, label: 'Divergências', permission: 'stock.view' },",
  "            { path: '/admin/stock/divergences', icon: TriangleAlert, label: 'Divergências', permission: 'stock.view' },\n            { path: '/admin/stock/reservations', icon: Clock, label: 'Reservas', permission: 'stock.view' },",
  'menu Reservas'
);
write(layoutPath, layout);

console.log('[unified-sales] UUID, Central de Vendas, menu, rotas e Reservas aplicados.');
