import { useEffect, useState, useCallback, useMemo } from 'react';
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
  UserCheck,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useSecurityContext } from '@/hooks/useSecurityContext';
import { usePermissions } from '@/hooks/usePermissions';
import { getActiveStoreId } from '@/utils/activeStore';
import { hasEffectivePermission } from '@/utils/permissions';
import { getStoreMembers } from '@/services/securityService';
import type { StoreMemberAdmin } from '@/types/security';

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

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  suspended: 'Suspenso',
  invited: 'Convite enviado',
};

function getGreetingName(
  activeMembership?: { internal_alias?: string | null; profile_name?: string | null } | null,
  profile?: { internal_alias?: string | null; full_name?: string | null; name?: string | null } | null,
  userEmail?: string | null
): string {
  if (activeMembership?.internal_alias?.trim()) return activeMembership.internal_alias.trim();
  if (profile?.internal_alias?.trim()) return profile.internal_alias.trim();
  if (activeMembership?.profile_name?.trim()) return activeMembership.profile_name.trim();
  const fullName = profile?.full_name?.trim() || profile?.name?.trim();
  if (fullName) {
    const firstName = fullName.split(/\s+/)[0];
    if (firstName) return firstName;
    return fullName;
  }
  if (userEmail?.includes('@')) {
    const prefix = userEmail.split('@')[0]?.trim();
    if (prefix) return prefix;
  }
  return 'usuário';
}

function getPresenceInfo(lastSeenAt?: string | null) {
  if (!lastSeenAt) {
    return { status: 'offline', label: 'Sem registro', colorClass: 'bg-slate-400 dark:bg-slate-500' };
  }
  const date = new Date(lastSeenAt);
  if (isNaN(date.getTime())) {
    return { status: 'offline', label: 'Sem registro', colorClass: 'bg-slate-400 dark:bg-slate-500' };
  }
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin <= 5) {
    return { status: 'online', label: 'Online agora', colorClass: 'bg-emerald-500 animate-pulse' };
  } else if (diffMin <= 30) {
    return { status: 'recent', label: 'Ativo recentemente', colorClass: 'bg-amber-500' };
  } else if (diffMin < 120) {
    return { status: 'offline', label: `Visto há ${diffMin} min`, colorClass: 'bg-slate-400 dark:bg-slate-500' };
  } else {
    const hours = Math.floor(diffMin / 60);
    if (hours < 24) {
      return { status: 'offline', label: `Visto há ${hours}h`, colorClass: 'bg-slate-400 dark:bg-slate-500' };
    }
    const days = Math.floor(hours / 24);
    return { status: 'offline', label: `Visto há ${days}d`, colorClass: 'bg-slate-400 dark:bg-slate-500' };
  }
}

