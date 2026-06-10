export type PermissionGroup = {
  id: string;
  label: string;
  description?: string;
  keywords?: string[];
  permissions: {
    view?: string;
    manage?: string;
    extra?: string[];
  };
};

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'settings-root',
    label: 'Configurações',
    description: 'Acesso geral a todas as abas de configurações.',
    keywords: ['configurações', 'tudo', 'acesso geral'],
    permissions: {
      view: 'settings.view',
      manage: 'settings.manage',
    },
  },
  {
    id: 'security-root',
    label: 'Senhas e Acesso',
    description: 'Acesso geral a todas as abas de segurança.',
    keywords: ['segurança', 'senhas', 'acesso', 'tudo'],
    permissions: {
      view: 'security.view',
      manage: 'security.manage',
    },
  },
  {
    id: 'settings-store',
    label: 'Dados da Loja',
    description: 'Dados cadastrais, endereço, contatos e identidade visual da loja.',
    keywords: ['loja', 'dados', 'configurações', 'cadastro', 'endereço', 'contato'],
    permissions: {
      view: 'settings.store.view',
      manage: 'settings.store.manage',
    },
  },
  {
    id: 'settings-orders',
    label: 'Pedido Online',
    description: 'Loja pública, pedido mínimo, canais e regras de pedidos.',
    keywords: ['pedido', 'online', 'loja pública', 'mínimo', 'whatsapp'],
    permissions: {
      view: 'settings.orders.view',
      manage: 'settings.orders.manage',
    },
  },
  {
    id: 'settings-stock',
    label: 'Estoque',
    description: 'Estoque global, mínimos, máximos e regras operacionais.',
    keywords: ['estoque', 'mínimo', 'máximo', 'produto'],
    permissions: {
      view: 'settings.stock.view',
      manage: 'settings.stock.manage',
    },
  },
  {
    id: 'settings-delivery',
    label: 'Entrega',
    description: 'Formas de entrega, taxas e regras de entrega.',
    keywords: ['entrega', 'delivery', 'taxa', 'frete'],
    permissions: {
      view: 'settings.delivery.view',
      manage: 'settings.delivery.manage',
    },
  },
  {
    id: 'settings-payment',
    label: 'Pagamento',
    description: 'Formas e regras de pagamento.',
    keywords: ['pagamento', 'pix', 'dinheiro', 'cartão'],
    permissions: {
      view: 'settings.payment.view',
      manage: 'settings.payment.manage',
    },
  },
  {
    id: 'settings-legal',
    label: 'Documentos e Termos',
    description: 'Termos de uso, política de privacidade, cookies e DPO.',
    keywords: ['documentos', 'termos', 'legal', 'privacidade', 'lgpd'],
    permissions: {
      view: 'settings.legal.view',
      manage: 'settings.legal.manage',
    },
  },
  {
    id: 'settings-system',
    label: 'Sistema',
    description: 'Preferências técnicas e configurações avançadas.',
    keywords: ['sistema', 'técnico', 'avançado'],
    permissions: {
      view: 'settings.system.view',
      manage: 'settings.system.manage',
    },
  },

  {
    id: 'security-logs',
    label: 'Histórico de atividades',
    description: 'Logs gerais de segurança e auditoria da loja.',
    keywords: ['logs', 'histórico', 'auditoria', 'atividades'],
    permissions: {
      view: 'security.logs.view',
      manage: 'security.logs.manage',
    },
  },
  {
    id: 'security-roles',
    label: 'Permissões por papel',
    description: 'Permissões padrão de gerente, caixa, vendas e outros papéis.',
    keywords: ['papel', 'função', 'cargo', 'perfil'],
    permissions: {
      view: 'security.roles.view',
      manage: 'security.roles.manage',
    },
  },
  {
    id: 'security-user-permissions',
    label: 'Permissões por usuário',
    description: 'Exceções individuais para membros específicos.',
    keywords: ['usuário', 'membro', 'individual', 'exceção'],
    permissions: {
      view: 'security.user_permissions.view',
      manage: 'security.user_permissions.manage',
    },
  },
  {
    id: 'security-sessions',
    label: 'Sessões e inatividade',
    description: 'Tempo ocioso, encerramento automático e sessões.',
    keywords: ['sessão', 'inatividade', 'tempo', 'logout'],
    permissions: {
      view: 'security.sessions.view',
      manage: 'security.sessions.manage',
    },
  },
  {
    id: 'security-pin-token',
    label: 'PIN e Token',
    description: 'PIN, tokens e limites de tentativa.',
    keywords: ['pin', 'token', 'senha', 'tentativa'],
    permissions: {
      view: 'security.pin_token.view',
      manage: 'security.pin_token.manage',
    },
  },
];
