# OptmaMenu — Documentação

## Visão geral

O OptmaMenu é uma plataforma administrativa e operacional para gestão de catálogo, estoque, compras, transferências, fornecedores, fidelidade e operação comercial.

## Estado atual do projeto

- Backend multiestoque concluído
- Transferências internas concluídas
- Vida do produto concluída
- Consolidação operacional e UX da Fase 5 concluída
- Fase 8 Comercial concluída e documentada
- Fase 9 — Usuários, permissões, governança e segurança em fechamento avançado
- Fase 9.13 — Permissões, Segurança, Realtime e padrão `manage=false` concluída tecnicamente
- Documentação consolidada em andamento

## Documentos principais

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [ESTRUTURA.md](./ESTRUTURA.md)
- [FASE_5_CONSOLIDACAO_OPERACIONAL.md](./FASE_5_CONSOLIDACAO_OPERACIONAL.md)
- [FASE_6_5I_TIMELINE_OPERACIONAL.md](./FASE_6_5I_TIMELINE_OPERACIONAL.md)
- [FASE_7_FORNECEDOR_360.md](./FASE_7_FORNECEDOR_360.md)
- [FASE_8_COMERCIAL.md](./FASE_8_COMERCIAL.md)
- [FASE_9_USUARIOS_GOVERNANCA.md](./FASE_9_USUARIOS_GOVERNANCA.md)
- [FASE_9_13_PERMISSOES_SEGURANCA.md](./FASE_9_13_PERMISSOES_SEGURANCA.md)
- [GUIA_SISTEMA_PERMISSOES_REALTIME.md](./GUIA_SISTEMA_PERMISSOES_REALTIME.md)
- [PERMISSOES_USUARIOS.md](./PERMISSOES_USUARIOS.md)
- [APENDICE_REFINAMENTOS_FUTUROS.md](./APENDICE_REFINAMENTOS_FUTUROS.md)
- [MANUAL_USUARIO.md](./MANUAL_USUARIO.md)
- [GUIA_LOJA_PUBLICA_PEDIDOS.md](./GUIA_LOJA_PUBLICA_PEDIDOS.md)
- [GUIA_LIVRO_CAIXA.md](./GUIA_LIVRO_CAIXA.md)
- [GUIA_CLIENTES_FIDELIDADE.md](./GUIA_CLIENTES_FIDELIDADE.md)
- [GUIA_CENTRAL_MARKETING.md](./GUIA_CENTRAL_MARKETING.md)
- [ROADMAP_REFINAMENTOS_POS_FASE_8.md](./ROADMAP_REFINAMENTOS_POS_FASE_8.md)
- [MANUAL_FORNECEDORES.md](./MANUAL_FORNECEDORES.md)
- [GUIA_OPERACIONAL_ESTOQUE_MULTILOCAL.md](./GUIA_OPERACIONAL_ESTOQUE_MULTILOCAL.md)
- [DATA_DICTIONARY.md](./DATA_DICTIONARY.md)
- [RPCS_AND_VIEWS.md](./RPCS_AND_VIEWS.md)
- [RLS_AND_SECURITY.md](./RLS_AND_SECURITY.md)
- [OPERATIONS_PLAYBOOK.md](./OPERATIONS_PLAYBOOK.md)

## Módulos atuais

- Produtos
- Categorias
- Estoque por local
- Vida do produto
- Transferências
- Fornecedores
- Compras
- Movimentação
- Fidelidade
- Clientes
- Loja pública
- Pedidos comerciais
- Livro de Caixa
- Dashboard comercial
- Central de Marketing
- Usuários e colaboradores
- Permissões por papel
- Funções personalizadas
- Permissões por usuário
- Segurança e ações sensíveis
- Configurações da Loja
- Meus Dados
- Meu Histórico
- Solicitações cadastrais

## Leituras recomendadas por perfil

### Produto / dono

- FASE_9_13_PERMISSOES_SEGURANCA.md
- GUIA_OPERACIONAL_ESTOQUE_MULTILOCAL.md
- OPERATIONS_PLAYBOOK.md

### Dev frontend

- ARCHITECTURE.md
- ESTRUTURA.md
- GUIA_SISTEMA_PERMISSOES_REALTIME.md
- FASE_9_13_PERMISSOES_SEGURANCA.md

### Dev backend / Supabase

- DATA_DICTIONARY.md
- RPCS_AND_VIEWS.md
- RLS_AND_SECURITY.md
- ADVISORS.md
- GUIA_SISTEMA_PERMISSOES_REALTIME.md

### Operação / compras

- MANUAL_FORNECEDORES.md
- OPERATIONS_PLAYBOOK.md
- GUIA_OPERACIONAL_ESTOQUE_MULTILOCAL.md

### Dev frontend/backend

- FASE_7_FORNECEDOR_360.md
- FASE_9_USUARIOS_GOVERNANCA.md
- FASE_9_13_PERMISSOES_SEGURANCA.md
- RPCS_AND_VIEWS.md
- DATA_DICTIONARY.md

## Fechamento atual

A Fase 8 Comercial está documentada em `FASE_8_COMERCIAL.md` e nos guias operacionais complementares.

A Fase 9 está documentada em `FASE_9_USUARIOS_GOVERNANCA.md`, com foco em usuários, permissões, colaboradores, solicitações cadastrais, segurança e governança.

A frente `9.13` de permissões e segurança foi consolidada em `FASE_9_13_PERMISSOES_SEGURANCA.md`, com realtime, regras de `view/manage`, separação entre Configurações e Segurança e documentação de RPCs em `RPCS_AND_VIEWS.md`.

A próxima frente recomendada é `9.13.1G — Histórico pessoal e auditoria de alterações`, antes de abrir novas configurações funcionais como Pedido Online, Mensagens ou hardening completo dos Advisors.
