import OnlineOrderSettingsPage from '@/pages/private/admin/settings/onlineOrders/OnlineOrderSettingsPage';

/**
 * Compatibilidade temporária: StoreSettings ainda importa este arquivo como Config
 * para a aba `orders`. Enquanto a integração direta não é aplicada no arquivo
 * StoreSettings, este wrapper garante que Pedido Online renderize a tela correta.
 */
export default OnlineOrderSettingsPage;
