import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Boxes,
  LayoutDashboard,
  MonitorSmartphone,
  Package,
  ReceiptText,
  Settings,
  ShoppingBag,
  Store,
  Users,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useSecurityContext } from '@/hooks/useSecurityContext';
import { usePermissions } from '@/hooks/usePermissions';
import { getActiveStoreId } from '@/utils/activeStore';
import { hasEffectivePermission } from '@/utils/permissions';

type QuickAccess = {
  label: string;
  description: string;
  path: string;
  permission?: string;
  icon: typeof LayoutDashboard;
};

const QUICK_ACCESS: QuickAccess[] = [
  { label: 'Abrir PDV', description: 'Inicie uma venda presencial.', path: '/admin/pdv', permission: 'pdv.view', icon: MonitorSmartphone },
  { label: 'Pedidos', description: 'Acompanhe pedidos e vendas.', path: '/admin/orders', permission: 'orders.view', icon: ShoppingBag },
  { label: 'Produtos', description: 'Consulte e gerencie o catálogo.', path: '/admin/products', permission: 'products.manage', icon: Package },
  { label: 'Estoque', description: 'Veja saldos e locais de estoque.', path: '/admin/inventory', permission: 'stock.view', icon: Boxes },
  { label: 'Clientes', description: 'Acesse a carteira de clientes.', path: '/admin/customers', permission: 'customers.view', icon: Users },
  { label: 'Livro Diário', description: 'Acompanhe o caixa operacional.', path: '/admin/cashbook', permission: 'cashbook.view', icon: BookOpen },
  { label: 'Painel operacional', description: 'Abra indicadores e alertas da operação.', path: '/admin/dashboard', permission: 'dashboard.view', icon: LayoutDashboard },
  { label: 'Dashboard comercial', description: 'Analise vendas, canais e clientes.', path: '/admin/commercial-dashboard', permission: 'commercial.dashboard.view', icon: BarChart3 },
  { label: 'Relatórios', description: 'Consulte relatórios disponíveis.', path: '/admin/reports', permission: 'reports.view', icon: ReceiptText },
  { label: 'Configurações', description: 'Ajuste a operação da loja.', path: '/admin/settings', permission: 'settings.view', icon: Settings },
];

const ROLE_LABELS: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  manager: 'Gerente',
  stock_operator: 'Operador de estoque',
  cashier: 'Caixa',
  sales: 'Vendas',
  staff: 'Equipe',
  viewer: 'Visualizador',
};

export default function AdminHome() {
  const activeStoreId = getActiveStoreId();
  const { profile, user } = useAuthStore();
  const { securityContext, loading: securityLoading, error } = useSecurityContext();
  const { permissions, loading: permissionsLoading } = usePermissions(activeStoreId);

  const activeMembership = securityContext?.memberships?.find(
    (membership) => membership.store_id === activeStoreId && membership.status === 'active'
  ) ?? securityContext?.primary_membership ?? null;

  const isOwner = activeMembership?.role === 'owner';
  const canAccess = (permission?: string) =>
    !permission || isOwner || hasEffectivePermission(permissions, permission);

  const visibleQuickAccess = QUICK_ACCESS.filter((item) => canAccess(item.permission));
  const displayName = profile?.full_name?.trim() || user?.email?.split('@')[0] || 'usuário';
  const storeName = activeMembership?.store_name || 'Unidade atual';
  const roleLabel = ROLE_LABELS[activeMembership?.role ?? ''] || activeMembership?.role || 'Membro';

  if (securityLoading || permissionsLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-11 w-11 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-7 pb-10">
      <section className="overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 p-6 shadow-sm dark:border-emerald-900/40 dark:from-emerald-950/40 dark:via-slate-900 dark:to-cyan-950/30 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-emerald-700 dark:border-emerald-800 dark:bg-slate-900/70 dark:text-emerald-300">
              <Store size={14} />
              Início do OptmaMenu
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white md:text-4xl">
                Olá, {displayName}
              </h1>
              <p className="mt-2 max-w-2xl text-sm font-medium text-slate-600 dark:text-slate-300 md:text-base">
                Este é o ponto de partida da sua operação. Escolha uma ação para continuar sem carregar automaticamente os painéis gerenciais.
              </p>
            </div>
          </div>

          <div className="min-w-[260px] rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/75">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Unidade em uso</p>
            <p className="mt-2 text-lg font-black text-slate-900 dark:text-white">{storeName}</p>
            <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">{roleLabel}</p>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          Não foi possível carregar todo o contexto da unidade. Algumas opções podem ficar temporariamente indisponíveis.
        </div>
      ) : null}

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">Acessos rápidos</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Os atalhos abaixo respeitam as permissões do seu perfil nesta unidade.
          </p>
        </div>

        {visibleQuickAccess.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleQuickAccess.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="group flex min-h-[150px] flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-emerald-700"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                      <Icon size={22} />
                    </div>
                    <ArrowRight className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-emerald-600" size={20} />
                  </div>
                  <div className="mt-6">
                    <h3 className="font-black text-slate-900 dark:text-white">{item.label}</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{item.description}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            Seu perfil não possui atalhos operacionais nesta unidade. Use “Meus Dados” ou fale com o administrador responsável pelas permissões.
          </div>
        )}
      </section>
    </div>
  );
}
