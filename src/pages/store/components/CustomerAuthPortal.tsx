import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, Loader2, LogOut, ShieldCheck, Smartphone, User, X } from 'lucide-react';
import { AuthService } from '@/services/customerAuth';
import { PublicStorefrontService } from '@/services/publicStorefrontService';
import { useCustomerAuth } from '@/store/useCustomerAuth';

type AuthMode = 'login' | 'register';
type AuthStep = 'form' | 'otp' | 'password_setup';
type OtpContext = 'registration' | 'password_stepup' | 'sms_login';

interface CustomerAuthPortalProps {
    storeSlug?: string | null;
    storeId?: string | null;
}

function cleanPhone(value: string) {
    return value.replace(/\D/g, '');
}

function validPassword(value: string) {
    return value.length >= 8 && value.length <= 72 && /[A-Za-z]/.test(value) && /[0-9]/.test(value);
}

function stepUpMessage(reason?: string | null) {
    if (reason === 'verification_expired') {
        return 'Já faz 30 dias desde a última confirmação deste aparelho. Enviamos um novo código de segurança.';
    }
    if (reason === 'inactive') {
        return 'Este aparelho ficou mais de 15 dias sem acesso. Enviamos um código para confirmar que é você.';
    }
    return 'Este aparelho ainda não foi confirmado. Enviamos um código de segurança por SMS.';
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
    const [otpContext, setOtpContext] = useState<OtpContext>('sms_login');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
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
        if (storeId) setResolvedStoreId(storeId);
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
    const senderName = storeName || storeSlug || 'esta loja';

    const resetFlow = (nextMode: AuthMode = 'login') => {
        setMode(nextMode);
        setStep('form');
        setOtpContext(nextMode === 'register' ? 'registration' : 'sms_login');
        setOtp('');
        setPassword('');
        setConfirmPassword('');
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

    const validatePhone = () => {
        const digits = cleanPhone(phone);
        if (!resolvedStoreId) {
            setError('A loja ainda está sendo carregada. Tente novamente em alguns segundos.');
            return null;
        }
        if (digits.length < 10 || digits.length > 13) {
            setError('Informe um telefone válido com DDD.');
            return null;
        }
        return digits;
    };

    const sendLoginOtp = async (context: OtpContext, customNotice?: string) => {
        const digits = validatePhone();
        if (!digits) return;

        setLoading(true);
        setError('');
        setNotice('');
        try {
            await AuthService.sendOtp(digits, resolvedStoreId, 'login');
            setOtpContext(context);
            setStep('otp');
            setOtp('');
            setNotice(customNotice || `Código de ${senderName} enviado por SMS. Ele é válido por 5 minutos.`);
        } catch (sendError) {
            setError(sendError instanceof Error ? sendError.message : 'Não foi possível enviar o código.');
        } finally {
            setLoading(false);
        }
    };

    const submitPasswordLogin = async () => {
        const digits = validatePhone();
        if (!digits) return;
        if (!password) {
            setError('Informe sua senha.');
            return;
        }

        setLoading(true);
        setError('');
        setNotice('');
        try {
            const result = await AuthService.loginWithPassword(digits, password, resolvedStoreId);
            if (result.authenticated) {
                closeModal();
                return;
            }

            if (result.otpRequired) {
                await AuthService.sendOtp(digits, resolvedStoreId, 'login');
                setOtpContext('password_stepup');
                setStep('otp');
                setOtp('');
                setNotice(stepUpMessage(result.reason));
            }
        } catch (loginError) {
            setError(loginError instanceof Error ? loginError.message : 'Não foi possível entrar.');
        } finally {
            setLoading(false);
        }
    };

    const sendRegistrationOtp = async () => {
        const digits = validatePhone();
        if (!digits) return;
        if (!nickname.trim()) {
            setError('Informe seu nome ou apelido.');
            return;
        }
        if (!validPassword(password)) {
            setError('Crie uma senha de 8 a 72 caracteres, com pelo menos uma letra e um número.');
            return;
        }
        if (password !== confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }
        if (!termsAccepted) {
            setError('Aceite os Termos de Uso e a Política de Privacidade para continuar.');
            return;
        }

        setLoading(true);
        setError('');
        setNotice('');
        try {
            await AuthService.sendOtp(digits, resolvedStoreId, 'registration');
            setOtpContext('registration');
            setStep('otp');
            setOtp('');
            setNotice(`Código de ${senderName} enviado por SMS. Ele é válido por 5 minutos.`);
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
            const result = await AuthService.verifyOtp(
                digits,
                cleanOtp,
                resolvedStoreId,
                otpContext === 'registration' ? 'registration' : 'login',
                otpContext === 'registration'
                    ? {
                        nickname: nickname.trim(),
                        birthDate: birthDate || undefined,
                        termsAccepted: true,
                        marketingConsent: false,
                        loyaltyOptIn: false,
                        password,
                    }
                    : undefined,
            );

            if (otpContext === 'sms_login' && !result.passwordConfigured) {
                setStep('password_setup');
                setPassword('');
                setConfirmPassword('');
                setOtp('');
                setNotice('Telefone confirmado. Crie uma senha para que os próximos acessos sejam mais rápidos.');
                return;
            }

            closeModal();
        } catch (verifyError) {
            setError(verifyError instanceof Error ? verifyError.message : 'Não foi possível validar o código.');
        } finally {
            setLoading(false);
        }
    };

    const savePassword = async () => {
        if (!validPassword(password)) {
            setError('A senha deve ter de 8 a 72 caracteres, com pelo menos uma letra e um número.');
            return;
        }
        if (password !== confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }

        setLoading(true);
        setError('');
        try {
            await AuthService.setPassword(password);
            closeModal();
        } catch (passwordError) {
            setError(passwordError instanceof Error ? passwordError.message : 'Não foi possível salvar a senha.');
        } finally {
            setLoading(false);
        }
    };

    const resendCode = async () => {
        if (loading) return;
        if (otpContext === 'registration') {
            await sendRegistrationOtp();
            return;
        }
        await sendLoginOtp(otpContext);
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
                                {step === 'password_setup' ? <KeyRound className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
                            </div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white">
                                {step === 'password_setup'
                                    ? 'Crie sua senha'
                                    : step === 'otp'
                                        ? (mode === 'register' ? 'Confirmar seu telefone' : 'Confirmação por SMS')
                                        : mode === 'login'
                                            ? 'Entrar'
                                            : 'Criar sua conta'}
                            </h2>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                {step === 'otp'
                                    ? `Digite o código enviado por ${senderName} para ${phone}.`
                                    : step === 'password_setup'
                                        ? 'Sua senha será usada nos próximos acessos. O SMS será pedido novamente apenas quando a política de segurança exigir.'
                                        : mode === 'login'
                                            ? `Entre com telefone e senha${storeName ? ` na ${storeName}` : ''}.`
                                            : 'Confirme seu telefone e crie uma senha para proteger sua conta.'}
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

                        {step === 'form' && (
                            <div className="space-y-4">
                                {mode === 'register' && (
                                    <>
                                        <div>
                                            <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-200">Nome ou apelido</label>
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
                                    <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-200">Telefone com DDD</label>
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

                                <div>
                                    <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-200">Senha</label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(event) => setPassword(event.target.value)}
                                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                        placeholder={mode === 'login' ? 'Sua senha' : 'Mínimo de 8 caracteres'}
                                    />
                                </div>

                                {mode === 'register' && (
                                    <>
                                        <div>
                                            <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-200">Repita a senha</label>
                                            <input
                                                type="password"
                                                value={confirmPassword}
                                                onChange={(event) => setConfirmPassword(event.target.value)}
                                                autoComplete="new-password"
                                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                                placeholder="Repita a senha"
                                            />
                                        </div>
                                        <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                                            Use de 8 a 72 caracteres, com pelo menos uma letra e um número.
                                        </p>
                                        <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                            <input
                                                type="checkbox"
                                                checked={termsAccepted}
                                                onChange={(event) => setTermsAccepted(event.target.checked)}
                                                className="mt-1 h-4 w-4"
                                            />
                                            <span>
                                                Li e aceito os{' '}
                                                <Link to="/terms" target="_blank" className="font-bold text-emerald-600 hover:underline">Termos de Uso</Link>{' '}
                                                e a{' '}
                                                <Link to="/politica-privacidade" target="_blank" className="font-bold text-emerald-600 hover:underline">Política de Privacidade</Link>.
                                            </span>
                                        </label>
                                    </>
                                )}

                                <button
                                    type="button"
                                    onClick={mode === 'login' ? submitPasswordLogin : sendRegistrationOtp}
                                    disabled={loading || !resolvedStoreId}
                                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 font-black text-white transition hover:bg-emerald-700 disabled:opacity-50"
                                >
                                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {mode === 'login' ? 'Entrar' : 'Confirmar telefone por SMS'}
                                </button>

                                {mode === 'login' && (
                                    <button
                                        type="button"
                                        onClick={() => sendLoginOtp('sms_login')}
                                        disabled={loading || !resolvedStoreId}
                                        className="w-full rounded-2xl border border-emerald-200 py-3 text-sm font-black text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-950/20"
                                    >
                                        Entrar com código SMS
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                                    className="w-full py-2 text-sm font-bold text-emerald-700 hover:underline dark:text-emerald-400"
                                >
                                    {mode === 'login' ? 'Ainda não tenho conta' : 'Já tenho conta'}
                                </button>
                            </div>
                        )}

                        {step === 'otp' && (
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
                            </div>
                        )}

                        {step === 'password_setup' && (
                            <div className="space-y-4">
                                <div>
                                    <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-200">Nova senha</label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(event) => setPassword(event.target.value)}
                                        autoComplete="new-password"
                                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                        placeholder="Mínimo de 8 caracteres"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-200">Repita a senha</label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(event) => setConfirmPassword(event.target.value)}
                                        autoComplete="new-password"
                                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                        placeholder="Repita a senha"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={savePassword}
                                    disabled={loading}
                                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 font-black text-white transition hover:bg-emerald-700 disabled:opacity-50"
                                >
                                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                                    Salvar senha e continuar
                                </button>
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    disabled={loading}
                                    className="w-full py-2 text-sm font-bold text-slate-500 hover:underline disabled:opacity-50 dark:text-slate-400"
                                >
                                    Fazer isso depois
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
