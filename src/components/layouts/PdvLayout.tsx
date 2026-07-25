import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, LayoutDashboard, LogOut, MapPin, MonitorSmartphone, Moon, ReceiptText, Store, Sun, UserRound, Wifi, WifiOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getActiveStoreId } from '@/utils/activeStore';
import { Customers360Service, type CustomerListItem } from '@/services/customers360Service';

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }> };
type PdvLayoutProps = { children: ReactNode; storeName?: string; operatorName?: string; operatorAvatarUrl?: string | null; locationName?: string; online: boolean; showAdminExit?: boolean; hideSalesHistory?: boolean };
type StoredPosCustomer = { id: string; name: string; phone?: string | null };

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'OP';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function PdvLayout({ children, storeName = 'OptmaMenu', operatorName = 'Operador', operatorAvatarUrl, locationName = 'Local não selecionado', online, showAdminExit = false, hideSalesHistory = false }: PdvLayoutProps) {
  const navigate = useNavigate();
  const storeId = getActiveStoreId();
  const customerStorageKey = storeId ? `optmamenu.pdv.customer.${storeId}` : null;
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(() => {
    if (!customerStorageKey) return '';
    try { return (JSON.parse(localStorage.getItem(customerStorageKey) || 'null') as StoredPosCustomer | null)?.id || ''; } catch { return ''; }
  });
  const [isDark, setIsDark] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme === 'dark' || (savedTheme !== 'light' && document.documentElement.classList.contains('dark'));
  });
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => { document.documentElement.classList.toggle('dark', isDark); localStorage.setItem('theme', isDark ? 'dark' : 'light'); }, [isDark]);
  useEffect(() => {
    if (!storeId) return;
    let active = true;
    void Customers360Service.listCustomers(storeId, 300).then((result) => {
      if (!active) return;
      setCustomers((result || []).filter((customer) => customer.status !== 'deleted_requested').sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'pt-BR', { sensitivity: 'base' })));
    }).catch(() => { if (active) setCustomers([]); });
    return () => { active = false; };
  }, [storeId]);
  useEffect(() => {
    const clearCustomer = () => setSelectedCustomerId('');
    window.addEventListener('optmamenu:pdv-customer-cleared', clearCustomer);
    return () => window.removeEventListener('optmamenu:pdv-customer-cleared', clearCustomer);
  }, []);
  useEffect(() => {
    const beforeInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event as BeforeInstallPromptEvent); };
    const installed = () => setInstallPrompt(null);
    window.addEventListener('beforeinstallprompt', beforeInstall); window.addEventListener('appinstalled', installed);
    return () => { window.removeEventListener('beforeinstallprompt', beforeInstall); window.removeEventListener('appinstalled', installed); };
  }, []);

  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomerId(customerId);
    if (!customerStorageKey) return;
    if (!customerId) return localStorage.removeItem(customerStorageKey);
    const customer = customers.find((item) => item.id === customerId);
    if (!customer) return;
    localStorage.setItem(customerStorageKey, JSON.stringify({ id: customer.id, name: customer.full_name || 'Cliente cadastrado', phone: customer.phone || null } satisfies StoredPosCustomer));
  };
  const handleInstall = async () => { if (!installPrompt) return; await installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null); };
  const handleLogout = async () => { await supabase.auth.signOut({ scope: 'local' }); navigate('/login', { replace: true }); };

  return <div className="min-h-screen bg-[#F8F6F2] text-[#2D2A26] transition-colors dark:bg-gray-950 dark:text-gray-100">
    <header className="sticky top-0 z-40 border-b border-[#6B6258]/10 bg-white/95 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/95">
      <div className="flex min-h-[68px] items-center gap-2 px-2.5 sm:gap-3 sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F26541] text-white shadow-sm sm:h-11 sm:w-11 sm:rounded-2xl"><MonitorSmartphone size={22} /></div>
          <div className="min-w-0"><div className="flex items-center gap-2"><h1 className="truncate text-base font-bold sm:text-lg">PDV</h1><span className="hidden rounded-full bg-[#21A896]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1A867A] sm:inline">Operação</span></div>
            <p className="flex min-w-0 items-center gap-1 text-[11px] text-[#6B6258] dark:text-gray-400 sm:text-xs"><Store size={12} /><span className="max-w-24 truncate sm:max-w-44">{storeName}</span><span>•</span><MapPin size={12} /><span className="max-w-24 truncate sm:max-w-44">{locationName}</span></p>
          </div>
        </div>
        <label className="hidden min-w-0 items-center gap-2 rounded-xl border border-[#6B6258]/15 bg-white px-2 lg:flex dark:border-gray-700 dark:bg-gray-950" title="Cliente da venda e fidelidade"><UserRound size={17} className="shrink-0 text-[#1A867A]" />
          <select value={selectedCustomerId} onChange={(event) => handleCustomerChange(event.target.value)} className="h-10 max-w-48 bg-transparent text-sm font-semibold outline-none xl:max-w-60"><option value="">Cliente de balcão</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.full_name || customer.phone || 'Cliente cadastrado'}</option>)}</select>
        </label>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-auto sm:w-auto sm:gap-1.5 sm:rounded-full sm:px-2.5 sm:py-1.5 ${online ? 'bg-[#21A896]/10 text-[#1A867A]' : 'bg-[#FBA93C]/15 text-[#8A5A00] dark:text-amber-300'}`} title={online ? 'Conectado' : 'Sem conexão'}>{online ? <Wifi size={17} /> : <WifiOff size={17} />}<span className="hidden text-xs font-semibold sm:inline">{online ? 'Online' : 'Offline'}</span></div>
        <button type="button" onClick={() => setIsDark((current) => !current)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#6B6258] transition hover:bg-[#6B6258]/10 dark:text-gray-300 dark:hover:bg-gray-800">{isDark ? <Sun size={19} /> : <Moon size={19} />}</button>
        {installPrompt && <button type="button" onClick={() => void handleInstall()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#1A867A] transition hover:bg-[#21A896]/10 sm:h-11 sm:w-auto sm:gap-2 sm:px-3"><Download size={18} /><span className="hidden text-sm font-semibold xl:inline">Instalar PDV</span></button>}
        {!hideSalesHistory && <button type="button" onClick={() => navigate('/admin/sales')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#7B2D8E] transition hover:bg-[#7B2D8E]/10 sm:h-11 sm:w-auto sm:gap-2 sm:px-3 dark:text-purple-300"><ReceiptText size={18} /><span className="hidden text-sm font-semibold xl:inline">Vendas</span></button>}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#6B6258]/15 bg-[#7B2D8E]/10 text-xs font-black text-[#7B2D8E] sm:h-11 sm:w-auto sm:max-w-48 sm:gap-2 sm:rounded-xl sm:px-2.5 dark:border-gray-700 dark:text-purple-300" title={operatorName}><div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#7B2D8E]/10">{operatorAvatarUrl ? <img src={operatorAvatarUrl} alt={operatorName} className="absolute inset-0 h-full w-full object-cover" /> : <span>{getInitials(operatorName)}</span>}</div><span className="hidden truncate text-sm font-semibold text-[#2D2A26] sm:inline dark:text-gray-100">{operatorName}</span></div>
        {showAdminExit && <button type="button" onClick={() => navigate('/admin')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#6B6258]/15 text-[#2D2A26] transition hover:bg-[#6B6258]/5 sm:h-11 sm:w-auto sm:gap-2 sm:px-3 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800"><ArrowLeft size={18} className="sm:hidden" /><LayoutDashboard size={18} className="hidden sm:block" /><span className="hidden text-sm font-semibold lg:inline">Painel</span></button>}
        <button type="button" onClick={() => void handleLogout()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#DC2626] transition hover:bg-[#DC2626]/10 sm:h-11 sm:w-11"><LogOut size={20} /></button>
      </div>
    </header>
    <main>{children}</main>
  </div>;
}
