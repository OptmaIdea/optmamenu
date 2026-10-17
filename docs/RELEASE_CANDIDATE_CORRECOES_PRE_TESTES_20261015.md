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


## Atualização complementar — 15/10/2026 (retorno sobre transferências, inventory e checkout)

**Homologação da rodada:** base `1cf30c93660b5fb3fbbaeebe37e783595695599c`. Foram feitas alterações isoladas na mesma branch, sem criar módulos comerciais novos.

### Entregas com código

| Item | Commit | Estado automático |
| --- | --- | --- |
| Carrinho desktop no cabeçalho, sem CTA flutuante inferior | `e664c96373d1` | Verify SUCCESS, Vercel READY |
| Diálogo amigável global de aviso/motivo | `df3296d8fca8` | Verify SUCCESS, Vercel READY |
| Transferências: solicitar motivo, confirmar envio e recebimento/divergência, avisos em modal | `2b0c68e7d4a0` | Verify SUCCESS, Vercel READY |
| Criação de rascunhos em transferência: diálogos claros | `fefb09e73a10` | Verify SUCCESS, Vercel READY |
| `/inventory`: filtros compactos recolhíveis, agrupamento por produto/local, saldo x trânsito explicados | `7a929366a1ab` | Verify SUCCESS, Vercel READY |
| Divergências de transferência consultáveis também pela central, sem duplicar tratamento | `9818626250d7` | Verify SUCCESS, Vercel READY |
| `/inventory`: cards expansíveis para celular/tablet estreito | `930ac6fab9f3` | Verify SUCCESS, Vercel READY |
| Checkout: pagamento antecipado SIMULADO no Sandbox para retirada e entrega | `54dc7d95886e` | Vercel READY; conferir Verify e teste manual |

**Migration aplicada e espelhada:** `20261015170639_rc_public_checkout_sandbox_payment_visibility.sql` marca `sandbox_only` estritamente quando o método é integração `optma_sandbox` API. Em homologação Gelinhares: PIX/débito/crédito Sandbox visíveis; PIX manual excluído. O gateway verifica `environment=sandbox` e `realMoney=false`; **não realizar pagamento real**.

### Divergência real reproduzida

`TRF-20261015-144225-589`: Abacate, Estoque Principal → Loja SJN; 30 enviados, 27 recebidos, 3 divergentes, resolução `loss` (Perda/Avaria), motivo `quebra`, 3 perdas, 0 retornos. Status `divergent`. Não constava na central porque a tela só listava vendas e compras. Agora a TRF aparece em seção própria de leitura, com navegação ao documento; não há segundo ajuste de estoque.

### Retestes prioritários

- [ ] Em desktop com usuário autenticado, carrinho no cabeçalho **entre sino e saudação**, sem botão flutuante; visitante ao lado de Entrar; somente badge com quantidade quando não vazio.
- [ ] Carrinho permanece entre refresh, login, logout, múltiplas abas e viewport; o problema de persistência anterior ainda NÃO foi comprovadamente sanado.
- [ ] Criar rascunho, cancelar rascunho com motivo, enviar, receber normal, receber divergente; verificar modais responsivos, tema escuro, confirmação de estoque e eventos.
- [ ] Abrir `/admin/stock/divergences` e conferir TRF `TRF-20261015-144225-589`, filtro de data, link para detalhe e ausência de duplicação de movimentação.
- [ ] Em `/admin/inventory`, testar celular/tablet vertical, agrupamento default por produto, expandir/recolher, filtro por local, limpar filtros, ordenar cabeçalhos no desktop e valores estáveis do banco.
- [ ] Criar pedidos de retirada e entrega com Pix Sandbox e cartão fictício; conferir `/p/<token>`, reserva, confirmação, baixa física no momento correto e classificação financeira; também testar pagar depois na retirada/entrega.
- [ ] Testar método manual de PIX não disponível para testes Gelinhares, sem permissão para dinheiro real.
- [ ] Conferir função `get_public_checkout_payment_options_by_slug` para outros slugs inalterados em comportamento.

### Questões NÃO concluídas nesta rodada

- Histórico detalhado de transferências na Vida do Produto: estados, valores antes/depois por local e resumo progressivo de 104 enviadas, 101 recebidas, 3 de retorno/perda. **Não inventar saldo histórico** quando não houver snapshot.
- `/inventory`: coluna de máximo e estado agregado dependem da disponibilidade e autoridade do campo configurado, ainda não incluídos; trânsito de entrega de cliente deve ser indicador distinto das transferências.
- Divergência da classificação de comprovante de cartão como Pix, rastreabilidade de status público, persistência multiaba do carrinho e cancelamento transacional pós-despacho continuam em acompanhamento.
- Rotina financeira de depósito em fases, nova leitura do extrato, tradução de lançamento, padronização de atualização e caixa: documentados separadamente em `docs/HANDOFF_FINANCEIRO_EXTRATO_DEPOSITOS_UX_20261015.md`.

**Proibição de fechamento contábil fictício:** registros antigos só podem ser reconciliados/fechados como exatos se houver provas de contagem e autorização/auditoria. Uma diferença real não deve ser apagada para simular 100% correto.


## Atualização operacional — 17/10/2026

