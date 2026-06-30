import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSecurityContext } from '@/hooks/useSecurityContext';
import { getActiveStoreId } from '@/utils/activeStore';
import PageContainer from '@/components/common/PageContainer';
import { ShieldAlert, AlertTriangle } from 'lucide-react';

type RequireActiveStoreMemberProps = {
  children: React.ReactNode;
};

export function RequireActiveStoreMember({ children }: RequireActiveStoreMemberProps) {
  const activeStoreId = getActiveStoreId();
  const { securityContext, loading } = useSecurityContext();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);

  const activeMembership = securityContext?.memberships?.find(
    (m) => m.store_id === activeStoreId && m.status === 'active'
  ) || null;

  const hasAccess = Boolean(activeStoreId && activeMembership);

  useEffect(() => {
    if (!loading && !hasAccess) {
      const timer = setTimeout(() => {
        navigate('/login');
      }, 5000);

      const interval = setInterval(() => {
        setCountdown((prev) => Math.max(0, prev - 1));
      }, 1000);

      return () => {
        clearTimeout(timer);
        clearInterval(interval);
      };
    }
  }, [loading, hasAccess, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#19A999]"></div>
      </div>
    );
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  return (
    <PageContainer
      title="Vínculo necessário"
      subtitle="Acesso restrito a colaboradores da loja"
      category="SEGURANÇA"
      icon={<ShieldAlert size={28} className="text-[#DC2626]" />}
      flat
    >
      <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm text-center font-candara">
        <AlertTriangle size={64} className="text-[#FAA832] mb-4 animate-pulse" />
        <h3 className="text-xl font-bold text-gray-900 dark:text-white font-candara-bold">
          Acesso restrito
        </h3>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 max-w-md">
          Esta área é restrita a membros com vínculo ativo nesta loja. Se você foi desativado ou desligado, não poderá acessar estas configurações.
        </p>
        <p className="mt-4 text-xs font-bold text-[#19A999]">
          Redirecionando para login em {countdown} segundo{countdown !== 1 ? 's' : ''}...
        </p>
        <div className="mt-8 flex gap-3">
          <button
            onClick={() => navigate('/login')}
            className="bg-[#19A999] hover:bg-[#14887B] text-white text-sm font-bold px-6 py-2.5 rounded-xl transition cursor-pointer"
          >
            Ir para Login
          </button>
        </div>
      </div>
    </PageContainer>
  );
}
