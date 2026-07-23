import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';

function clearRecoveryParams() {
  const url = new URL(window.location.href);
  url.hash = '';
  url.searchParams.delete('token_hash');
  url.searchParams.delete('type');
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tokenHash = searchParams.get('token_hash');
  const tokenType = searchParams.get('type');

  const [checking, setChecking] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const passwordValid = useMemo(
    () => password.length >= 8 && password === confirmPassword,
    [password, confirmPassword],
  );

  useEffect(() => {
    let mounted = true;

    const resolveInitialState = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      if (data.session) {
        setSessionReady(true);
        setAwaitingConfirmation(false);
      } else if (tokenHash && (!tokenType || tokenType === 'recovery')) {
        setSessionReady(false);
        setAwaitingConfirmation(true);
      } else {
        setSessionReady(false);
        setAwaitingConfirmation(false);
      }

      setChecking(false);
    };

    void resolveInitialState();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY' || session) {
        setSessionReady(Boolean(session));
        setAwaitingConfirmation(false);
        setChecking(false);
        setError('');
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [tokenHash, tokenType]);

  const verifyRecoveryLink = async () => {
    if (!tokenHash) {
      setError('Este link não contém um token de recuperação válido.');
      return;
    }

    setVerifying(true);
    setError('');

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'recovery',
      });

      if (verifyError) throw verifyError;
      if (!data.session) {
        throw new Error('Não foi possível criar a sessão de recuperação.');
      }

      setSessionReady(true);
      setAwaitingConfirmation(false);
      clearRecoveryParams();
    } catch (verifyError) {
      setSessionReady(false);
      setAwaitingConfirmation(false);
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : 'Não foi possível validar o link de recuperação.',
      );
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (!passwordValid) {
      setError('A senha deve ter pelo menos 8 caracteres e as confirmações precisam ser iguais.');
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setSessionReady(false);
      setError('A sessão de recuperação não está mais disponível. Solicite um novo link.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      await supabase.auth.signOut();
      navigate('/login', { replace: true, state: { passwordUpdated: true } });
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'Não foi possível atualizar sua senha.',
      );
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
          <Loader2 className="h-5 w-5 animate-spin" /> Preparando a recuperação...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-7 shadow-xl dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#19A999]/10 text-[#19A999]">
            {awaitingConfirmation ? <ShieldCheck size={28} /> : <KeyRound size={28} />}
          </div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">
            {awaitingConfirmation ? 'Confirme a recuperação' : 'Defina sua nova senha'}
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {awaitingConfirmation
              ? 'Por segurança, confirme que deseja continuar antes de validarmos o link.'
              : 'Use pelo menos 8 caracteres.'}
          </p>
        </div>

        {awaitingConfirmation ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-800 dark:border-teal-900/50 dark:bg-teal-950/30 dark:text-teal-300">
              O link ainda não foi consumido. Clique abaixo para iniciar a redefinição de senha.
            </div>
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </div>
            )}
            <button
              type="button"
              onClick={verifyRecoveryLink}
              disabled={verifying}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#19A999] px-4 py-3 font-bold text-white transition hover:bg-[#14887B] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {verifying ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck size={19} />}
              Continuar com a redefinição
            </button>
          </div>
        ) : !sessionReady ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
              {error || 'O link expirou ou já foi utilizado. Solicite uma nova recuperação de senha.'}
            </div>
            <Link
              to="/forgot-password"
              className="block w-full rounded-xl bg-[#19A999] px-4 py-3 text-center font-bold text-white hover:bg-[#14887B]"
            >
              Solicitar novo link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Nova senha</label>
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
              <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Confirmar nova senha</label>
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

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !passwordValid}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#19A999] px-4 py-3 font-bold text-white transition hover:bg-[#14887B] disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle size={19} />}
              Salvar nova senha
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
