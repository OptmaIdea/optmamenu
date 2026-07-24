import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CircleUserRound,
  LayoutDashboard,
  LogOut,
  MapPin,
  MonitorSmartphone,
  Store,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

type PdvLayoutProps = {
  children: ReactNode;
  storeName?: string;
  operatorName?: string;
  locationName?: string;
  online: boolean;
  showAdminExit?: boolean;
};

export default function PdvLayout({
  children,
  storeName = 'OptmaMenu',
  operatorName = 'Operador',
  locationName = 'Local não selecionado',
  online,
  showAdminExit = false,
}: PdvLayoutProps) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#F8F6F2] text-[#2D2A26] dark:bg-gray-950 dark:text-gray-100">
      <header className="sticky top-0 z-40 border-b border-[#6B6258]/10 bg-white/95 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/95">
        <div className="flex min-h-[68px] items-center gap-3 px-3 sm:px-5">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F26541] text-white shadow-sm">
              <MonitorSmartphone size={23} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-lg font-bold">PDV</h1>
                <span className="hidden rounded-full bg-[#21A896]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1A867A] sm:inline">
                  Operação
                </span>
              </div>
              <p className="flex min-w-0 items-center gap-1 text-xs text-[#6B6258] dark:text-gray-400">
                <Store size={13} className="shrink-0" aria-hidden="true" />
                <span className="truncate">{storeName}</span>
                <span aria-hidden="true">•</span>
                <MapPin size={13} className="shrink-0" aria-hidden="true" />
                <span className="truncate">{locationName}</span>
              </p>
            </div>
          </div>

          <div
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold ${
              online
                ? 'bg-[#21A896]/10 text-[#1A867A]'
                : 'bg-[#FBA93C]/15 text-[#8A5A00]'
            }`}
            title={online ? 'Conectado' : 'Sem conexão'}
          >
            {online ? <Wifi size={15} /> : <WifiOff size={15} />}
            <span className="hidden sm:inline">{online ? 'Online' : 'Offline'}</span>
          </div>

          <div className="hidden items-center gap-2 rounded-xl border border-[#6B6258]/10 px-3 py-2 md:flex dark:border-gray-700">
            <CircleUserRound size={18} className="text-[#7B2D8E]" aria-hidden="true" />
            <span className="max-w-36 truncate text-sm font-semibold">{operatorName}</span>
          </div>

          {showAdminExit && (
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="hidden min-h-11 items-center gap-2 rounded-xl border border-[#6B6258]/15 px-3 text-sm font-semibold transition hover:bg-[#6B6258]/5 lg:flex dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <LayoutDashboard size={18} aria-hidden="true" />
              Painel
            </button>
          )}

          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-[#DC2626] transition hover:bg-[#DC2626]/10"
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
