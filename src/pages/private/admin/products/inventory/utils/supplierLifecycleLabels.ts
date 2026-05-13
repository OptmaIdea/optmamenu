export const supplierHomologationLabelMap: Record<string, string> = {
    not_evaluated: 'Não avaliado',
    approved: 'Aprovado',
    pending: 'Pendente',
    rejected: 'Rejeitado',
    blocked: 'Bloqueado',
};

export const supplierPurchaseStatusLabelMap: Record<string, string> = {
    draft: 'Rascunho',
    confirmed: 'Confirmado',
    cancelled: 'Cancelado',
};

export const supplierDepartmentLabelMap: Record<string, string> = {
    commercial: 'Comercial',
    financial: 'Financeiro',
    fiscal: 'Fiscal',
    logistics: 'Logística',
    support: 'Suporte',
    other: 'Outro',
};

export const supplierEventTypeLabelMap: Record<string, string> = {
    note: 'Observação',
    call: 'Ligação',
    email: 'E-mail',
    meeting: 'Reunião',
    negotiation: 'Negociação',
    incident: 'Incidente',
    complaint: 'Reclamação',
    follow_up: 'Follow-up',
    homologation: 'Homologação',
    block: 'Bloqueio',
    unblock: 'Desbloqueio',
    document: 'Documento',
    other: 'Outro',
};

export const supplierSeverityLabelMap: Record<string, string> = {
    info: 'Informativo',
    low: 'Baixo',
    medium: 'Médio',
    high: 'Alto',
    critical: 'Crítico',
};

export const supplierRelationshipStatusLabelMap: Record<string, string> = {
    open: 'Aberto',
    done: 'Concluído',
    archived: 'Arquivado',
    cancelled: 'Cancelado',
};