import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const STORAGE_KEY = 'APP_COOKIE_CONSENT';
const CONSENT_VERSION = '2.0';

export default function CookieConsent() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const storedConsent = localStorage.getItem(STORAGE_KEY);
        const storedVersion = localStorage.getItem(STORAGE_KEY + '_VERSION');

        // Mostrar se não houver consentimento armazenado OU versão desatualizada
        if (!storedConsent || storedVersion !== CONSENT_VERSION) {
            setIsVisible(true);
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem(STORAGE_KEY, 'accepted');
        localStorage.setItem(STORAGE_KEY + '_VERSION', CONSENT_VERSION);
        setIsVisible(false);
    };

    const handleReject = () => {
        localStorage.setItem(STORAGE_KEY, 'rejected');
        localStorage.setItem(STORAGE_KEY + '_VERSION', CONSENT_VERSION);
        setIsVisible(false);

        // Remover cookies não essenciais
        document.cookie = 'analytics=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        document.cookie = 'marketing=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    };

    if (!isVisible) return null;

    return (
        <div id="cookie-banner" className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4 z-[9999] border-t border-gray-100 dark:border-gray-700 animate-slideUp">
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">🍪</span>
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white font-candara-bold">
                            Cookies e Privacidade
                        </h3>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 font-candara">
                        Utilizamos cookies para melhorar sua experiência em nosso aplicativo e garantir o funcionamento adequado dos serviços.
                        Ao continuar navegando, você concorda com nossa{' '}
                        <Link to="/politica-privacidade" className="text-[#21A896] hover:underline font-bold">
                            Política de Privacidade
                        </Link>.
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-candara">
                        <strong>Para que servem os cookies:</strong> Armazenam preferências, mantêm sua sessão ativa e ajudam a personalizar sua experiência.
                    </p>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <button
                        onClick={handleReject}
                        id="reject-cookies"
                        className="flex-1 md:flex-none px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition font-medium text-sm whitespace-nowrap font-candara"
                    >
                        Não Aceitar
                    </button>
                    <button
                        onClick={handleAccept}
                        id="accept-cookies"
                        className="flex-1 md:flex-none px-6 py-2 bg-[#21A896] hover:bg-[#1A867A] text-white rounded-lg transition font-bold text-sm shadow-sm whitespace-nowrap font-candara-bold"
                    >
                        Aceitar Cookies
                    </button>
                </div>
            </div>
        </div>
    );
}