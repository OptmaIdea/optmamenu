import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { acceptStoreMemberInvite } from '@/services/myStoreInviteService';
import { setActiveStoreId } from '@/utils/activeStore';
import { markSessionAsActive } from '@/utils/sessionSecurity';

export default function ActivateInvite() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const storeId = searchParams.get('store_id') ?? '';
  const mode = searchParams.get('mode') ?? 'invite';
  const requiresPassword = mode === 'invite';

  const [checking, setChecking] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const passwordValid = useMemo(
    () => password.length >= 8 && password === confirmPassword,
    [password, confirmPassword],
  );

  useEffect(() => {
    let mounted = true;

    const resolveSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSessionReady(Boolean(data.session));
      setChecking(false);
    };

    void resolveSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session) {
        setSessionReady(true);
        setChecking(false);
      }
    });

    const fallback = window.setTimeout(() => {
      if (mounted) setChecking(false);
    }, 5000);

    return () => {
      mounted = false;
      window.clearTimeout(fallback);
      authListener.subscription.unsubscribe();
    };
  }, []);

  const finishActivation = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (!storeId) {
      setError('O convite não contém a identificação da loja. Solicite um novo convite.');
      return;
    }

    if (!sessionReady) {
      setError('O link expirou ou a sessão do convite não foi reconhecida. Solicite um novo convite.');
      return;
    }

    if (requiresPassword && !passwordValid) {
      setError('Crie uma senha com pelo menos 8 caracteres e confirme-a corretamente.');
      return;
    }

    setSubmitting(true);
    try {
      if (requiresPassword) {
        const { error: passwordError } = await supabase.auth.updateUser({ password });
        if (passwordError) throw passwordError;
      }

      await acceptStoreMemberInvite(storeId);
      setActiveStoreId(storeId);
      markSessionAsActive();
      sessionStorage.setItem('optmamenu.session.start', new Date().toISOString());
      navigate('/admin/my-profile', { replace: true });
    } catch (activationError) {
      setError(
        activationError instanceof Error
          ? activationError.message
          : 'Não foi possível concluir a ativação do convite.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
          <Loader2 className="h-5 w-5 animate-spin" />
          Validando seu convite...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-7 shadow-xl dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#19A999]/10 text-[#19A999]">
            {requiresPassword ? <KeyRound size={28} /> : <ShieldCheck size={28} />}
          </div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">
            {requiresPassword ? 'Ative sua conta' : 'Aceite o convite'}
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {requiresPassword
              ? 'Defina sua senha para concluir o acesso ao OptmaMenu.'
              : 'Confirme o vínculo com a nova loja para continuar.'}
          </p>
        </div>

        {!sessionReady && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
            Este link não possui mais uma sessão válida. Solicite ao responsável o reenvio do convite.
          </div>
        )}

        <form onSubmit={finishActivation} className="space-y-4">
          {requiresPassword && (
            <>
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Nova senha
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={8}
                    autoComplete="new-password"
                    required
                    className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 pr-11 text-gray-900 outline-none focus:ring-2 focus:ring-[#19A999] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Confirmar senha
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  minLength={8}
                  autoComplete="new-password"
                  required
                  className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-[#19A999] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
            </>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !sessionReady || (requiresPassword && !passwordValid)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#19A999] px-4 py-3 font-bold text-white transition hover:bg-[#14887B] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle size={19} />}
            {requiresPassword ? 'Criar senha e ativar acesso' : 'Aceitar convite e continuar'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-500 dark:text-gray-400">
          Já concluiu a ativação?{' '}
          <Link to="/login" className="font-bold text-[#19A999] hover:underline">
            Ir para o login
          </Link>
        </p>
      </div>
    </div>
  );
}
