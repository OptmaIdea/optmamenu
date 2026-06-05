# OptmaMenu - Raio X do Projeto

## 📋 Visão Geral

**OptmaMenu** é uma solução completa de cardápio digital e gestão de restaurantes, desenvolvida com React, TypeScript e Vite. O sistema oferece tanto uma interface pública para clientes quanto um painel administrativo completo para gestores de restaurantes.

### 🎯 Propósito Principal
- Digitalizar a experiência de restaurantes e bares
- Facilitar pedidos online e em mesa
- Automatizar processos comerciais e financeiros
- Oferecer uma solução all-in-one para gestão de estabelecimentos

---

## 🏗️ Arquitetura e Tecnologias

### Frontend
- **React 19.2.0** - Biblioteca principal UI
- **TypeScript** - Tipagem estática
- **Vite** - Build tool e development server
- **React Router DOM 7.13.0** - Routing
- **Tailwind CSS** - Estilização
- **Framer Motion** - Animações

### Bibliotecas Principais
- **Zustand** - Gerenciamento de estado
- **React Hook Form + Zod** - Formulários e validação
- **@dnd-kit** - Drag and drop
- **Lucide React** - Icones
- **Sonner** - Notificações
- **React to Print** - Impressão de recibos

### Backend e Banco de Dados
- **Supabase** - Backend as a Service
- **Autenticação JWT**
- **Banco de dados PostgreSQL**

### Desenvolvimento e Qualidade
- **ESLint** - Linting
- **Prettier** - Formatação
- **Vitest** - Testes unitários
- **TypeScript** - Verificação de tipos

---

## 📁 Estrutura do Projeto

```
optmamenu/
├── src/
│   ├── pages/                    # Páginas organizadas por funcionalidade
│   │   ├── initial/             # Páginas públicas (landing, auth, legal)
│   │   ├── private/             # Área administrativa
│   │   │   └── admin/           # Módulos do admin
│   │   └── store/               # Interface do cliente (cardápio)
│   ├── components/              # Componentes reutilizáveis
│   ├── lib/                     # Configurações e utilitários
│   ├── store/                   # Stores do Zustand
│   ├── types/                   # Definições de TypeScript
│   ├── hooks/                   # Custom hooks
│   ├── utils/                   # Funções utilitárias
│   └── services/               # Serviços da API
├── supabase/                   # Configuração do Supabase
├── scripts/                    # Scripts utilitários
├── public/                     # Assets públicos
└── docs/                       # Documentação
```

---

## 🚀 Funcionalidades Principais

### 1. Interface Pública (Para Clientes)
- **Cardápio Digital Interativo**
  - Visualização por categorias
  - Filtros e busca
  - Modal de detalhes de produtos
  - Fotos de produtos com otimização WebP

- **Pedidos Online**
  - Carrinho de compras
  - Checkout integrado
  - Múltiplos métodos de pagamento
  - Suporte a pedidos por mesa

- **PWA (Progressive Web App)**
  - Instalável em dispositivos móveis
  - Funcionamento offline
  - Notificações push

### 2. Painel Administrativo

#### 📊 Dashboard e Análises
- Dashboard principal com métricas
- Relatórios de vendas e atividade
- Sistema de alertas
- Análises de negócio

#### 🛍️ Gestão Comercial
- **Pedidos**
  - Gerenciamento de pedidos
  - Histórico de pedidos
  - Status tracking
- **Clientes**
  - Base de clientes
  - Programa de fidelidade
  - Histórico de compras
- **Canais de Venda**
  - Configuração de múltiplos canais
  - Integração com WhatsApp
- **Pagamentos**
  - Múltiplos métodos de pagamento
  - Contas a receber
  - Extrato financeiro

#### 📦 Gestão de Produtos e Estoque
- **Catálogo de Produtos**
  - Cadastro de produtos
  - Gestão de categorias
  - Controle de variações
- **Estoque**
  - Controle de estoque por local
  - Movimentações de entrada/saída
  - Transferências entre locais
  - Relatórios de inventário
