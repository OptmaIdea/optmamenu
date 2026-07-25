const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function write(relativePath, content) {
  fs.writeFileSync(path.join(root, relativePath), content, 'utf8');
}

function replaceOnce(content, from, to, label) {
  if (!content.includes(from)) {
    throw new Error(`[branch-repair] Trecho não encontrado: ${label}`);
  }
  return content.replace(from, to);
}

const directSalesPath = 'src/pages/private/admin/commercial/directSales/DirectSalesPage.tsx';
let directSales = read(directSalesPath);
if (!directSales.includes("import { createClientUuid } from '@/utils/clientUuid';")) {
  directSales = replaceOnce(
    directSales,
    "import QuickPosModal from './components/QuickPosModal';",
    "import QuickPosModal from './components/QuickPosModal';\nimport { createClientUuid } from '@/utils/clientUuid';",
    'import createClientUuid'
  );
}
directSales = directSales.replaceAll('crypto.randomUUID()', 'createClientUuid()');
if (directSales.includes('crypto.randomUUID()')) {
  throw new Error('[branch-repair] crypto.randomUUID ainda presente em DirectSalesPage.tsx');
}
write(directSalesPath, directSales);

const routesPath = 'src/AppRoutes.tsx';
let routes = read(routesPath);
if (!routes.includes("const SalesPage = lazy(() => import('@/pages/private/admin/commercial/sales/SalesPage'));")) {
  routes = replaceOnce(
    routes,
    "const DirectSalesPage = lazy(() => import('@/pages/private/admin/commercial/directSales/DirectSalesPage'));",
    "const DirectSalesPage = lazy(() => import('@/pages/private/admin/commercial/directSales/DirectSalesPage'));\nconst SalesPage = lazy(() => import('@/pages/private/admin/commercial/sales/SalesPage'));",
    'import SalesPage'
  );
}
if (!routes.includes("const StockReservationsPage = lazy(() => import('@/pages/private/admin/products/inventory/StockReservationsPage'));")) {
  routes = replaceOnce(
    routes,
    "const StockDiscrepanciesPage = lazy(() => import('@/pages/private/admin/products/inventory/StockDiscrepanciesPage'));",
    "const StockDiscrepanciesPage = lazy(() => import('@/pages/private/admin/products/inventory/StockDiscrepanciesPage'));\nconst StockReservationsPage = lazy(() => import('@/pages/private/admin/products/inventory/StockReservationsPage'));",
    'import StockReservationsPage'
  );
}
if (!routes.includes('path="/admin/sales"')) {
  routes = replaceOnce(
    routes,
    `            <Route\n              path="/admin/direct-sales"`,
    `            <Route\n              path="/admin/sales"\n              element={\n                <RequirePermission permission="orders.view">\n                  <SalesPage />\n                </RequirePermission>\n              }\n            />\n            <Route\n              path="/admin/direct-sales"`,
    'rota /admin/sales'
  );
}
if (!routes.includes('path="/admin/stock/reservations"')) {
  routes = replaceOnce(
    routes,
    '<Route path="/admin/stock/divergences" element={<RequirePermission permission="stock.view"><StockDiscrepanciesPage /></RequirePermission>} />',
    '<Route path="/admin/stock/divergences" element={<RequirePermission permission="stock.view"><StockDiscrepanciesPage /></RequirePermission>} />\n            <Route path="/admin/stock/reservations" element={<RequirePermission permission="stock.view"><StockReservationsPage /></RequirePermission>} />',
    'rota /admin/stock/reservations'
  );
}
write(routesPath, routes);

const layoutPath = 'src/components/layouts/PrivateLayout.tsx';
let layout = read(layoutPath);
if (!layout.includes("{ path: '/admin/sales', icon: BadgeDollarSign, label: 'Vendas', permission: 'orders.view' }")) {
  layout = replaceOnce(
    layout,
    "            { path: '/admin/direct-sales', icon: BadgeDollarSign, label: 'Venda direta', permission: 'orders.manage' },",
    "            { path: '/admin/sales', icon: BadgeDollarSign, label: 'Vendas', permission: 'orders.view' },\n            { path: '/admin/direct-sales', icon: BadgeDollarSign, label: 'Venda direta', permission: 'orders.manage' },",
    'menu Vendas'
  );
}
if (!layout.includes("{ path: '/admin/stock/reservations', icon: Clock, label: 'Reservas', permission: 'stock.view' }")) {
  layout = replaceOnce(
    layout,
    "            { path: '/admin/stock/divergences', icon: TriangleAlert, label: 'Divergências', permission: 'stock.view' },",
    "            { path: '/admin/stock/divergences', icon: TriangleAlert, label: 'Divergências', permission: 'stock.view' },\n            { path: '/admin/stock/reservations', icon: Clock, label: 'Reservas', permission: 'stock.view' },",
    'menu Reservas'
  );
}
write(layoutPath, layout);

const salesPagePath = 'src/pages/private/admin/commercial/sales/SalesPage.tsx';
let salesPage = read(salesPagePath);
salesPage = salesPage.replace('<PageContainer>', '<PageContainer title="Vendas">');
write(salesPagePath, salesPage);

const reservationsPagePath = 'src/pages/private/admin/products/inventory/StockReservationsPage.tsx';
let reservationsPage = read(reservationsPagePath);
reservationsPage = reservationsPage.replace(
  '<PageContainer>',
  '<PageContainer title="Reservas de estoque">'
);
write(reservationsPagePath, reservationsPage);

console.log('[branch-repair] UUID, rotas, menus e títulos corrigidos na branch atual.');
