import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const routesPath = path.join(root, 'src', 'AppRoutes.tsx');
const layoutPath = path.join(root, 'src', 'components', 'layouts', 'PrivateLayout.tsx');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(file, content) {
  fs.writeFileSync(file, content, 'utf8');
}

function replaceOnce(content, from, to, label) {
  if (content.includes(to)) return content;
  if (!content.includes(from)) {
    throw new Error(`Não foi possível localizar o trecho esperado: ${label}`);
  }
  return content.replace(from, to);
}

let routes = read(routesPath);

routes = replaceOnce(
  routes,
  "import { hasEffectivePermission, hasOnlyPdvOperationalAccess } from '@/utils/permissions';\nimport { useState, useEffect } from 'react';",
  "import { hasOnlyPdvOperationalAccess } from '@/utils/permissions';",
  'imports do AdminLanding'
);

const oldAdminLanding = `function AdminLanding() {
  const activeStoreId = getActiveStoreId();
  const { securityContext, loading: securityLoading } = useSecurityContext();
  const { permissions, loading: permissionsLoading } = usePermissions(activeStoreId);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);

  const activeMembership = securityContext?.memberships?.find(
    (m) => m.store_id === activeStoreId && m.status === 'active'
  ) || securityContext?.primary_membership || null;

  const isOwner = activeMembership?.role === 'owner';
  const hasDashboardView = isOwner || hasEffectivePermission(permissions, 'dashboard.view');
  const onlyPdvAccess = !isOwner && hasOnlyPdvOperationalAccess(permissions);

  useEffect(() => {
    if (securityLoading || permissionsLoading || !activeStoreId) return;

    if (hasDashboardView) {
      setRedirectPath('/admin');
    } else if (onlyPdvAccess) {
      setRedirectPath('/admin/pdv');
    } else {
      setRedirectPath('/admin/my-profile');
    }
  }, [securityLoading, permissionsLoading, activeStoreId, hasDashboardView, onlyPdvAccess]);

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
}`;

const newAdminLanding = `function AdminLanding() {
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
}`;

routes = replaceOnce(routes, oldAdminLanding, newAdminLanding, 'componente AdminLanding');

routes = replaceOnce(
  routes,
  "// Dashboard Section\nconst Dashboard = lazy(() => import('@/pages/private/admin/dashboard/Dashboard'));",
  "// Admin home and Dashboard Section\nconst AdminHome = lazy(() => import('@/pages/private/admin/home/AdminHome'));\nconst Dashboard = lazy(() => import('@/pages/private/admin/dashboard/Dashboard'));",
  'lazy load da home'
);

routes = replaceOnce(
  routes,
  "            <Route path=\"/admin\" element={<AdminLanding />} />\n            <Route path=\"/admin/activity\"",
  "            <Route path=\"/admin\" element={<AdminLanding />} />\n            <Route path=\"/admin/dashboard\" element={<RequirePermission permission=\"dashboard.view\"><Dashboard /></RequirePermission>} />\n            <Route path=\"/admin/activity\"",
  'rota do dashboard operacional'
);

write(routesPath, routes);

let layout = read(layoutPath);

layout = replaceOnce(
  layout,
  "    TriangleAlert,\n} from 'lucide-react';",
  "    TriangleAlert,\n    Home,\n} from 'lucide-react';",
  'ícone Home'
);

layout = replaceOnce(
  layout,
  "        dashboard: [\n            { path: '/admin/alerts', icon: AlertCircle, label: 'Alertas', permission: 'dashboard.alerts.view' },\n            { path: '/admin/activity', icon: BarChart2, label: 'Atividades recentes', permission: 'dashboard.activity.view' },\n            { path: '/admin', icon: LayoutDashboard, label: 'Painel operacional', permission: 'dashboard.view' },\n            { path: '/admin/reports', icon: FileStack, label: 'Relatórios', permission: 'reports.view' },\n        ],",
  "        dashboard: [\n            { path: '/admin', icon: Home, label: 'Início', alwaysVisible: true },\n            { path: '/admin/alerts', icon: AlertCircle, label: 'Alertas', permission: 'dashboard.alerts.view' },\n            { path: '/admin/activity', icon: BarChart2, label: 'Atividades recentes', permission: 'dashboard.activity.view' },\n            { path: '/admin/dashboard', icon: LayoutDashboard, label: 'Painel operacional', permission: 'dashboard.view' },\n            { path: '/admin/reports', icon: FileStack, label: 'Relatórios', permission: 'reports.view' },\n        ],",
  'itens da seção dashboard'
);

write(layoutPath, layout);

console.log('Home administrativa integrada: /admin agora é Início e /admin/dashboard é o Painel operacional.');
