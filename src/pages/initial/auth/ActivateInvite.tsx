import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { acceptStoreMemberInvite } from '@/services/myStoreInviteService';
import { setActiveStoreId } from '@/utils/activeStore';
import { markSessionAsActive } from '@/utils/sessionSecurity';

function clearSensitiveAuthParams() {
  const url = new URL(window.location.href);
  url.hash = '';
  url.searchParams.delete('token_hash');
  url.searchParams.delete('type');
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
}

function getHashTokens() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return {
    accessToken: hash.get('access_token'),
    refreshToken: hash.get('refresh_token'),
  };
}

export default function ActivateInvite() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const storeId = searchParams.get('store_id') ?? '';
  const mode = searchParams.get('mode') ?? 'invite';
  const tokenHash = searchParams.get('token_hash');
  const tokenType = searchParams.get('type');
  const requiresPassword = mode === 'invite';

  const [checking, setChecking] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [awaitingHumanConfirmation, setAwaitingHumanConfirmation] = useState(false);
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

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted || !session) return;
      setSessionReady(true);
      setAwaitingHumanConfirmation(false);
      setError('');
      setChecking(false);
      clearSensitiveAuthParams();
    });

    const resolveExistingSession = async () => {
      try {
        const current = await supabase.auth.getSession();
        if (current.data.session) {
          if (!mounted) return;
          setSessionReady(true);
          setAwaitingHumanConfirmation(false);
          clearSensitiveAuthParams();
          return;
        }

        const { accessToken, refreshToken } = getHashTokens();
        if (accessToken && refreshToken) {
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) throw sessionError;
          if (data.session) {
            if (!mounted) return;
            setSessionReady(true);
            setAwaitingHumanConfirmation(false);
            clearSensitiveAuthParams();
            return;
          }
        }

        if (tokenHash) {
          if (!mounted) return;
          setAwaitingHumanConfirmation(true);
          setSessionReady(false);
          setError('');
          return;
        }

        if (mounted) {
          setSessionReady(false);
          setAwaitingHumanConfirmation(false);
          setError('Este link não contém os dados necessários para ativação. Solicite um novo convite.');
        }
      } catch (sessionError) {
        if (!mounted) return;
        setSessionReady(false);
        setAwaitingHumanConfirmation(Boolean(tokenHash));
        setError(
          sessionError instanceof Error
            ? sessionError.message
            : 'Não foi possível preparar a ativação do convite.',
        );
      } finally {
        if (mounted) setChecking(false);
      }
    };

    void resolveExistingSession();

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [tokenHash]);

  const verifyInviteAfterHumanAction = async () => {
    if (!tokenHash) {
      setError('O convite não contém um código de ativação válido. Solicite um novo convite.');
      return;
    }

    setChecking(true);
    setError('');

    try {
      const verifyType = tokenType === 'magiclink' ? 'magiclink' : 'invite';
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: verifyType,
      });

      if (verifyError) throw verifyError;
      if (!data.session) {
        throw new Error('Não foi possível iniciar a sessão do convite.');
      }

      setSessionReady(true);
      setAwaitingHumanConfirmation(false);
      clearSensitiveAuthParams();
    } catch (verificationError) {
      setSessionReady(false);
      setAwaitingHumanConfirmation(true);
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : 'Não foi possível validar o convite.',
      );
    } finally {
      setChecking(false);
    }
  };

  const finishActivation = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (!storeId) {
      setError('O convite não contém a identificação da loja. Solicite um novo convite.');
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setSessionReady(false);
      setError('A sessão do convite não está disponível. Solicite um novo convite.');
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
          Preparando seu convite...
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
            {awaitingHumanConfirmation
              ? 'Confirme que foi você quem abriu este convite para continuar.'
              : requiresPassword
                ? 'Defina sua senha para concluir o acesso ao OptmaMenu.'
                : 'Confirme o vínculo com a nova loja para continuar.'}
          </p>
        </div>

        {awaitingHumanConfirmation && !sessionReady ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-800 dark:border-teal-900/50 dark:bg-teal-950/30 dark:text-teal-200">
              Por segurança, o convite só será validado após sua confirmação. Isso evita que sistemas automáticos de e-mail consumam o link antes de você.
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={() => void verifyInviteAfterHumanAction()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#19A999] px-4 py-3 font-bold text-white transition hover:bg-[#14887B]"
            >
              <ShieldCheck size={19} />
              Continuar com a ativação
            </button>
          </div>
        ) : (
          <form onSubmit={finishActivation} className="space-y-4">
            {requiresPassword && (
              <>
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
                  <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Confirmar senha</label>
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
        )}

        <p className="mt-5 text-center text-sm text-gray-500 dark:text-gray-400">
          Já concluiu a ativação?{' '}
          <Link to="/login" className="font-bold text-[#19A999] hover:underline">Ir para o login</Link>
        </p>
      </div>
    </div>
  );
}
