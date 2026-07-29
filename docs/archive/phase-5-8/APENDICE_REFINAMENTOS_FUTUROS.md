# Apêndice — Refinamentos e frentes futuras

Este documento reúne itens solicitados durante as fases de evolução do OptmaMenu para implementação posterior.  
A intenção é evitar perda de contexto sem misturar esses pontos com entregas imediatas.

---

## Usuários, colaboradores e RH leve

- Criar relatório completo de idas e vindas do colaborador:
  - entrada/admissão;
  - saída/desligamento;
  - reentrada;
  - suspensão;
  - reativação;
  - motivos.
- Evoluir futuramente para controle mais completo de funcionário:
  - contratos;
  - documentos;
  - anexos;
  - ocorrências formais;
  - histórico trabalhista.
- Criar fluxo formal de solicitação de alteração por terceiros.
- Definir política de exclusão de usuário:
  - excluir apenas convite errado, cadastro duplicado ou vínculo sem histórico relevante;
  - preferir desligamento/inativação para preservar histórico.
- Melhorar identificação do usuário logado:
  - avatar;
  - apelido;
  - cargo/função;
  - loja ativa;
  - última sessão.
- Registrar login/logout em histórico/auditoria.

---

## Comunicação com colaboradores

- Criar sistema de consentimento para recebimento de mensagens:
  - WhatsApp;
  - e-mail;
  - push;
  - caixa interna.
- Criar caixa interna de mensagens.
- Criar sistema de push notifications.
- Separar mensagens operacionais de marketing.
- Registrar no manual:
  - Central de Marketing atual abre WhatsApp manualmente;
  - status “enviado” é confirmação manual;
  - status “entregue/lido” só com API oficial ou marcação manual.

---

## Configurações da loja e do sistema

- Criar área robusta de configurações da loja.
- Configurar pedido mínimo:
  - entrega com mínimo;
  - retirada sem mínimo;
  - tudo configurável.
- Configurar estoque global mínimo/máximo.
- Distribuir limites de estoque por unidades/locais.
- Criar configurações avançadas de segurança:
  - senha master;
  - aprovações por módulo;
  - ações sensíveis;
  - permissões finas.
- Configurar visibilidade e alteração de dados sensíveis.

---

## Loja pública, pedidos e canais

- Criar geração/impressão de QR Code por mesa/comanda.
- Estender canais além do WhatsApp:
  - Instagram;
  - Facebook;
  - presencial;
  - canais alternativos.
- Permitir que pedido de mesa/QR finalize por canal alternativo ao WhatsApp.
- Melhorar regras de entrega:
  - taxa por km;
  - meios de transporte;
  - áreas atendidas;
  - regras avançadas.
- Criar vendas diretas por múltiplos canais:
  - outras lojas;
  - outras pessoas;
  - pedidos presenciais.

---

## Clientes, fidelidade e marketing

- Criar Vida do Cliente / Cliente 360º.
- Separar clientes:
  - cadastrados pela loja pública/WhatsApp;
  - cadastrados diretamente pela administração.
- Criar benefícios/descontos por:
  - cliente;
  - categoria;
  - nível de pontos.
- Criar fidelidade avançada:
  - bônus de adesão;
  - bônus por atingir nível;
  - expiração de pontos;
  - multiplicadores por produto/categoria;
  - selos;
  - prêmios/resgates;
  - termos legais.
- Criar segmentos, promoções e comunicações dirigidas.

---

## Documentos legais

- Termos de uso.
- Política de privacidade.
- Consentimento de marketing.
- Consentimento para WhatsApp/e-mail.
- Termos do programa de fidelidade.
- Registro de aceite e versão do termo.

---

## Superadmin e multilojas

- Criar painel superadmin.
- Gerenciar múltiplas lojas.
- Melhorar seletor de loja ativa.
- Garantir exclusividade de slug.
- Permitir usuário proprietário de várias empresas usando dados reaproveitados de `profiles`.
- Trabalhar futuramente os e-mails enviados pelo Auth Supabase.

---

## Offline/localStorage

- Criar estratégia para conexão ruim.
- Cache de loja ativa.
- Cache de catálogo/configurações.
- Aviso de dados desatualizados.
- Evitar ações críticas offline sem confirmação.
- Pensar em sincronização futura.

---

## Relatórios, PDF e BI

- Exportação PDF em áreas como:
  - fornecedores;
  - compras;
  - cotações;
  - transferências;
  - manuais operacionais.
- Relatórios gerenciais em PDF.
- BI futuro.
- Evitar dependência de aplicativos externos quando possível.

---

## Infraestrutura futura

- Módulo próprio de OTP integrado à solução existente.
- Módulo fiscal.
- Migração futura para SQL próprio/servidor pequeno e barato.
- Avaliar Telegram Bot depois que o app estiver rodando.
- Criar automação de atendimento WhatsApp, possivelmente via n8n.

---

## Hardening pré-publicação

Antes de testes reais/publicação:

- revisar WARNs restantes dos Advisors;
- revisar RPCs por módulo;
- revisar RLS;
- revisar permissões de storage;
- revisar funções `SECURITY DEFINER`;
- revisar exposição `anon`;
- validar fluxos com usuários reais simulados;
- criar checklist de segurança por módulo.
