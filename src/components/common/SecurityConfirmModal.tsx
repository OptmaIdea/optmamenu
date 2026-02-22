import { useState, useEffect, useRef } from 'react';
import { X, Lock, Hash } from 'lucide-react';
import { toast } from 'sonner';
import { useStorePassword } from '@/pages/private/admin/products/products/hooks/useStorePassword';

interface SecurityConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (password?: string) => Promise<void> | void;   // ← adicione o parâmetro opcional
    title?: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    requireToken?: boolean;
    tokenExpirySeconds?: number;
    maxTokenAttempts?: number;
    passPassword?: boolean;
}

export default function SecurityConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title = 'Confirmar ação',
    description = 'Esta ação requer autorização.',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    requireToken = true,
    tokenExpirySeconds = 45,
    maxTokenAttempts = 3,
    passPassword = false,
}: SecurityConfirmModalProps) {
    const { verifyPassword, loading: verifying, error: passwordError } = useStorePassword();

    const [step, setStep] = useState<'password' | 'token'>('password');
    const [password, setPassword] = useState('');
    const [localPasswordError, setLocalPasswordError] = useState('');
    const [token, setToken] = useState('');
    const [tokenError, setTokenError] = useState('');
    const [generatedToken, setGeneratedToken] = useState('');
    const [tokenAttempts, setTokenAttempts] = useState(0);
    const [timeLeft, setTimeLeft] = useState(tokenExpirySeconds);
    const [isConfirming, setIsConfirming] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const isExpiredRef = useRef(false);

    // Reset ao abrir
    useEffect(() => {
        if (isOpen) {
            setStep('password');
            setPassword('');
            setLocalPasswordError('');
            setToken('');
            setTokenError('');
            setGeneratedToken('');
            setTokenAttempts(0);
            setTimeLeft(tokenExpirySeconds);
        }
    }, [isOpen, tokenExpirySeconds]);

    // Cleanup timer
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const startTokenTimer = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setTimeLeft(tokenExpirySeconds);
        isExpiredRef.current = false;
        timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    if (!isExpiredRef.current) {
                        isExpiredRef.current = true;
                        handleTokenExpired();
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const handleTokenExpired = () => {
        setTokenAttempts((prev) => {
            const nextAttempt = prev + 1;
            if (nextAttempt >= maxTokenAttempts) {
                toast.warning('Número máximo de tentativas excedido. Operação cancelada.');
                onClose();
                return prev;
            }
            const newToken = generateToken();
            setGeneratedToken(newToken);
            setToken('');
            setTokenError('');
            setTimeLeft(tokenExpirySeconds);
            startTokenTimer();
            toast.info(`⏰ Token expirado. Nova tentativa ${nextAttempt + 1}/${maxTokenAttempts}.`, { duration: 4000 });
            return nextAttempt;
        });
    };

    const generateToken = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalPasswordError('');

        const isValid = await verifyPassword(password);
        if (!isValid) {
            setLocalPasswordError(passwordError || 'Senha incorreta.');
            return;
        }

        if (!requireToken) {
            // Sem token, confirma direto
            setIsConfirming(true);
            try {
                await onConfirm();
                toast.success('Ação confirmada com sucesso!');
                onClose();
            } catch (error: any) {
                toast.error('Erro ao executar ação: ' + error.message);
            } finally {
                setIsConfirming(false);
            }
            return;
        }

        // Gera token
        const newToken = generateToken();
        setGeneratedToken(newToken);
        setTokenAttempts(0);
        setTimeLeft(tokenExpirySeconds);
        startTokenTimer();
        toast.info(
            <div className="flex flex-col gap-1">
                <span className="font-bold text-lg">🔐 Token de confirmação</span>
                <span className="font-mono text-2xl tracking-wider">{newToken}</span>
                <span className="text-xs opacity-80">Você tem {tokenExpirySeconds}s para digitar o token.</span>
            </div>,
            { duration: tokenExpirySeconds * 1000 }
        );
        setStep('token');
    };

    const handleTokenSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setTokenError('');

        if (token !== generatedToken) {
            setTokenError('Token incorreto.');
            return;
        }

        if (timerRef.current) clearInterval(timerRef.current);
        setIsConfirming(true);
        console.log('[SecurityConfirm] Senha digitada:', password);
        console.log('[SecurityConfirm] Token gerado:', generatedToken);
        console.log('[SecurityConfirm] Token digitado:', token);
        try {
            if (passPassword) {
                console.log('[SecurityConfirm] Chamando onConfirm com senha');
                await onConfirm(password);
            } else {
                await onConfirm();
            }
            toast.success('Ação confirmada com sucesso!');
            onClose();
        } catch (error) {
            console.error('[SecurityConfirm] Erro em onConfirm:', error);
        } finally {
            setIsConfirming(false);
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        toast.warning('Copiar/colar não permitido. Digite o token manualmente.');
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Lock size={20} className="text-[#21A896]" />
                        {step === 'password' ? title : 'Confirmar token'}
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{description}</p>

                    {step === 'password' ? (
                        <form onSubmit={handlePasswordSubmit}>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                                        <Lock size={16} /> Senha de estoque
                                    </label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#21A896]"
                                        placeholder="••••••••"
                                        autoFocus
                                        required
                                    />
                                    {localPasswordError && (
                                        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{localPasswordError}</p>
                                    )}
                                </div>
                                <div className="flex justify-end gap-3 mt-6">
                                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition">
                                        {cancelText}
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={verifying || !password}
                                        className="px-4 py-2 bg-[#21A896] hover:bg-[#1a867a] text-white rounded-lg font-medium transition disabled:opacity-50"
                                    >
                                        {verifying ? 'Verificando...' : 'Continuar'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    ) : (
                        <form onSubmit={handleTokenSubmit}>
                            <div className="space-y-5">
                                {generatedToken && (
                                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border-2 border-yellow-400 dark:border-yellow-600">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-xs font-bold text-yellow-800 dark:text-yellow-300 flex items-center gap-1">
                                                <Hash size={14} /> SEU TOKEN
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-mono bg-yellow-200 dark:bg-yellow-800 px-2 py-1 rounded-full text-yellow-900 dark:text-yellow-100">
                                                    {tokenAttempts + 1}/{maxTokenAttempts}
                                                </span>
                                                <span className="text-xs font-mono bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded-full text-red-700 dark:text-red-400">
                                                    ⏳ {formatTime(timeLeft)}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-mono text-3xl font-bold tracking-widest text-yellow-900 dark:text-yellow-200 bg-white dark:bg-gray-900 px-3 py-2 rounded-lg border border-yellow-300 dark:border-yellow-700 flex-1 text-center">
                                                {generatedToken}
                                            </span>
                                        </div>
                                        <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-2">
                                            ⚠️ Copiar/colar não permitido. Digite o token manualmente.
                                        </p>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Token de confirmação</label>
                                    <input
                                        type="text"
                                        value={token}
                                        onChange={(e) => setToken(e.target.value.toUpperCase())}
                                        onPaste={handlePaste}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#21A896] font-mono tracking-widest uppercase"
                                        placeholder="EX: 3F9K2A"
                                        autoFocus
                                        required
                                        maxLength={6}
                                    />
                                    {tokenError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{tokenError}</p>}
                                </div>

                                <div className="flex justify-end gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (timerRef.current) clearInterval(timerRef.current);
                                            setStep('password');
                                        }}
                                        className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                                    >
                                        Voltar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isConfirming || token.length !== 6}
                                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition disabled:opacity-50"
                                    >
                                        {isConfirming ? 'Processando...' : confirmText}
                                    </button>
                                </div>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}