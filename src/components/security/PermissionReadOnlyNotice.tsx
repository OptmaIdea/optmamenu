import { Lock } from 'lucide-react';

type PermissionReadOnlyNoticeProps = {
    title?: string;
    message?: string;
    className?: string;
};

export default function PermissionReadOnlyNotice({
    title = 'Modo leitura',
    message = 'Você pode visualizar estas informações, mas não tem permissão para executar alterações.',
    className = '',
}: PermissionReadOnlyNoticeProps) {
    return (
        <div
            className={`rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200 ${className}`}
            role="note"
        >
            <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-amber-100 p-1.5 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
                    <Lock size={16} aria-hidden="true" />
                </div>
                <div>
                    <p className="font-black uppercase tracking-wider">{title}</p>
                    <p className="mt-1 font-semibold leading-relaxed">{message}</p>
                </div>
            </div>
        </div>
    );
}
