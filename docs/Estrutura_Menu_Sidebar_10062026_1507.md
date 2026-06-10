# Estrutura de Menus da Barra Lateral

**Data:** 10/06/2026  
**Hora:** 15:07  
**Arquivo:** `src/components/layouts/PrivateLayout.tsx` (linhas 218-316)

---

## dashboard (Dashboard)

| Ícone | Label | Permissão |
|-------|-------|-----------|
| LayoutDashboard | Painel operacional | `dashboard.view` |
| BarChart2 | Atividades recentes | `security.logs.view` |
| AlertCircle | Alertas | `dashboard.view` |
| FileStack | Relatórios | `reports.view` |

---

## commercial (Comercial)

| Ícone | Label | Permissão |
|-------|-------|-----------|
| ShoppingBag | Pedidos | `orders.view` |
| RadioTower | Canais de venda | `commercial.view` |
| WalletCards | Pagamentos | `settings.payment.view` |
| Truck | Entregas | `settings.delivery.view` |
| BarChart3 | Dashboard comercial | `commercial.view` |
| Settings | Configurações comerciais | `settings.commercial.view` |
| Users | Clientes | `customers.view` |
| Heart | Fidelidade | `loyalty.view` |
| Sparkles | Fidelidade avançada | `loyalty.view` |
| MessageSquare | Mensagens | `messages.view` |
| Megaphone | Promoções | `marketing.view` |

---

## financial (Financeiro)

| Ícone | Label | Permissão |
|-------|-------|-----------|
| WalletCards | Livro diário | `cashbook.view` |

---

## products (Produtos)

| Ícone | Label | Permissão |
|-------|-------|-----------|
| Package | Produtos | `products.view` |
| Layers | Categorias | `products.view` |
| FileText | Estoque por local | `stock.view` |
| Activity | Vida do produto | `products.view` |
| ArrowRightLeft | Transferências | `stock.transfer` |
| Truck | Fornecedores | `suppliers.view` |
| History | Compras | `purchases.view` |
| FileText | Cotação | `purchases.view` |
| History | Movimentação | `stock.view` |
| SlidersHorizontal | Configurações de Estoque | `settings.stock.view` |

---

## settings (Configurações)

| Ícone | Label | Permissão |
|-------|-------|-----------|
| UserCircle | Meus Dados | — |
| ScrollText | Meu Histórico | — |
| Building | Dados da Loja | `settings.store.view` |
| Smartphone | Pedido Online | `settings.orders.view` |
| Users | Usuários | `users.view` |
| Clock | Horários | `settings.store.view` |
| MessageCircle | Mensagens | `settings.system.view` |
| CreditCard | Pagamento | `settings.payment.view` |
| Shield | Senhas e Acesso | `security.view` |

---

## support (Suporte)

| Ícone | Label | Permissão |
|-------|-------|-----------|
| FileText | Termos Legais | — |
| HelpCircle | FAQ | — |
| BookOpen | Documentação | — |
