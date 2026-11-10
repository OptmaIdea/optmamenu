# Pacote 08 — Clientes e Loja Pública: prontidão para uso real

**Data:** 22/10/2026 · **Branch de integração:** agent/homologacao-geral-20260820

## Objetivo e decisão de produto

Dar saída comercial ao OptmaMenu sem abandonar a segurança efetiva. Não reabrir funcionalidades já homologadas e não vender como “produção real” funcionalidades testadas somente no Sandbox.

### P08.A — Correção funcional de navegação do cliente

Em `Minha conta → Meu consumo`, a miniatura/título do produto abre o catálogo por `?product=id&returnTo=consumption`. A implementação anterior abria corretamente produtos existentes, mas um produto removido/inativo gerava uma URL sem destino e **não retornava** à área do cliente. Isso tende a ocorrer após despublicação ou troca do catálogo.

**Correção:** após o carregamento do catálogo público, produto indisponível vindo do histórico limpa apenas os parâmetros de deep link, preserva outros filtros, mostra aviso amigável e reabre `Meu consumo`, sem alterar pedido histórico ou adicionar produto indisponível ao carrinho. Links regulares são preservados. Novos testes Vitest cobrem sete cenários, inclusive catálogo vazio, carregamento lento e filtros na URL.

### P08.B — Baseline comercial conferido no banco ativo (somente leitura)

| Critério | Situação conferida |
|---|---|
| Supabase | Projeto lgkkfmqzaorrutuoqeax |
| GitHub / Vercel antes do P07 | HEAD eacacb232d3cbe16c99b7118e6ad145bcb7b6f54 · CI SUCCESS · Vercel READY |
| Gelinhares | Loja pública e catálogo público habilitados |
| Produtos Gelinhares | 37 cadastrados, 36 ativos |
| Snacks Di Cris | Loja e catálogo públicos desabilitados, sem produtos cadastrados |
| LogMyTravel | Não retornou loja com o slug informado na consulta específica |
| Provider Gelinhares | Somente `optma_sandbox`, ambiente `sandbox`, `enabled=true`, `credential_status=ready` |
| Expiração de pedidos | `cancel-expired-orders-every-minute` ativo a cada minuto |
| Mínimo atual no banco da Gelinhares | R$ 8,00 no campo `stores.minimum_order_value` |

**Divergência a confirmar:** a decisão histórica era mínimo de R$ 20,00 somente para entrega, retirada sem mínimo. O banco agora contém R$ 8,00. Esta rodada NÃO altera o valor nem afirma qual mínimo é efetivamente aplicado pelo checkout; exige verificar as regras de `store_settings/order_settings` e o comportamento no servidor.

## Liberação faseada recomendada

### Fase A — Primeiras vendas reais sem cobrança automática

- **Liberável apenas após aceite manual:** loja publicada, produtos com estoque real, retirada com pagamento na loja, identificação/login, carrinho, geração de pedido, reserva, confirmação, entrega/retirada, baixa física, livro caixa e comprovante de conclusão.
- Checkout anônimo: permanecer restrito a retirada/pagamento posterior, como estabelecido e protegido no backend.
- **Não usar OptmaPay Sandbox como cobrança real.** Pagamentos online reais precisam de credenciais de produção, webhook, conciliação e estorno autoritativo previamente homologados.
- Não mudar a configuração do provider nem produzir cobrança real sem consentimento expresso.

### Fase B — Clientes prontos para usuários reais

Testar no mínimo em Android e desktop com conta de teste:
1. Cadastro OTP, senha, login e primeiro dispositivo confiável.
2. Novo dispositivo exige SMS OTP; rejeição de sessão revogada e troca de senha encerrando sessões antigas.
3. E-mail real verificado; confirmação por token e aviso pós-confirmação no Brevo.
4. Carrinho sincronizado entre dois dispositivos, limpeza/tombstone, recompra de pedido antigo respeitando catálogo/estoque.
5. Minha conta → pedidos, cancelamento solicitado, histórico, Meu consumo, produto retirado do catálogo e volta à conta.
6. Consentimentos marketing separados das mensagens operacionais; fidelidade opt-in e opt-out.
7. Exportar meus dados (sem hashes e segredos), alterar dados sensíveis com reautenticação.
8. Pedir exclusão de conta, auditar e executar fluxo administrativo controlado sem perder retenções fiscais.
9. Status de pedido, expiração, baixa e devolução de reserva após cancelamento não pago, sem mexer em pedidos Pix já pagos sem estorno comprovado.
10. Testar responsividade mobile, tablet, teclado/escape e contraste da conta.

### Bloqueadores que não devemos mascarar

- **Pagamentos reais:** Sandbox não é ambiente de recebimento real.
- **Exclusão definitiva:** pedido de exclusão com segurança existe; conclusão operacional do executor administrativo e definição de retenção por obrigação precisam aceite.
- **Concorrência SMS OTP:** teste em duas sessões SQL independentes foi indicado pendente nos documentos de 19/10.
- **Brevo:** entrega do e-mail transacional posterior à alteração de senha e confirmação precisa prova real controlada, não inferência por deploy.
- **Cancelamentos pagos:** estorno real, conciliação e liberação de reservas dependem de integração financeira autoritativa. Não simular reembolso.
- **Política comercial:** confirmar mínimo de entrega e restrições por modalidade.

### Contrato de encerramento

Só chamar **Clientes concluído para operação** quando nenhuma jornada acima tiver bloqueador crítico; cada teste terá responsável, pedido/conta de teste, resultado, screenshot/console sanitizado, verificação Supabase e rollback quando aplicável. Não assumir deploy READY como comprovação de ponta a ponta.

## Fontes internas

- docs/CLIENTES_MENSAGENS_LOTE_CARRINHO_SESSAO_20261019.md
- docs/CLIENTES_ALERTAS_SEGURANCA_RETORNO_20261019.md
- docs/CLIENTES_CHECKOUT_PREPAGAMENTO_HISTORICO_20261018.md
- docs/CLIENTES_CANCELAMENTO_SEGUNDA_RODADA_20261018.md
- docs/PROJECT_STATUS.md

P08 não cria nem modifica recursos pagos, contas reais, estoque ou lançamentos financeiros.
