# Status do Projeto OptmaMenu

> **Última Atualização:** 17/09/2026  
> **Branch de homologação ativa:** `agent/homologacao-geral-20260820`  
> **Frontend:** React + TypeScript / Vercel  
> **Backend:** Supabase/Postgres (`lgkkfmqzaorrutuoqeax`)

---

## Estado executivo atual

O OptmaMenu está em homologação operacional das frentes de **Clientes 360º, área autenticada do cliente, pedidos públicos, checkout, estoque e financeiro**. A prioridade imediata é fechar o fluxo real cliente → pedido → operação → atualização do cliente, sem abrir novas frentes estruturais antes de estabilizar a experiência.

O baseline verificado em 17/09/2026 tinha como HEAD `b312caaada2bee01dfbab64628cdd5384e7fc01a` (`feat: preserva itens no histórico de pedidos do cliente`) e deployment Vercel `dpl_HAWw93pMHeroXESkBV7zaE38hBiu` em estado **READY**.

---

## Frente ativa — Clientes e pedidos

### Já disponível no código de homologação

- Vida do Cliente integrada ao histórico de pedidos.
- Deep link de pedido com `orderId`/`customerId`; a tela de Pedidos filtra o foco para o pedido aberto pela Vida do Cliente e apresenta ação explícita para voltar a todos os pedidos.
- Toasts amigáveis no painel de Pedidos para aceite, pronto, cancelamento, saída para entrega, conclusão e erros operacionais.
- Área autenticada do cliente com abas de dados, endereços, pedidos, fidelidade, redes sociais e privacidade.
- Adesão ao programa de fidelidade já disponível na aba **Fidelidade**, condicionada ao cadastro mínimo exigido; após adesão a área usa `LoyaltyPoints`.
- Histórico do cliente preserva `order_items`, permitindo visualizar os itens comprados anteriormente.
- Seleção e manutenção de endereços integradas ao checkout.

### Entrega desta rodada — 17/09/2026

- Histórico de pedidos do cliente passou a atualizar automaticamente a cada 12 segundos enquanto a área estiver visível, além de atualizar imediatamente ao retornar o foco para a janela/aba.
- Mudanças de status detectadas nessa atualização geram aviso amigável ao cliente.
- Foram acrescentados os estados visuais **Pronto** e **Saiu para entrega** à área do cliente.
- Foi incluído botão de atualização manual com feedback visual, mantendo o carregamento inicial separado da atualização silenciosa.
- A abordagem atual é **quase em tempo real por consulta segura**, sem abrir `orders` diretamente ao cliente pelo Supabase Realtime. A migração para push/Reatime deve preservar isolamento por cliente e RLS antes de substituir esse mecanismo.

---

## Pontos solicitados ainda em execução

1. Tornar o nome do cliente na listagem administrativa um atalho direto para a Vida do Cliente, mantendo o olhinho como ação alternativa.
2. Implementar **Comprar novamente** usando catálogo/estoque/preço atuais; o pedido anterior será apenas referência e a nova compra deverá ser recalculada pelo motor autoritativo atual.
3. Envio de e-mail ao marcar **Saiu para entrega**, com mensagem amigável e previsão/prazo estimado. Antes da implementação definitiva devem ser confirmados o provedor de e-mail e a fonte autoritativa do ETA, evitando mensagem duplicada ou prazo inventado.
4. Evoluir a área de fidelidade para suportar banners/campanhas próprios, separados dos banners gerais da loja.

---

## Critérios da próxima rodada

- Nenhum link de pedido vindo da Vida do Cliente deve exibir pedidos de outros clientes quando houver `orderId` em foco.
- Nome do cliente deve abrir a Vida do Cliente sem exigir rolagem horizontal até a coluna de ações.
- Alterações de status operacional devem aparecer na área do cliente sem recarregar manualmente a página.
- Recompra deve respeitar indisponibilidade, estoque online, regras atuais de preço e validação autoritativa no backend.
- Notificação de entrega não pode prometer prazo sem dado configurado/derivado de fonte confiável.

---

## Observação documental

Este arquivo substitui o snapshot antigo de 29/07/2026 como referência executiva de estado. A documentação temática continua distribuída nos documentos oficiais listados em `docs/README.md`; o repositório e o Supabase permanecem a autoridade para o estado técnico efetivamente implantado.