function getMemberInitials(name?: string | null): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function AdminHome() {
  const activeStoreId = getActiveStoreId();
  const { profile, user } = useAuthStore();
  const { securityContext, loading: securityLoading, error } = useSecurityContext();
  const { permissions, loading: permissionsLoading } = usePermissions(activeStoreId);

  const [teamMembers, setTeamMembers] = useState<StoreMemberAdmin[]>([]);

  const activeMembership = securityContext?.memberships?.find(
    (membership) => membership.store_id === activeStoreId && membership.status === 'active'
  ) ?? securityContext?.primary_membership ?? null;

  const isOwner = activeMembership?.role === 'owner';
  const canAccess = useCallback((permission?: string) =>
    !permission || isOwner || hasEffectivePermission(permissions, permission), [permissions, isOwner]);

  const canViewTeam = canAccess('users.view');

  const visibleQuickAccess = QUICK_ACCESS.filter((item) => canAccess(item.permission));
  const displayName = getGreetingName(activeMembership, profile, user?.email);
  const storeName = activeMembership?.store_name || 'Unidade atual';
  const roleLabel = ROLE_LABELS[activeMembership?.role ?? ''] || activeMembership?.role || 'Membro';

  const loadTeam = useCallback(async () => {
    if (!activeStoreId || !canViewTeam) return;
    try {
      const members = await getStoreMembers(activeStoreId);
      setTeamMembers(members);
    } catch (err) {
      console.warn('Não foi possível carregar a equipe da unidade:', err);
    }
  }, [activeStoreId, canViewTeam]);

  useEffect(() => {
    loadTeam();
    const timer = setInterval(() => {
      loadTeam();
    }, 60000);
    return () => clearInterval(timer);
  }, [loadTeam]);

  const sortedTeamMembers = useMemo(() => {
    return [...teamMembers].sort((a, b) => {
      const pA = getPresenceInfo(a.last_seen_at);
      const pB = getPresenceInfo(b.last_seen_at);

      const weight = (member: StoreMemberAdmin, p: ReturnType<typeof getPresenceInfo>) => {
        if (p.status === 'online') return 1;
        if (p.status === 'recent') return 2;
        if (member.status === 'active') return 3;
        if (member.status === 'invited') return 4;
        return 5;
      };

      const wA = weight(a, pA);
      const wB = weight(b, pB);
      if (wA !== wB) return wA - wB;

      const nameA = (a.internal_alias || a.profile_name || a.user_email || '').toLowerCase();
      const nameB = (b.internal_alias || b.profile_name || b.user_email || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [teamMembers]);

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
              <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white md:text-4xl font-candara-bold">
                Olá, {displayName}
              </h1>
              <p className="mt-2 max-w-2xl text-sm font-medium text-slate-600 dark:text-slate-300 md:text-base font-candara">
                Este é o ponto de partida da sua operação. Escolha uma ação para continuar sem carregar automaticamente os painéis gerenciais.
              </p>
            </div>
          </div>

          <div className="min-w-[260px] rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/75">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Unidade em uso</p>
            <p className="mt-2 text-lg font-black text-slate-900 dark:text-white font-candara-bold">{storeName}</p>
            <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300 font-candara">{roleLabel}</p>
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
          <h2 className="text-xl font-black text-slate-900 dark:text-white font-candara-bold">Acessos rápidos</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 font-candara">
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
                  className="group flex min-h-[140px] flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-emerald-700"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                      <Icon size={22} />
                    </div>
                    <ArrowRight className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-emerald-600" size={20} />
                  </div>
                  <div className="mt-4">
                    <h3 className="font-black text-slate-900 dark:text-white font-candara-bold">{item.label}</h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-candara">{item.description}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 font-candara">
            Seu perfil não possui atalhos operacionais nesta unidade. Use “Meus Dados” ou fale com o administrador responsável pelas permissões.
          </div>
        )}
      </section>

      {/* Seção Equipe desta unidade (somente para usuários com permissão users.view) */}
      {canViewTeam && (
        <section className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white font-candara-bold flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-[#19A999]" />
                Equipe desta unidade
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 font-candara">
                Colaboradores vinculados à unidade ativa e registro recente de atividade.
              </p>
            </div>
            <Link
              to="/admin/users"
              className="text-xs font-bold text-[#19A999] hover:underline inline-flex items-center gap-1 font-candara"
            >
              Gerenciar equipe
              <ArrowRight size={14} />
            </Link>
          </div>

          {sortedTeamMembers.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {sortedTeamMembers.map((member) => {
                const presence = getPresenceInfo(member.last_seen_at);
                const name = member.internal_alias || member.profile_name || 'Colaborador';
                const role = member.custom_role_name || ROLE_LABELS[member.role] || member.role;
                const statusText = STATUS_LABELS[member.status] || member.status;
                const avatar = member.member_avatar_url || member.profile_avatar_url || member.avatar_url;

                return (
                  <div
                    key={member.member_id}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="relative h-11 w-11 shrink-0 rounded-full bg-teal-100 dark:bg-teal-950 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                      {avatar ? (
                        <img
                          src={avatar}
                          alt={name}
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-black text-teal-800 dark:text-teal-200 font-candara">
                          {getMemberInitials(name)}
                        </span>
                      )}
                      <span
                        className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900 ${presence.colorClass}`}
                        title={presence.label}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-900 dark:text-white font-candara-bold">
                        {name}
                      </p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400 font-candara">
                        {role}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-[10px] font-semibold text-slate-400 dark:text-slate-500 font-candara">
                        <span className={presence.status === 'online' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}>
                          {presence.label}
                        </span>
                        {member.status !== 'active' && (
                          <span className="rounded bg-amber-50 px-1 py-0.5 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                            {statusText}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 font-candara">
              Nenhum colaborador encontrado para esta unidade.
            </div>
          )}
        </section>
      )}
    </div>
  );
}
