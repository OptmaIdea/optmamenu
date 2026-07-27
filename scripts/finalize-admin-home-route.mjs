import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const routesPath = path.join(root, 'src', 'AppRoutes.tsx');
const layoutPath = path.join(root, 'src', 'components', 'layouts', 'PrivateLayout.tsx');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function normalizeEol(content) {
  return content.replace(/\r\n/g, '\n');
}

function restoreEol(content, original) {
  return original.includes('\r\n') ? content.replace(/\n/g, '\r\n') : content;
}

function replaceRequired(content, pattern, replacement, label) {
  if (typeof pattern === 'string') {
    if (!content.includes(pattern)) {
      throw new Error(`Não foi possível localizar o trecho esperado: ${label}`);
    }
    return content.replace(pattern, replacement);
  }

  if (!pattern.test(content)) {
    throw new Error(`Não foi possível localizar o trecho esperado: ${label}`);
  }

  return content.replace(pattern, replacement);
}

const originalRoutes = read(routesPath);
let routes = normalizeEol(originalRoutes);

if (!routes.includes("const AdminHome = lazy(() => import('@/pages/private/admin/home/AdminHome'));")) {
  routes = replaceRequired(
    routes,
    /import \{ hasEffectivePermission, hasOnlyPdvOperationalAccess \} from '@\/utils\/permissions';\nimport \{ useState, useEffect \} from 'react';/,
    "import { hasOnlyPdvOperationalAccess } from '@/utils/permissions';",
    'imports do AdminLanding'
  );

  routes = replaceRequired(
    routes,
    /function AdminLanding\(\) \{[\s\S]*?\n\}\n\n\/\/ Layouts/,
    `function AdminLanding() {
  const activeStoreId = getActiveStoreId();
  const { securityContext, loading: securityLoading } = useSecurityContext();
  const { permissions, loading: permissionsLoading } = usePermissions(activeStoreId);

  const activeMembership = securityContext?.memberships?.find(
    (membership) => membership.store_id === activeStoreId && membership.status === 'active'
  ) || securityContext?.primary_membership || null;

  const isOwner = activeMembership?.role === 'owner';
  const onlyPdvAccess = !isOwner && hasOnlyPdvOperationalAccess(permissions);

  if (securityLoading || permissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#19A999]"></div>
      </div>
    );
  }

  if (onlyPdvAccess) {
    return <Navigate to="/admin/pdv" replace />;
  }

  return <AdminHome />;
}

// Layouts`,
    'componente AdminLanding'
  );

  routes = replaceRequired(
    routes,
    "// Dashboard Section\nconst Dashboard = lazy(() => import('@/pages/private/admin/dashboard/Dashboard'));",
    "// Admin home and Dashboard Section\nconst AdminHome = lazy(() => import('@/pages/private/admin/home/AdminHome'));\nconst Dashboard = lazy(() => import('@/pages/private/admin/dashboard/Dashboard'));",
    'lazy load da home'
  );
}

if (!routes.includes('path="/admin/dashboard"')) {
  routes = replaceRequired(
    routes,
    '            <Route path="/admin" element={<AdminLanding />} />\n            <Route path="/admin/activity"',
    '            <Route path="/admin" element={<AdminLanding />} />\n            <Route path="/admin/dashboard" element={<RequirePermission permission="dashboard.view"><Dashboard /></RequirePermission>} />\n            <Route path="/admin/activity"',
    'rota do dashboard operacional'
  );
}

const originalLayout = read(layoutPath);
let layout = normalizeEol(originalLayout);

if (!/\bHome,\n\} from 'lucide-react';/.test(layout)) {
  layout = replaceRequired(
    layout,
    /    TriangleAlert,\n\} from 'lucide-react';/,
    "    TriangleAlert,\n    Home,\n} from 'lucide-react';",
    'ícone Home'
  );
}

if (!layout.includes("{ path: '/admin', icon: Home, label: 'Início', alwaysVisible: true }")) {
  layout = replaceRequired(
    layout,
    /        dashboard: \[\n            \{ path: '\/admin\/alerts',[\s\S]*?\n        \],/,
    `        dashboard: [
            { path: '/admin', icon: Home, label: 'Início', alwaysVisible: true },
            { path: '/admin/alerts', icon: AlertCircle, label: 'Alertas', permission: 'dashboard.alerts.view' },
            { path: '/admin/activity', icon: BarChart2, label: 'Atividades recentes', permission: 'dashboard.activity.view' },
            { path: '/admin/dashboard', icon: LayoutDashboard, label: 'Painel operacional', permission: 'dashboard.view' },
            { path: '/admin/reports', icon: FileStack, label: 'Relatórios', permission: 'reports.view' },
        ],`,
    'itens da seção dashboard'
  );
}

const requiredRouteMarkers = [
  "const AdminHome = lazy(() => import('@/pages/private/admin/home/AdminHome'));",
  'path="/admin/dashboard"',
  'return <AdminHome />;',
];

for (const marker of requiredRouteMarkers) {
  if (!routes.includes(marker)) {
    throw new Error(`Validação final falhou em AppRoutes.tsx: ${marker}`);
  }
}

const requiredLayoutMarkers = [
  "{ path: '/admin', icon: Home, label: 'Início', alwaysVisible: true }",
  "{ path: '/admin/dashboard', icon: LayoutDashboard, label: 'Painel operacional', permission: 'dashboard.view' }",
];

for (const marker of requiredLayoutMarkers) {
  if (!layout.includes(marker)) {
    throw new Error(`Validação final falhou em PrivateLayout.tsx: ${marker}`);
  }
}

fs.writeFileSync(routesPath, restoreEol(routes, originalRoutes), 'utf8');
fs.writeFileSync(layoutPath, restoreEol(layout, originalLayout), 'utf8');

console.log('Home administrativa integrada: /admin agora é Início e /admin/dashboard é o Painel operacional.');