### Evidências da transferência TRF-20261015-144225-589
- Origem Estoque Principal: **190 unidades antes, saída de 30, 160 depois**, comprovado por `stock_movements.previous_stock/new_stock`.
- Destino Loja SJN: **114 unidades antes, entrada de 27, 141 depois**.
- Divergência: **3 unidades perdidas** (`loss`, motivo `quebra`), sem retorno à origem. O total físico consolidado diminuiu 3 nesta transferência. A divergência permanece visível para auditoria, mas já teve resolução registrada.
- Saldos físicos atuais devem ser consultados separadamente; não presumir que são os mesmos de 15/10.

### Corrigido em código, ainda depende de reteste humano
- `99d5fb444ad2`: status financeiro `payment_status` exposto na consulta pública por token, textos explicitando pagamento pendente; checkout não chama pedido antecipado de "finalizado pelo WhatsApp"; Pix Sandbox devidamente descrito como simulado, não QR de instituição bancária. Migration aplicada `20261017145430_rc_public_order_explicit_payment_status`.
- `24314ffce56`: login admin lê credenciais do formulário DOM no submit (compatível com autofill do navegador) e previne repetição de envio enquanto há requisição.
- `2f17e8da8c77`: RPC de consulta de **pedidos de clientes em entrega** por produto com permissão de membro da loja; migration `20261017145756_rc_inventory_customer_delivery_in_route_summary`; separa fisicamente trânsito de transferências e pedidos em rota sem baixar estoque duas vezes.
- `fade841ddc6e`: reconstrução de `/inventory` para resumo compacto por produto (desktop tabela com físico/reservado/em entrega/a receber/disponível/mín/máx/situação; mobile cards e locais em expansão); relatório operacional avançado preservado recolhido, filtros também recolhíveis.
- `edc828a8174`: página pública do pedido reconsulta status financeiro ao retornar foco e periodicamente até finalização, evitando informação `pending` congelada após confirmação por webhook.
- `c167a5841ae3`: apresentação de status financeiros com testes de regressão para pendente, pago, estorno e falha; confirmação somente quando `payment_status='paid'`.

### Provas de banco, sem criar cobranças
- Pedidos em teste `PED-20261017-144055-7394` (Pix) e `PED-20261017-144229-39D2` (débito): ambos `payment_status='pending'`, não pagos, cancelados. O primeiro tinha intenção online pendente; segundo sem intenção de pagamento vinculada.
- O texto antigo confundia pedido registrado/método escolhido com dinheiro recebido. O banco não indicou confirmação antecipada indevida nesses registros.
- Um pedido de cliente `out_for_delivery` contém **7 abacates**; agora pode aparecer no indicador Em entrega. É **movimento operacional** e não entra novamente na fórmula de estoque.
- RPC de entrega executável por `authenticated`, negada a `anon`, exigindo `is_store_member`.

### Importante: escopo ainda pendente
- PIX Sandbox é um simulador `OPTMAPAY://PIX/v1`, NÃO um BR Code bancário real. Para testar cobrança Pix por API de banco/PSP real é necessária frente de integração autorizada, credenciais apropriadas, segregação de ambiente e comprovação de webhook. Não simular conclusão financeira por copiar código ou enviar comprovante.
- Provar no navegador: pedido Pix Sandbox pendente -> confirmação simulada legítima -> `paid` por callback seguro -> atualização da página pública; cartão antes/depois da autorização, falha/retry; não emitir confirmação financeira antes de retorno positivo do servidor.
- Login autofill do painel admin exige reteste. Login da área do cliente, caso tenha sintoma idêntico, deve ser verificado na frente Clientes, sem alterar sua autenticação nesta rodada.
- Nova apresentação da tela de estoque exige reteste em mobile e tablet, inclusive agrupamento por local e coerência de mínimo/máximo.
- Implementação de ocorrências expandidas com snapshots completos na Vida do Produto continua pendente (pacote separado).
- Cancelamento pelo cliente estilo marketplace vai para conversa Clientes; bloqueio P0 de cancelamento pago/despachado continua até estorno e reversão auditável.
- Fronteira Financeiro (extrato, depósito, traduções, fechamentos) permanece adiada.

### Roteiro de aceite P0/P1 (não declarar RC sem reteste)
- [ ] Pix Sandbox: criar pedido de retirada, verificar `pending` antes da confirmação, validar simulação sem banco real, confirmar via caminho oficialmente suportado, verificar `paid` e Realtime/poll da página pública.
- [ ] Cartão Sandbox: criar pedido, constatar `payment_status=pending`, autorizar com cartão fictício, conferir `paid` somente após retorno; negar cartão e confirmar que permanece pendente.
- [ ] Pedidos com pagamento não confirmado: não mostrar "Pago" nem "Venda concluída" no cliente ou no administrativo; demonstrar valor não lançado no Livro Diário como recebimento.
- [ ] `/inventory`: verificar Abacate em entrega 7, disponível físico sem abatimento duplicado, transferências a receber separadas. Filtrar Estoque Principal/Loja SJN, conferir cabeçalhos, expandir tudo/recolher tudo em Android, desktop e tablet retrato/paisagem.
- [ ] Login administrativo com autofill de e-mail/senha no Chrome desktop e mobile: um clique em Entrar deve disparar somente uma requisição e redirecionamento.
- [ ] Verificar erros de rede e spinner; nenhuma tela branca, nenhuma regressão de RLS e de gestão multi-loja.

