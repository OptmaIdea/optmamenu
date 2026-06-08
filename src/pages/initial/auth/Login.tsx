import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Mail, Lock, ArrowRight, AlertCircle, Store, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { clearActiveStoreId, setActiveStoreId } from '@/utils/activeStore';
import type { LoginStoreOption } from '@/types/security';
import { markSessionAsActive } from '@/utils/sessionSecurity';

function formatLoginRole(role: string | null | undefined): string {
  const labels: Record<string, string> = {
    owner: 'Proprietário',
    admin: 'Administrador',
    manager: 'Gerente',
    stock_operator: 'Operador de estoque',
    cashier: 'Caixa',
    sales: 'Vendas',
    staff: 'Equipe',
    viewer: 'Visualizador',
  };

  return role ? labels[role] ?? role : 'Não definido';
}

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [selectingStore, setSelectingStore] = useState(false);
  const [storeOptions, setStoreOptions] = useState<LoginStoreOption[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');

  const [error, setError] = useState('');

  const finishLoginWithStore = async (
    storeId: string,
    options = storeOptions
  ) => {
    const selectedStore = options.find((option) => option.store_id === storeId);

    if (selectedStore) {
      const isSuspended =
        selectedStore.status === 'suspended' || selectedStore.access_blocked === true;

      const message =
        selectedStore.access_message ||
        `Seu acesso à loja ${selectedStore.store_name} está suspenso. Procure o responsável.`;

      if (isSuspended) {
        toast.warning(message);
        return;
      }
    }

    setActiveStoreId(storeId);

    sessionStorage.setItem('optmamenu.session.start', new Date().toISOString());
    markSessionAsActive();

    await logSessionEvent(storeId, 'session_store_selected', {
      source: 'login',
      store_name: selectedStore?.store_name ?? null,
      store_slug: selectedStore?.store_slug ?? null,
      role: selectedStore?.role ?? null,
      multiple_store_options: options.length,
    });

    navigate('/admin', { replace: true });
  };

  const fetchLoginStoreOptions = async (): Promise<LoginStoreOption[]> => {
    const { data, error: rpcError } = await supabase.rpc('get_login_store_options');

    if (rpcError) {
      throw rpcError;
    }

    return (data ?? []) as LoginStoreOption[];
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError('');
    setStoreOptions([]);
    setSelectedStoreId('');
    clearActiveStoreId();

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) throw loginError;

      const options = await fetchLoginStoreOptions();

      if (!options.length) {
        await supabase.auth.signOut();
        clearActiveStoreId();
        throw new Error('Você não possui acesso a nenhuma loja.');
      }

      const activeOptions = options.filter(
        (option) => option.status === 'active' && option.access_blocked !== true
      );

      setStoreOptions(options);
      setSelectedStoreId(activeOptions[0]?.store_id ?? '');

      const hasSuspendedOptions = options.some(
        (option) => option.status === 'suspended' || option.access_blocked === true
      );

      if (activeOptions.length === 1 && options.length === 1 && !hasSuspendedOptions) {
        await finishLoginWithStore(activeOptions[0].store_id, options);
        return;
      }

      setSelectingStore(true);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Erro ao fazer login';

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmStore = () => {
    if (!selectedStoreId) {
      setError('Selecione uma loja para continuar.');
      return;
    }

    void finishLoginWithStore(selectedStoreId);
  };

  const handleBackToCredentials = async () => {
    await supabase.auth.signOut();
    clearActiveStoreId();
    setSelectingStore(false);
    setStoreOptions([]);
    setSelectedStoreId('');
    setPassword('');
  };

  const logSessionEvent = async (
    storeId: string,
    action: string,
    details: Record<string, unknown> = {}
  ) => {
    const { error: rpcError } = await supabase.rpc('log_user_session_event', {
      p_store_id: storeId,
      p_action: action,
      p_details: details,
      p_outcome: 'success',
    });

    if (rpcError) {
      console.warn('Não foi possível registrar evento de sessão:', rpcError);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F6F2] dark:bg-gray-950 flex items-center justify-center p-4 pb-24">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-black text-[#2D2A26] dark:text-white font-candara-bold">
            {selectingStore ? 'Escolha onde entrar' : 'Acesse sua conta'}
          </h2>
          <p className="mt-2 text-sm text-[#6B6258] dark:text-gray-400 font-candara">
            {selectingStore
              ? 'Selecione a loja ou vínculo de trabalho desta sessão.'
              : 'Faça login para acessar seu painel'}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-[#6B6258]/10 dark:border-gray-800 p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
              <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-600 dark:text-red-400 font-candara">{error}</p>
            </div>
          )}

          {!selectingStore ? (
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-[#6B6258] dark:text-gray-300 mb-2 font-candara">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-[#F8F6F2] dark:bg-gray-800 border border-[#6B6258]/20 dark:border-gray-750 rounded-xl text-[#2D2A26] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-green font-candara"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#6B6258] dark:text-gray-300 mb-2 font-candara">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-10 pr-12 py-3 bg-[#F8F6F2] dark:bg-gray-800 border border-[#6B6258]/20 dark:border-gray-750 rounded-xl text-[#2D2A26] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-green font-candara"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? (
                      <EyeOff size={20} />
                    ) : (
                      <Eye size={20} />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-brand-green focus:ring-brand-green" />
                  <span className="text-sm text-[#6B6258] dark:text-gray-400 font-candara">Lembrar-me</span>
                </label>
                <Link
                  to="/forgot-password"
                  className="text-sm font-bold text-brand-green hover:text-brand-dark transition-colors font-candara"
                >
                  Esqueceu a senha?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-brand-green hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Entrar
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="space-y-5">
              {storeOptions.filter(o => o.status === 'active' && o.access_blocked !== true).length === 0 && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl flex items-start gap-3 text-amber-800 dark:text-amber-300">
                  <AlertCircle size={20} className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-sm font-bold font-candara">
                    Você não possui acesso ativo a nenhuma loja. Se alguma loja aparecer como suspensa, toque nela para ver o aviso ou procure o responsável.
                  </p>
                </div>
              )}
              <div className="space-y-3">
                {storeOptions.map((option) => {
                  const selected = selectedStoreId === option.store_id;
                  const isSuspended =
                    option.status === 'suspended' || option.access_blocked === true;
                  const message =
                    option.access_message ||
                    `Seu acesso à loja ${option.store_name} está suspenso. Procure o responsável.`;

                  return (
                    <button
                      key={option.store_id}
                      type="button"
                      aria-disabled={isSuspended}
                      onClick={() => {
                        if (isSuspended) {
                          toast.warning(message);
                          return;
                        }

                        setSelectedStoreId(option.store_id);
                      }}
                      className={`w-full rounded-2xl border p-4 text-left transition ${isSuspended
                        ? 'cursor-not-allowed opacity-60 border-orange-200 bg-orange-50 dark:border-orange-900/40 dark:bg-orange-950/20'
                        : selected
                          ? 'border-brand-green bg-brand-green/10 ring-2 ring-brand-green/20'
                          : 'border-[#6B6258]/10 bg-[#F8F6F2] hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900/40'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm dark:bg-gray-800">
                          {option.store_logo_url ? (
                            <img
                              src={option.store_logo_url}
                              alt={option.store_name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Store size={22} className="text-brand-green" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-black text-gray-800 dark:text-white">
                            {option.store_name}
                          </p>
                          <p className="text-sm font-bold text-brand-green flex items-center flex-wrap gap-2">
                            <span>{formatLoginRole(option.role)}</span>
                            {isSuspended && (
                              <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700 dark:bg-orange-900/50 dark:text-orange-200">
                                Suspenso
                              </span>
                            )}
                          </p>
                          {option.store_slug && (
                            <p className="text-xs text-gray-400">/{option.store_slug}</p>
                          )}
                          {isSuspended && (
                            <p className="mt-2 text-xs text-orange-700 dark:text-orange-300">
                              {message}
                            </p>
                          )}
                        </div>

                        {selected && (
                          <CheckCircle size={22} className="text-brand-green" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleConfirmStore}
                disabled={!selectedStoreId}
                className="w-full py-3 px-4 bg-brand-green hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                Continuar
                <ArrowRight size={18} />
              </button>

              <button
                type="button"
                onClick={handleBackToCredentials}
                className="w-full py-2 px-4 text-sm font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Trocar usuário
              </button>
            </div>
          )}

          {!selectingStore && (
            <div className="mt-6 text-center">
              <p className="text-sm text-[#6B6258] dark:text-gray-400 font-candara">
                Ainda não tem uma conta?{' '}
                <Link
                  to="/signup"
                  className="font-bold text-brand-green hover:text-brand-dark transition-colors"
                >
                  Cadastre-se
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
