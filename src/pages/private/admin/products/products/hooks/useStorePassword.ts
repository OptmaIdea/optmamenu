import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { toast } from 'sonner';

const DEV_FALLBACK_PASSWORD = '123456';

export const useStorePassword = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchStockPasswordHash = async (): Promise<string | null> => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuário não autenticado');

            const { data: store, error } = await supabase
                .from('stores')
                .select('stock_password_hash')
                .eq('user_id', user.id)
                .maybeSingle();

            if (error) throw error;
            return store?.stock_password_hash || null;
        } catch (err) {
            console.error('Erro ao buscar hash da senha:', err);
            return null;
        }
    };

    const verifyPassword = async (plainPassword: string): Promise<boolean> => {
        setLoading(true);
        setError(null);

        try {
            const hash = await fetchStockPasswordHash();

            // --- Caso 1: Nenhuma senha configurada ---
            if (!hash) {
                const isValid = plainPassword === DEV_FALLBACK_PASSWORD;
                if (!isValid) {
                    setError(`Senha de estoque não configurada. Use a senha padrão "${DEV_FALLBACK_PASSWORD}" ou configure em "Dados da Loja".`);
                } else {
                    toast.info('Usando senha padrão de desenvolvimento. Configure sua senha em "Dados da Loja".');
                }
                return isValid;
            }

            // --- Caso 2: Hash armazenado (pode ser bcrypt ou texto puro) ---

            // 2a. Se começa com "$2", é bcrypt – usa bcrypt.compare
            if (hash.startsWith('$2')) {
                const isValid = await bcrypt.compare(plainPassword, hash);
                if (!isValid) setError('Senha incorreta.');
                return isValid;
            }

            // 2b. Se não começa com "$2", é senha em texto puro (formato antigo)
            // Exibe aviso, mas permite comparar diretamente
            toast.warning(
                'Sua senha de estoque está em formato antigo. Por segurança, defina uma nova senha em "Dados da Loja".',
                { duration: 8000 }
            );

            const isValid = plainPassword === hash;
            if (!isValid) {
                setError('Senha incorreta. Se você esqueceu, redefina em "Dados da Loja".');
            }
            return isValid;
        } catch (err) {
            setError('Erro ao verificar senha.');
            return false;
        } finally {
            setLoading(false);
        }
    };

    return { verifyPassword, loading, error };
};