# OptmaMenu — Correções pré-testes finais / acompanhamento RC

**Data-base:** 15/10/2026  
**Objetivo:** estabilizar homologação e só então declarar Release Candidate.  
**Branch:** `agent/homologacao-geral-20260820`  
**Supabase:** `lgkkfmqzaorrutuoqeax`  
**Homologação:** https://homologacao.optmamenu.com.br  
**Loja piloto:** https://homologacao.optmamenu.com.br/loja/gelinharessjn

> **Estado geral: AINDA NÃO É RELEASE CANDIDATE.** Persistem investigações P0 de carrinho e pagamentos, além do fluxo transacional de cancelamento após despacho. Nenhuma mudança nesta rodada deve presumir validação operacional sem reteste manual.

## Critérios de prioridade

- **P0:** segurança, integridade de pagamento/estoque, perdas de carrinho/pedido, dados incorretos ou acesso indevido.
- **P1:** operação interrompida, informação enganosa ou fluxo operacional excessivamente difícil.
- **P2:** UX de alto impacto.
- **P3:** refinamento estético.

**Fora de escopo:** PDV multi-vendedor, atacado completo, aluguel/festas, motoqueiros completo, arquitetura multiunidade e outros módulos novos.

## Corrigido no código e publicado (aguardando aceite manual)

