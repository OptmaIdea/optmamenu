import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSecurityContext } from '@/hooks/useSecurityContext';
import { usePermissions } from '@/hooks/usePermissions';
import { hasEffectivePermission, hasAnyEffectivePermission } from '@/utils/permissions';
import { getActiveStoreId } from '@/utils/activeStore';
import PageContainer from '@/components/common/PageContainer';
import { ShieldAlert, AlertTriangle } from 'lucide-react';

type RequirePermissionProps = {
  permission?: string | string[];
  permissions?: string | string[];
  children: React.ReactNode;
};

export function RequirePermission({ permission, permissions: permissionsProp, children }: RequirePermissionProps) {
  const activeStoreId = getActiveStoreId();
  const { securityContext, loading: securityLoading } = useSecurityContext();
  // [CORREÇÃO 3] Usa apenas `loading` (carga inicial), não `refreshing`.
  // Assim refreshes silenciosos em background não desmontam a página com spinner.
  const { permissions, loading: permissionsLoading } = usePermissions(activeStoreId);
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);
  const fallbackPath = '/admin/my-profile';

  const activeMembership = securityContext?.memberships?.find(
    (m) => m.store_id === activeStoreId && m.status === 'active'
  ) || securityContext?.primary_membership || null;

  const isOwner = activeMembership?.role === 'owner';
  const targetPermission = permissionsProp ?? permission ?? '';
  const hasAccess = Boolean(
    activeStoreId &&
    activeMembership &&
    (targetPermission === 'users.view'
      ? hasEffectivePermission(permissions, 'users.view')
      : (isOwner ||
        (Array.isArray(targetPermission)
          ? hasAnyEffectivePermission(permissions, targetPermission)
          : hasEffectivePermission(permissions, targetPermission))))
  );

  useEffect(() => {
    if (!securityLoading && !permissionsLoading && !hasAccess) {
      const timer = setTimeout(() => {
        navigate(fallbackPath, { replace: true });
      }, 5000);

      const interval = setInterval(() => {
        setCountdown((prev) => Math.max(0, prev - 1));
      }, 1000);

      return () => {
        clearTimeout(timer);
        clearInterval(interval);
      };
    }
  }, [securityLoading, permissionsLoading, hasAccess, navigate]);

  // Spinner apenas na carga inicial (loading=true, sem dados anteriores).
  // Quando é apenas um refresh silencioso (refreshing=true), loading permanece
  // false e o conteúdo atual fica visível — sem piscada.
  if (securityLoading || permissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#21A896]"></div>
      </div>
    );
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  // Exibe aviso amigável de restrição de permissão dentro do frame
  return (
    <PageContainer
      title="Acesso restrito"
      subtitle="Verificação de privilégios de segurança"
      category="CONFIGURAÇÕES"
      icon={<ShieldAlert size={28} className="text-[#DC2626]" />}
      flat
    >
      <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm text-center font-candara">
        <AlertTriangle size={64} className="text-[#FBA93C] mb-4 animate-pulse" />
        <h3 className="text-xl font-bold text-gray-900 dark:text-white font-candara-bold">
          Você não tem permissão para acessar essa página
        </h3>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 max-w-md">
          {!activeStoreId || !activeMembership ? (
            "Não foi possível identificar seu vínculo ativo com a loja. Você está sendo redirecionado por segurança."
          ) : (
            <>
              Esta área é restrita a colaboradores com a permissão <strong>{Array.isArray(targetPermission) ? targetPermission.join(' ou ') : targetPermission}</strong>. Se você precisar de acesso, solicite ao proprietário do estabelecimento.
            </>
          )}
        </p>
        <p className="mt-4 text-xs font-bold text-[#21A896]">
          Redirecionando para Meus Dados em {countdown} segundo{countdown !== 1 ? 's' : ''}...
        </p>
        <div className="mt-8 flex gap-3">
          <button
            onClick={() => navigate(-1)}
            className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-bold px-6 py-2.5 rounded-xl transition cursor-pointer"
          >
            Voltar
          </button>
          <button
            onClick={() => navigate('/admin/my-profile')}
            className="bg-[#21A896] hover:bg-[#1A867A] text-white text-sm font-bold px-6 py-2.5 rounded-xl transition cursor-pointer"
          >
            Ir para Meus Dados
          </button>
        </div>
      </div>
    </PageContainer>
  );
}
