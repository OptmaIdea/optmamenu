# Auditoria de navegação, permissões e contextos — 14/10/2026

## Baseline conferido
- GitHub `OptmaIdea/optmamenu`, branch `agent/homologacao-geral-20260820`.
- Vercel `homologacao.optmamenu.com.br` READY no commit `c417d9aac34cca440fb9333796a74576ec9c6438` antes desta alteração.
- Supabase `lgkkfmqzaorrutuoqeax`: catálogo `store_permission_catalog` confirmou as permissões `accounts_payable.view`, `purchases.view` e as permissões granulares das abas de Segurança.
- O usuário confirmou que a listagem de pedidos funciona com a sessão real de Carlos em vários navegadores/dispositivos.

## Matriz de lacunas e decisões
| Contexto | Evidência | Decisão |
| --- | --- | --- |
| Financeiro / Contas a pagar | `/admin/accounts-payable` já protegida por `accounts_payable.view` em `AppRoutes.tsx`, ausente do menu | **Criar link** para a página existente, no grupo Financeiro, com a mesma permissão |
| Produtos / Análise de compras | `/admin/stock/purchase-insights` existe e é acessível dentro de Compras, mas não no menu | **Criar link** com `purchases.view` |
| Produtos / Cotações em lote | `/admin/stock/quotations/batch` já acessível pela tela de Cotações | **Não duplicar no menu**: manter como ação do fluxo de Cotação |
| Segurança | Menu genérico “Senhas e Acesso” representa oito abas (papéis, permissões individuais, auditoria etc.) | Renomear para Central de segurança; **criar atalhos de contexto** para `roles`, `custom_roles`, `user_permissions` e `logs` usando `?tab=` e permissão de visualização específica |
| Configurações | `SETTINGS_TAB_VIEW_PERMISSIONS` consultava `messages.view` mas aba usa `settings.messages.view`, e incluía `settings.appearance.manage` sem exigir `settings.appearance.view` | Corrigir lista de visibilidade para espelhar a leitura autorizada |
| Histórico comercial | `/admin/sales` já no menu; `/admin/sales/:saleId` é detalhe | Não duplicar detalhes |
| Compras / condições de pagamento | Aba `terms` já existe em Contas a pagar | Manter como aba, sem novo menu |
| Multi-loja / unidades de negócio | Documentos de arquitetura descrevem evolução; falta comprovação de rota de administração de grupos pronta para uso | Não inventar menu de grupo ou franquias nesta rodada |

## Governança e testes
- Links de Segurança são ocultados quando `security.view` ou a permissão específica de aba for negada. Papéis personalizados (ex.: Carlos) não recebem permissões adicionais: permissões individuais e negativas continuam intactas.
- A rota `/admin/security` já exige `security.view`; as abas são verificadas na página por `security.<aba>.view`, inclusive ao abrir um link `?tab=...` diretamente.
- A navegação contextual identifica primeiro a query específica, evitando marcar “Central de segurança” simultaneamente a uma aba.
- Testes: `src/__tests__/adminNavigationContext.test.ts` cobre deep links, contexto genérico, aba ativa exclusiva, configurações e páginas sem query; build e CI devem ser confirmados no commit.

## Testes manuais após deploy
1. Owner: Financeiro > Contas a pagar; Produtos > Análise de compras; Segurança > Funções personalizadas/Permissões por usuário. Verificar URL, aba ativa e leitura.
2. Carlos: Financeiro > Contas a pagar, Produtos > Análise de compras; Segurança exibe só os atalhos autorizados. Negativas de `security.roles.view`, `security.custom_roles.view`, `security.user_permissions.view` não podem ser contornadas por menu ou link direto.
3. Usuário com `accounts_payable.view=false`: item ausente e acesso direto negado. Usuário com `purchases.view=false`: Análise de compras ausente e rota negada.
4. Usuário com `security.logs.view=true` e `security.custom_roles.view=false`: Histórico visível, Funções personalizadas oculto; URL direta para aba negada redireciona para a primeira aba autorizada.
5. Mobile/tablet: alternar seção de Segurança, verificar título e destaque único; confirmar que não há excesso de itens rolando sobre o cabeçalho.

## Risco anterior ainda pendente
A migration `20261014070000_orders_custom_role_visibility_authorization.sql` está versionada mas não consta como aplicada no Supabase, e as duas RPCs `get_admin_orders_safe`/`get_active_order_count` ainda não incluem o teste granular de autorização em banco. O usuário confirmou a correção visual, mas isso não resolve a falha de exposição anteriormente demonstrada para membro ativo sem `orders.view`. Aplicação da migration requer execução autorizada pelo Supabase e repetição dos testes negativos.

## Fora do escopo
Sem alterações a membros/papéis no banco, sem mudanças em Clientes, Fidelidade, OptmaPay ou criação especulativa de telas de Grupo/Matriz/Franquias.
