# Status do Projeto OptmaMenu

> **Última Atualização:** 17/09/2026  
> **Branch de homologação ativa:** `agent/homologacao-geral-20260820`  
> **Frontend:** React + TypeScript / Vercel  
> **Backend:** Supabase/Postgres (`lgkkfmqzaorrutuoqeax`)

---

## Estado executivo atual

O OptmaMenu está em homologação operacional das frentes de **Clientes 360º, área autenticada do cliente, pedidos públicos, checkout, estoque e financeiro**. A prioridade imediata é fechar o fluxo real cliente → pedido → operação → atualização do cliente, sem abrir novas frentes estruturais antes de estabilizar a experiência.

O baseline confirmado no início da rodada de 17/09/2026 era o commit `cc9ce689490f7d6eaf6123395e96a27d8eec1483`, com deployment Vercel `dpl_8JVqFcTtHtZroq56eqc8hEQ92eWt` em estado **READY**. No Supabase, a base tinha 173 migrations aplicadas e a última versão registrada era `20260916180940`.

---

## Frente ativa — Clientes e pedidos

### Fluxos já validados manualmente

- Vida do Cliente integrada ao histórico de pedidos.
- Deep link de pedido com `orderId`/`customerId`; ao abrir um pedido pela Vida do Cliente, a tela de Pedidos filtra o foco para o pedido clicado, sem misturar pedidos de outros clientes.
- O nome do cliente na listagem administrativa abre diretamente a Vida do Cliente; o ícone de visualização permanece como alternativa.
- Seleção e manutenção de endereços integradas ao checkout.
- Pedidos realizados por cliente autenticado aparecem em sua própria área.
- Status alterados no administrativo são refletidos na área do cliente quando ela é recarregada/reaberta.

### Correção da conta real do cliente — 17/09/2026

A área efetivamente utilizada pelo cliente é `src/pages/store/components/CustomerAccountPortal.tsx`. O polling anterior havia sido aplicado ao componente legado `OrderHistory`, por isso o cliente não via o botão de atualização e o status não mudava automaticamente enquanto permanecia na aba **Pedidos**.

A correção foi aplicada diretamente ao `CustomerAccountPortal`:

- aba **Pedidos** com atualização automática a cada 12 segundos enquanto estiver aberta;
- atualização imediata ao recuperar foco ou visibilidade da janela;
- botão explícito **Atualizar agora**;
- horário da última sincronização;
- toast amigável quando um pedido muda de status;
- mensagens específicas para confirmado, pronto, saiu para entrega, concluído e cancelado;
- proteção contra requisições concorrentes durante a sincronização.

A estratégia continua sendo **quase em tempo real por consulta segura**. Não foi aberta assinatura indiscriminada de `orders` por Supabase Realtime; uma futura migração para push deve preservar isolamento por cliente e RLS.

---

## Fidelidade na área do cliente

Foi confirmado diretamente no Supabase que os clientes de teste **Xumbrega** e **Juan Caballero** estavam com `loyalty_opt_in=false` e `loyalty_points=0`. Portanto, a ausência de adesão era um defeito de interface do portal, e não participação já ativa.

A aba anteriormente chamada **Pontos e cartões** foi reformulada para **Fidelidade** e agora inclui:

- indicação clara de participação ativa ou adesão disponível;
- botão **Quero participar** para adesão voluntária;
- saída do programa pelo mesmo fluxo;
- persistência auditável via RPC segura `set_customer_self_consent_safe`;
- atualização da sessão do cliente após aderir ou sair;
- toast de confirmação/erro;
- saldo de pontos e nível;
- explicação de funcionamento do programa;
- área visual própria de **Benefícios e novidades do clube**, separada dos banners gerais do cardápio.

A gestão administrativa configurável de banners exclusivos de fidelidade ainda é uma evolução futura. A entrega atual cria a separação funcional e visual sem inventar campanhas ou promoções inexistentes.

---

## Pontos ainda pendentes desta frente

1. Implementar **Comprar novamente** usando catálogo, estoque e preços atuais. O pedido anterior será apenas referência; a nova compra deverá ser recalculada pelo motor autoritativo vigente.
2. Envio de e-mail ao marcar **Saiu para entrega**, com mensagem amigável, previsão de disponibilidade e prazo estimado. Antes da implementação definitiva devem ser confirmados o provedor de e-mail e a fonte autoritativa do ETA, evitando prazo inventado ou mensagem duplicada.
3. Evoluir a área de fidelidade para banners/campanhas próprios configuráveis pelo lojista.
4. Avaliar push/realtime específico para o cliente final, com segurança equivalente ou superior à consulta atual e isolamento estrito por identidade.

---

## Critérios de homologação imediata

- Com a aba **Pedidos** aberta na conta do cliente, uma mudança de status no admin deve aparecer sem sair e entrar novamente, em até aproximadamente 12 segundos.
- O botão **Atualizar agora** deve estar visível no topo da aba Pedidos e atualizar a lista imediatamente.
- Ao detectar alteração de status, o cliente deve receber toast amigável.
- Na aba **Fidelidade**, um cliente com `loyalty_opt_in=false` deve ver claramente a opção **Quero participar**.
- Após aderir, a sessão deve refletir participação ativa e as próximas compras elegíveis poderão seguir as regras vigentes de pontuação.
- Recompra futura deverá respeitar indisponibilidade, estoque online, regras atuais de preço e validação autoritativa no backend.
- Notificação de entrega não poderá prometer prazo sem dado configurado ou derivado de fonte confiável.

---

## Observação documental

Este arquivo substitui snapshots antigos como referência executiva de estado. A documentação temática continua distribuída nos documentos oficiais listados em `docs/README.md`; o repositório, os deployments Vercel e o Supabase permanecem as autoridades para o estado técnico efetivamente implantado.
