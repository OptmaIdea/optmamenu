import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { useEffect, useState } from 'react';

export function ProtectedRoute() {
    const { session, loading } = useAuthStore();
    const location = useLocation();
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        // Pequeno delay para evitar flicker
        const timer = setTimeout(() => {
            setIsChecking(false);
        }, 300);

        return () => clearTimeout(timer);
    }, []);

    if (loading || isChecking) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="flex flex-col items-center">
                    <div className="relative">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#19A999]"></div>
                        <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-2 border-[#19A999] opacity-20"></div>
                    </div>
                    <p className="mt-4 text-gray-600 dark:text-gray-300 font-candara">
                        Verificando sua autenticação...
                    </p>
                </div>
            </div>
        );
    }

    if (!session) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <Outlet />;
}