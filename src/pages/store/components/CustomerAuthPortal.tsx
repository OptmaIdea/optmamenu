import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, LogOut, ShieldCheck, Smartphone, User, X } from 'lucide-react';
import { AuthService } from '@/services/customerAuth';
import { PublicStorefrontService } from '@/services/publicStorefrontService';
import { useCustomerAuth } from '@/store/useCustomerAuth';

type AuthMode = 'login' | 'register';
type AuthStep = 'form' | 'otp';

interface CustomerAuthPortalProps {
    storeSlug?: string | null;
    storeId?: string | null;
}

function cleanPhone(value: string) {
    return value.replace(/\D/g, '');
}

export function CustomerAuthPortal({ storeSlug, storeId }: CustomerAuthPortalProps) {
    const {
        customer,
        isAuthenticated,
        sessionRestored,
        markSessionRestored,
    } = useCustomerAuth();

    const [resolvedStoreId, setResolvedStoreId] = useState(storeId || '');
    const [storeName, setStoreName] = useState('');
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState<AuthMode>('login');
    const [step, setStep] = useState<AuthStep>('form');
    const [phone, setPhone] = useState('');
    const [nickname, setNickname] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    useEffect(() => {
        let active = true;

        void AuthService.restoreSession()
            .catch(() => null)
            .finally(() => {
                if (active) markSessionRestored();
            });

        return () => {
            active = false;
        };
    }, [markSessionRestored]);

    useEffect(() => {
        if (storeId) {
            setResolvedStoreId(storeId);
            return;
        }

        if (!storeSlug) return;
        let active = true;

        void PublicStorefrontService.getStorefrontBySlug(storeSlug)
            .then((result) => {
                if (!active || !result.ok || !result.store) return;
                setResolvedStoreId(result.store.id);
                setStoreName(result.store.name);
            })
            .catch(() => undefined);

        return () => {
            active = false;
        };
    }, [storeId, storeSlug]);

    useEffect(() => {
        if (
            sessionRestored
            && isAuthenticated
            && customer?.store_id
            && resolvedStoreId
            && customer.store_id !== resolvedStoreId
        ) {
            void AuthService.logoutCustomer();
        }
    }, [customer?.store_id, isAuthenticated, resolvedStoreId, sessionRestored]);

    const displayName = useMemo(
        () => customer?.nickname || customer?.full_name || 'cliente',
        [customer?.full_name, customer?.nickname],
    );

    const resetFlow = (nextMode: AuthMode = 'login') => {
        setMode(nextMode);
        setStep('form');
        setOtp('');
        setError('');
        setNotice('');
        setLoading(false);
        if (nextMode === 'login') {
            setNickname('');
            setBirthDate('');
            setTermsAccepted(false);
        }
    };

    const closeModal = () => {
        setOpen(false);
        resetFlow('login');
    };

    const startLogin = () => {
        resetFlow('login');
        setOpen(true);
    };

    const switchMode = (nextMode: AuthMode) => {
        resetFlow(nextMode);
    };

    const sendCode = async () => {
        const digits = cleanPhone(phone);
        if (!resolvedStoreId) {
            setError('A loja ainda está sendo carregada. Tente novamente em alguns segundos.');
            return;
        }
        if (digits.length < 10 || digits.length > 13) {
            setError('Informe um telefone válido com DDD.');
            return;
        }
        if (mode === 'register') {
            if (!nickname.trim()) {
                setError('Informe seu nome ou apelido.');
                return;
            }
            if (!termsAccepted) {
                setError('Aceite os Termos de Uso e a Política de Privacidade para continuar.');
                return;
            }
        }

        setLoading(true);
        setError('');
        setNotice('');

        try {
            await AuthService.sendOtp(
                digits,
                resolvedStoreId,
                mode === 'register' ? 'registration' : 'login',
            );
            setStep('otp');
            setOtp('');
            setNotice('Código enviado por SMS. Ele é válido por 5 minutos.');
        } catch (sendError) {
            setError(sendError instanceof Error ? sendError.message : 'Não foi possível enviar o código.');
        } finally {
            setLoading(false);
        }
    };

    const verifyCode = async () => {
        const digits = cleanPhone(phone);
        const cleanOtp = otp.replace(/\D/g, '');
        if (cleanOtp.length !== 6) {
            setError('Digite os 6 números recebidos por SMS.');
            return;
        }

        setLoading(true);
        setError('');
        setNotice('');

        try {
            await AuthService.verifyOtp(
                digits,
                cleanOtp,
                resolvedStoreId,
                mode === 'register' ? 'registration' : 'login',
                mode === 'register'
                    ? {
                        nickname: nickname.trim(),
                        birthDate: birthDate || undefined,
                        termsAccepted: true,
                        marketingConsent: false,
                        loyaltyOptIn: false,
                    }
                    : undefined,
            );
            setOpen(false);
            setOtp('');
            setError('');
            setNotice('');
        } catch (verifyError) {
            const message = verifyError instanceof Error
                ? verifyError.message
                : 'Não foi possível validar o código.';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const resendCode = async () => {
        if (loading) return;
        await sendCode();
    };

    const logout = async () => {
        setLoading(true);
        try {
            await AuthService.logoutCustomer();
        } finally {
            setLoading(false);
        }
    };

    if (!sessionRestored) {
        return (
            <div className="fixed bottom-28 left-4 z-[65] flex h-11 items-center gap-2 rounded-full border border-white/30 bg-slate-900/90 px-4 text-xs font-bold text-white shadow-xl backdrop-blur sm:bottom-5">
                <Loader2 className="h-4 w-4 animate-spin" />
                Verificando conta
            </div>
        );
    }

    return (
        <>
            <div className="fixed bottom-28 left-4 z-[65] sm:bottom-5">
                {isAuthenticated && customer ? (
                    <div className="flex items-center gap-1 rounded-full border border-emerald-200 bg-white p-1 pl-3 shadow-xl dark:border-emerald-900 dark:bg-slate-900">
                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                        <span className="max-w-32 truncate text-xs font-black text-slate-800 dark:text-white">
                            Olá, {displayName}
                        </span>
                        <button
                            type="button"
                            onClick={logout}
                            disabled={loading}
                            className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-600 transition hover:bg-red-100 disabled:opacity-50 dark:bg-red-950/40 dark:text-red-300"
                            aria-label="Sair da conta"
                            title="Sair da conta"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={startLogin}
                        className="flex h-11 items-center gap-2 rounded-full bg-slate-900 px-4 text-sm font-black text-white shadow-xl transition hover:bg-slate-800 dark:bg-white dark:text-slate-900"
                    >
                        <User className="h-4 w-4" />
                        Entrar
                    </button>
                )}
            </div>

            {open && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
                    <div className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900">
                        <button
                            type="button"
                            onClick={closeModal}
                            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                            aria-label="Fechar"
                        >
                            <X className="h-4 w-4" />
                        </button>

                        <div className="mb-6 pr-10">
                            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                                <Smartphone className="h-5 w-5" />
                            </div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white">
                                {mode === 'login' ? 'Entrar com SMS' : 'Criar sua conta'}
                            </h2>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                {step === 'otp'
                                    ? `Digite o código enviado para ${phone}.`
                                    : mode === 'login'
                                        ? `Use seu telefone para entrar${storeName ? ` na ${storeName}` : ''}.`
                                        : 'Confirme seu telefone para proteger sua conta.'}
                            </p>
                        </div>

                        {error && (
                            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                                {error}
                            </div>
                        )}

                        {notice && (
                            <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                                {notice}
                            </div>
                        )}

                        {step === 'form' ? (
                            <div className="space-y-4">
                                {mode === 'register' && (
                                    <>
                                        <div>
                                            <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-200">
                                                Nome ou apelido
                                            </label>
                                            <input
                                                type="text"
                                                value={nickname}
                                                onChange={(event) => setNickname(event.target.value)}
                                                autoComplete="name"
                                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                                placeholder="Como podemos chamar você?"
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-200">
                                                Data de nascimento <span className="font-normal text-slate-400">(opcional)</span>
                                            </label>
                                            <input
                                                type="date"
                                                value={birthDate}
                                                onChange={(event) => setBirthDate(event.target.value)}
                                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                            />
                                        </div>
                                    </>
                                )}

                                <div>
                                    <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-200">
                                        Telefone com DDD
                                    </label>
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={(event) => setPhone(event.target.value)}
                                        autoComplete="tel"
                                        inputMode="tel"
                                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                        placeholder="(62) 99999-9999"
                                    />
                                </div>

                                {mode === 'register' && (
                                    <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                        <input
                                            type="checkbox"
                                            checked={termsAccepted}
                                            onChange={(event) => setTermsAccepted(event.target.checked)}
                                            className="mt-1 h-4 w-4"
                                        />
                                        <span>
                                            Li e aceito os{' '}
                                            <Link to="/terms" target="_blank" className="font-bold text-emerald-600 hover:underline">
                                                Termos de Uso
                                            </Link>{' '}
                                            e a{' '}
                                            <Link to="/politica-privacidade" target="_blank" className="font-bold text-emerald-600 hover:underline">
                                                Política de Privacidade
                                            </Link>.
                                        </span>
                                    </label>
                                )}

                                <button
                                    type="button"
                                    onClick={sendCode}
                                    disabled={loading || !resolvedStoreId}
                                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 font-black text-white transition hover:bg-emerald-700 disabled:opacity-50"
                                >
                                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                                    Enviar código por SMS
                                </button>

                                <button
                                    type="button"
                                    onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                                    className="w-full py-2 text-sm font-bold text-emerald-700 hover:underline dark:text-emerald-400"
                                >
                                    {mode === 'login' ? 'Ainda não tenho conta' : 'Já tenho conta'}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <input
                                    type="text"
                                    value={otp}
                                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    maxLength={6}
                                    autoFocus
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center text-3xl font-black tracking-[0.35em] text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                    placeholder="000000"
                                />

                                <button
                                    type="button"
                                    onClick={verifyCode}
                                    disabled={loading}
                                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 font-black text-white transition hover:bg-emerald-700 disabled:opacity-50"
                                >
                                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                                    Validar código e entrar
                                </button>

                                <div className="flex items-center justify-between gap-3 text-sm">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setStep('form');
                                            setOtp('');
                                            setError('');
                                            setNotice('');
                                        }}
                                        className="font-bold text-slate-500 hover:underline dark:text-slate-400"
                                    >
                                        Alterar dados
                                    </button>
                                    <button
                                        type="button"
                                        onClick={resendCode}
                                        disabled={loading}
                                        className="font-bold text-emerald-700 hover:underline disabled:opacity-50 dark:text-emerald-400"
                                    >
                                        Reenviar código
                                    </button>
                                </div>

                                {mode === 'login' && error.includes('Cliente não encontrado') && (
                                    <button
                                        type="button"
                                        onClick={() => switchMode('register')}
                                        className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 py-3 text-sm font-black text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
                                    >
                                        Criar conta com este telefone
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