- **Fornecedores**
  - Cadastro de fornecedores
  - Registro de compras
  - Cotações de compra

#### 📤 Marketing e CRM
- **Centro de Marketing**
  - Campanhas promocionais
  - Gestão de conteúdo
- **Mensagens**
  - Comunicação com clientes
  - Templates de mensagem
- **Relacionamento Cliente**
  - Histórico de interações
  - Ciclo de vida do cliente

#### ⚙️ Configurações
- **Configuração da Loja**
  - Horários de funcionamento
  - Configurações de entrega
  - Taxas e métodos de envio
- **Usuários e Permissões**
  - Gestão de usuários
  - Controle de acesso
- **Segurança**
  - Configurações de segurança
  - Histórico de acesso

#### 💰 Financeiro
- **Caixa**
  - Controle de caixa
  - Lançamentos financeiros
- **Relatórios Financeiros**
  - Fluxo de caixa
  - Lucratividade

---

## 🔄 Fluxo de Funcionamento

### Fluxo do Cliente
1. **Acesso ao Cardápio**
   - Clientes acessam via link direto (`/s/:storeSlug`)
   - Visualização do cardápio online
   - Navegação por categorias

2. **Seleção e Pedido**
   - Adiciona itens ao carrinho
   - Escolha de variações e observações
   - Visualização do total

3. **Finalização**
   - Checkout com múltiplos métodos
   - Confirmação do pedido
   - Notificação por WhatsApp/email

### Fluxo do Administrador
1. **Autenticação**
   - Login seguro com JWT
   - Redirecionamento para dashboard

2. **Gestão Diária**
   - Monitorar pedidos em tempo real
   - Gerenciar estoque
   - Acompanhar métricas

3. **Análises e Relatórios**
   - Acessar relatórios detalhados
   - Tomar decisões baseadas em dados

---

## 🛠️ Recursos Técnicos Destacados

### Performance
- **Code Splitting** - Carregamento otimizado
- **Imagens WebP** - Compressão avançada
- **Lazy Loading** - Componentes carregados sob demanda
- **PWA** - Funcionamento offline

### UX/UI
- **Design Responsivo** - Mobile-first
- **Dark Mode** - Suporte a tema escuro
- **Acessibilidade** - WCAG compliance
- **Micro-interações** - Animações suaves

### Segurança
- **Autenticação JWT** - Segurança no acesso
- **Input Validation** - Validação de dados
- **HTTPS** - Conexão segura
- **XSS Protection** - Prevenção de ataques

### Integrações
- **WhatsApp API** - Integração com WhatsApp
- **Pagamentos** - Múltiplos gateways
- **Impressão** - Recibos fiscais
- **Exportação** - Dados em múltiplos formatos

---

## 🎨 Design e Branding

- **Cores Principais**: Verde (#21A896) - Associado a natureza e frescor
- **Tipografia**: Plus Jakarta Sans - Moderna e legível
- **Interface**: Clean e intuitiva
- **Logo**: OptmaMenu - Identidade visual forte

---

## 📱 Dispositivos Suportados

- **Web** - Desktop e laptop
- **Mobile** - iOS e Android
- **Tablets** - iPad e Android tablets
- **PWA** - Instalável como app nativo

---

## 🚀 Deploy e Hospedagem

- **Frontend**: Vite build para produção
- **Backend**: Supabase (auto-hospedado ou cloud)
- **Imagens**: CDN para otimização
- **Domínio**: Customizável

---

## 📈 Próximos Desenvolvimentos

- [ ] Mobile App (iOS/Android nativo)
- [ ] Integração com marketplaces
- [ ] IA para recomendações
- [ ] Sistema de reservas
- [ ] Entrega por drone
- [ ] Pagamento cripto

---

## 📞 Suporte e Documentação

- **Documentação**: Interna no projeto
- **Suporte**: Via plataforma
- **Atualizações**: Contínuas
- **Feedback**: Sistema integrado

---

*Este documento foi gerado em 05/06/2026*