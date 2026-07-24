import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  LayoutDashboard,
  LogOut,
  MapPin,
  MonitorSmartphone,
  Moon,
  Store,
  Sun,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type PdvLayoutProps = {
  children: ReactNode;
  storeName?: string;
  operatorName?: string;
  operatorAvatarUrl?: string | null;
  locationName?: string;
  online: boolean;
  showAdminExit?: boolean;
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'OP';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function PdvLayout({
  children,
  storeName = 'OptmaMenu',
  operatorName = 'Operador',
  operatorAvatarUrl,
  locationName = 'Local não selecionado',
  online,
  showAdminExit = false,
}: PdvLayoutProps) {
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme === 'dark' ||
      (savedTheme !== 'light' && document.documentElement.classList.contains('dark'));
  });
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => setInstallPrompt(null);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut({ scope: 'local' });
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#F8F6F2] text-[#2D2A26] transition-colors dark:bg-gray-950 dark:text-gray-100">
      <header className="sticky top-0 z-40 border-b border-[#6B6258]/10 bg-white/95 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/95">
        <div className="flex min-h-[68px] items-center gap-2 px-2.5 sm:gap-3 sm:px-5">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F26541] text-white shadow-sm sm:h-11 sm:w-11 sm:rounded-2xl">
              <MonitorSmartphone size={22} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base font-bold sm:text-lg">PDV</h1>
                <span className="hidden rounded-full bg-[#21A896]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1A867A] sm:inline">
                  Operação
                </span>
              </div>
              <p className="flex min-w-0 items-center gap-1 text-[11px] text-[#6B6258] dark:text-gray-400 sm:text-xs">
                <Store size={12} className="shrink-0" aria-hidden="true" />
                <span className="max-w-24 truncate sm:max-w-44">{storeName}</span>
                <span aria-hidden="true">•</span>
                <MapPin size={12} className="shrink-0" aria-hidden="true" />
                <span className="max-w-24 truncate sm:max-w-44">{locationName}</span>
              </p>
            </div>
          </div>

          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-auto sm:w-auto sm:gap-1.5 sm:rounded-full sm:px-2.5 sm:py-1.5 ${
              online
                ? 'bg-[#21A896]/10 text-[#1A867A]'
                : 'bg-[#FBA93C]/15 text-[#8A5A00] dark:text-amber-300'
            }`}
            title={online ? 'Conectado' : 'Sem conexão'}
          >
            {online ? <Wifi size={17} /> : <WifiOff size={17} />}
            <span className="hidden text-xs font-semibold sm:inline">
              {online ? 'Online' : 'Offline'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsDark((current) => !current)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#6B6258] transition hover:bg-[#6B6258]/10 dark:text-gray-300 dark:hover:bg-gray-800"
            title={isDark ? 'Usar modo claro' : 'Usar modo escuro'}
            aria-label={isDark ? 'Usar modo claro' : 'Usar modo escuro'}
          >
            {isDark ? <Sun size={19} /> : <Moon size={19} />}
          </button>

          {installPrompt && (
            <button
              type="button"
              onClick={() => void handleInstall()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#1A867A] transition hover:bg-[#21A896]/10 sm:h-11 sm:w-auto sm:gap-2 sm:px-3"
              title="Instalar atalho exclusivo do PDV"
              aria-label="Instalar atalho exclusivo do PDV"
            >
              <Download size={18} aria-hidden="true" />
              <span className="hidden text-sm font-semibold xl:inline">
                Instalar PDV
              </span>
            </button>
          )}

          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#6B6258]/15 bg-[#7B2D8E]/10 text-xs font-black text-[#7B2D8E] sm:h-11 sm:w-auto sm:max-w-48 sm:gap-2 sm:rounded-xl sm:px-2.5 dark:border-gray-700 dark:text-purple-300"
            title={operatorName}
          >
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#7B2D8E]/10">
              {operatorAvatarUrl ? (
                <img
                  src={operatorAvatarUrl}
                  alt={operatorName}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <span>{getInitials(operatorName)}</span>
              )}
            </div>
            <span className="hidden truncate text-sm font-semibold text-[#2D2A26] sm:inline dark:text-gray-100">
              {operatorName}
            </span>
          </div>

          {showAdminExit && (
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#6B6258]/15 text-[#2D2A26] transition hover:bg-[#6B6258]/5 sm:h-11 sm:w-auto sm:gap-2 sm:px-3 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800"
              title="Voltar ao painel"
              aria-label="Voltar ao painel"
            >
              <ArrowLeft size={18} className="sm:hidden" aria-hidden="true" />
              <LayoutDashboard size={18} className="hidden sm:block" aria-hidden="true" />
              <span className="hidden text-sm font-semibold lg:inline">Painel</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#DC2626] transition hover:bg-[#DC2626]/10 sm:h-11 sm:w-11"
            title="Sair"
            aria-label="Sair"
          >
            <LogOut size={20} aria-hidden="true" />
          </button>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}