| Pacote | Prioridade | Correção | Commit | Automação |
| --- | --- | --- | --- | --- |
| C1 | P1 | Confirmar envio de transferência pelo diálogo amigável do sistema; movimento de estoque preservado | `fc9f12016bbe1427a61b8b371037d0a3ac8f84e1` | [Verify sucesso](https://github.com/OptmaIdea/optmamenu/actions/runs/38758725837) |
| D1 | P1 | Acesso permanente ao carrinho no desktop, com valor e quantidade; testes de presença/estado vazio | `265b167d7ae967d1ce027d41a1f8e8d985830c8e` | [Verify sucesso](https://github.com/OptmaIdea/optmamenu/actions/runs/38759610831) |
| A1 | P1 | Acesso a Pedidos em rota, filtro `out_for_delivery`, horário e tempo em rota, endereço no card; testes de duração | `f8476c2597f882da4168cab09055c2b64cfa5afb` | [Verify sucesso](https://github.com/OptmaIdea/optmamenu/actions/runs/38760273632) |

Todos os três commits receberam Vercel `READY` no domínio de homologação, verificado na data-base.

## Roteiro de reteste — pacotes aplicados

### C1 — Transferência enviada
- [ ] Abrir transferência **em rascunho** em `/admin/transfers`.
- [ ] Clicar **Enviar**: aparece modal próprio do OptmaMenu (não `window.confirm`).
- [ ] Cancelar no modal: nenhuma baixa de estoque/status.
- [ ] Confirmar com remessa física simulada: status Enviada, origem debitada, destino ainda sem recebimento.
- [ ] Abrir timeline, conferir registro e valor antes/depois; testar estoque insuficiente e permissão negada.

### D1 — Carrinho desktop (visibilidade apenas)
- [ ] Abrir `/loja/gelinharessjn` em desktop, verificar botão visível sem abrir Menu.
- [ ] Vazio: link e indicação **Carrinho vazio**.
- [ ] Com 1 e 3 itens: quantidade, total e navegação para `/checkout?store=gelinharessjn`.
- [ ] Validar mobile sem interferência com rodapé.

### A1 — Pedidos em rota
- [ ] Criar pedido de **entrega** e avançar para **Saiu para entrega**.
- [ ] Abrir `/admin/orders` e acionar **Pedidos em rota**: somente `out_for_delivery`.
- [ ] Conferir código do pedido, cliente, endereço, horário e duração progressiva.
- [ ] Conferir atualização via Realtime e retorno ao filtro de pedidos atuais.
- [ ] Confirmar que transferências de estoque não aparecem como pedidos em rota.

## Bloqueadores P0: NÃO declarar RC antes da solução

| Item | Estado | Próxima prova exigida |
| --- | --- | --- |
| D2 — Carrinho esvazia no desktop após eventos de sessão | **Investigação / reteste pendente** | Reproduzir em anônimo/autenticado: refresh, login após montagem, logout, múltiplas abas e troca mobile-desktop; inspecionar Zustand `optma-cart`, sincronização de rascunho e concorrência |
| A4 — Comprovante de cartão rotulado como PIX | **Relato não reproduzido nos registros consultados** | Associar exemplo de pedido/comprovante à origem da representação; comparar `orders.payment_method_code`, `cashbook_entries.payment_method_code`, meio efetivamente capturado e renderização |
| A3 — Pedido que saiu para entrega retorna e precisa cancelar | **Fluxo de reversão transacional NÃO implementado nesta rodada** | Levantar estoque já baixado e reserva, financeiro/recebíveis, pagamento antecipado, OptmaPay/Pix/cartão, estorno real, diário, fidelidade; definir RPC atômica, idempotente e com auditoria e estados intermediários seguros |

### Observações de verificação P0

- Consultas somente de leitura ao Supabase mostraram pedidos de cartão com `payment_method_code` de cartão e lançamentos correspondentes no Livro Diário, inclusive OptmaPay. Isso **não exclui** erro em outro comprovante ou em outro percurso de apresentação.
- O backend `admin_cancel_public_order_safe` encaminha à função interna de cancelamento/reservas; não assumir que ela trate cancelamento **após saída** ou estornos financeiros externos. Não expor botão de cancelamento em rota antes de fluxo comprovadamente transacional.
- Nenhum teste real cobrou cartão/Pix ou movimentou valores financeiros nesta rodada.

## P1/P2 pendentes — escopo controlado

| Item | Situação |
| --- | --- |
| A2 — Datas e horas de cada status no link `/p/<token>` | Pendente: precisar de trilha por transição confiável; página atual mostra apenas status atual |
| B1 — UUID de cliente no Livro Diário | Relato **não reproduzido** na janela consultada; rastrear montagem da descrição e resolver na fonte quando evidenciado |
| C2 — Produtos em trânsito com origem/destino | Pendente |
| C3/C4 — Saldos físico, reservado, online e transferências claramente separados no produto/`/inventory` | Pendente |
| D3 — Avaliações de compras anteriores e edição da avaliação | Pendente, sem comentários públicos |
| D4 — Ampliar foto de produto, mobile-first | Pendente |
| D5 — Busca por metadados existentes (alergênicos, descrição, características, tags) | Pendente; não inferir atributo não cadastrado |
| E1/E2 — Vida do Cliente: itens consumidos e timeline amigável | Pendente |
| E3 — Vida do Produto: vendas por canal, quantidades/período e receita sustentada | Pendente |
| E4 — Dashboard com sugestões de compra justificadas pelos dados disponíveis | Pendente |

## Mitigação P0 adicional — cancelamento não é estorno

- **Causa confirmada:** `admin_cancel_public_order_safe_internal_0d` cancela reserva e pedido, mas não realiza estorno financeiro nem devolução do estoque já baixado no despacho. A interface anterior oferecia indevidamente **Cancelar com estorno** para pedido pago.
- **Mitigação aplicada:** `admin_cancel_public_order_safe` bloqueia, inclusive no servidor, status `out_for_delivery` e pagamentos diferentes de `pending`/`failed`; mantém permissão existente, idempotência de pedido já cancelado, `FOR UPDATE` e cancelamento simples não pago pré-despacho.
- Migration Supabase aplicada: `20261015123159_rc_block_unsafe_paid_and_dispatched_order_cancellation`; espelho no GitHub em `supabase/migrations/20261015123159_rc_block_unsafe_paid_and_dispatched_order_cancellation.sql`.
- Frontend informa que é preciso estorno seguro e não promete estorno automático.
- **LIMITAÇÃO EXPRESSA:** a operação completa de devolução + cancelamento + reembolso atômico NÃO foi implementada. O bloqueio previne inconsistência adicional enquanto a solução definitiva é construída e validada.
- [ ] Retestar negação da RPC para pedido pago e em rota; verificar que pedido, estoque e financeiro não sofrem alteração.
- [ ] Retestar cancelamento pré-despacho não pago com reserva ativa e bloqueio para perfil sem `orders.cancel`.

## Critérios de aceite para Release Candidate

- [ ] Todos os fluxos P0 corrigidos, com reteste real em desktop, tablet e celular.
- [ ] RLS, permissões, escopo de loja e auditoria preservados; nenhuma regressão de acesso.
- [ ] Pagamento dinheiro/PIX/cartões/OptmaPay e pagamento na entrega/retirada coerentes entre pedido, comprovante e financeiro.
- [ ] Estoque antes/depois e reserva corretos; nenhum cancelamento por troca simples de status após despacho.
- [ ] CI `Verify` aprovado e Vercel `READY` vinculado ao commit RC.
- [ ] Nenhuma migration pendente entre git e Supabase; registrar decisões de dados e rollback.
- [ ] Roteiro manual executado e resultado documentado como **corrigido**, **aguardando reteste**, **não reproduzido** ou **adiado conscientemente**.
- [ ] Bloqueadores que permanecerem abertos impedem promoção a RC.

## Regra de execução

Um pacote por vez: reprodução, causa-raiz, alteração mínima, teste automatizado, migration **apenas se necessária e autorizada**, Verify, Vercel READY, reteste manual e documentação. Não juntar correções financeiras de alto risco com simples melhorias de UI.
