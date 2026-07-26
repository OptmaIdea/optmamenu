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
  "import { hasEffectivePermission, hasOnlyPdvOperationalAccess } from '@/utils/permissions';\nimport { useState, useEffect } from 'react';\n\nfunction AdminLanding() {",
  "import { hasOnlyPdvOperationalAccess } from '@/utils/permissions';\nimport { useEffect } from 'react';\n\nfunction AdminLanding() {",
  'imports do AdminLanding'
);

routes = replaceOnce(
  routes,
  "  const { permissions, loading: permissionsLoading } = usePermissions(activeStoreId);\n  const [redirectPath, setRedirectPath] = useState<string | null>(null);",
  "  const { permissions, loading: permissionsLoading } = usePermissions(activeStoreId);",
  'estado de redirecionamento'
);

routes = replaceOnce(
  routes,
  "  const isOwner = activeMembership?.role === 'owner';\n  const hasDashboardView = isOwner || hasEffectivePermission(permissions, 'dashboard.view');\n  const onlyPdvAccess = !isOwner && hasOnlyPdvOperationalAccess(permissions);",
  "  const isOwner = activeMembership?.role === 'owner';\n  const onlyPdvAccess = !isOwner && hasOnlyPdvOperationalAccess(permissions);",
  'cálculo de acesso do dashboard'
);

routes = replaceOnce(
  routes,
  "  useEffect(() => {\n    if (securityLoading || permissionsLoading || !activeStoreId) return;\n\n    if (hasDashboardView) {\n      setRedirectPath('/admin');\n    } else if (onlyPdvAccess) {\n      setRedirectPath('/admin/pdv');\n    } else {\n      setRedirectPath('/admin/my-profile');\n    }\n  }, [securityLoading, permissionsLoading, activeStoreId, hasDashboardView, onlyPdvAccess]);",
  "  useEffect(() => {\n    if (securityLoading || permissionsLoading || !activeStoreId) return;\n\n    if (onlyPdvAccess) {\n      window.location.replace('/admin/pdv');\n    }\n  }, [securityLoading, permissionsLoading, activeStoreId, onlyPdvAccess]);",
  'efeito de landing'
);

routes = replaceOnce(
  routes,
  "  if (hasDashboardView) {\n    return <Dashboard />;\n  }\n\n  if (redirectPath) {\n    return <Navigate to={redirectPath} replace />;\n  }",
  "  if (onlyPdvAccess) {\n    return (\n      <div className=\"min-h-screen flex items-center justify-center bg-gray-50\">\n        <div className=\"animate-spin rounded-full h-12 w-12 border-b-2 border-[#19A999]\"></div>\n      </div>\n    );\n  }\n\n  return <AdminHome />;",
  'renderização do landing'
);

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
