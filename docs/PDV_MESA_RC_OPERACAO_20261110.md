# Frente RC — PDV, Mesa/Comanda e integridade de Estoque/Financeiro

**Referência:** 10/11/2026
**Projeto:** OptmaMenu — piloto Gelinhares
**Base de homologação:** `agent/homologacao-geral-20260820`

## Decisão executiva

1. **Balcão/PDV:** venda imediata, preço autoritativo, caixa e estoque em uma operação transacional, registro de venda consultável.
2. **QR/autosserviço:** cliente escolhe itens na mesa e registra pedido associado à mesa, com retorno ao mesmo contexto. **Não equivale a uma comanda aberta.**
3. **Garçom/Mesa:** MVP obrigatório antes de declarar atendimento completo à mesa. Ter sessão/comanda própria, itens por rodada, operação de preparo/entrega, fechamento posterior. Não converter uma comanda em uma venda finalizada no ato da inclusão.
4. **Produtos e Financeiro:** rastreabilidade e consistência são bloqueadores de release, inclusive conexão de contas externas para recebimento. Dashboard analítico é evolução posterior, exceto se uma tela operacional essencial apresentar dados falsos.

## Entrega incremental 01: segurança de operação e UX

- PDV: dinheiro recebido validado em formato brasileiro e decimal simples, troco coerente, botão protegido contra finalização simultânea e venda bloqueada visualmente sem conexão (o backend continua autoridade).
- QR: retorno do checkout/login ao catálogo com **a mesa preservada**, inclusive no menu inferior; confirmação da mesa no checkout sem permitir escolha enganosa de retirada/entrega.
- Testes automatizados de parser de valores e retorno de rota.
- Sem alterações SQL/Edge/functions/transações nesta etapa.

## Próxima entrega obrigatória: Mesa/Comanda MVP

A próxima implementação deve começar por **modelo de dados e contrato de transações**; interface vem junto, não antes.

### Modelo de processo

1. Operador habilitado configura mesas e QR com referência **não adivinhável de sessão/versão quando necessário**, e escopo por loja. Não permitir que uma string arbitrária em URL dê acesso a comanda privada.
2. Garçom abre mesa/comanda, registra cliente opcional e escolhe origem de estoque. Permissões independentes de abrir/adicionar/enviar/cancelar/receber.
3. Cliente lê QR e adiciona itens em rodada. O envio só funciona para mesa habilitada e sessão correta. Não pode ver dados pessoais de outros consumidores da mesa.
4. Servidor aplica o mesmo motor autoritativo de precificação vigente, valida produtos, reserva/consome estoque por evento uma única vez e registra operador/origem/idempotência.
5. Garçom vê fila clara de rodadas pendentes; pode marcar preparo e **entregue na mesa**, com horário, responsável e logs de mudanças.
6. Caixa confere consumo consolidado e recebe, gerando Livro Diário/conta financeira e encerramento **uma vez**. Sem lançar recebimento quando apenas enviou para preparo.
7. Cancelamentos, faltas e devoluções reversíveis preservam trilha de auditoria. Múltiplos dispositivos e tentativas repetidas não podem duplicar pedidos, baixa ou receita.
8. Falha de rede: exibir estado de pedido incerto, permitir consulta por identificador e reenvio idempotente; não criar vendas fantasmas.

### Gate GO/NO-GO de mesa

- Um cliente anônimo e um autenticado não conseguem visualizar mesa/comanda alheia.
- Garçom A e operador de caixa B conseguem trabalhar a mesma comanda com permissões apropriadas e atualização visível.
- Duas rodadas de itens da mesma mesa geram **uma comanda**, sem contabilizar estoque duas vezes.
- Cliente recebe na mesa; garçom registra entrega e o fechamento exige registro de pagamento real/autorizado.
- Preço e estoque conferidos em PDV, QR, Produtos, Vida do Produto, saldo por local, Livro Diário e contas financeiras.
- Um retry, clique duplo ou troca de dispositivo não duplica baixas, recebíveis ou vendas.
- Testes reais mobile (Android/iOS quando disponível) e desktop, impressão de QR e preparo de fluxo de contingência.
- A equipe da Gelinhares valida a operação antes de abrir o uso real.

## Fronteiras

Não misturar pedidos da slug com vendas PDV concluídas nem com comandas abertas. Não alterar OptmaPay e OptmaSMSGate sem frente própria. Não publicar alterações de DB não homologadas. Nunca conceder grants amplos para contornar RLS. O Dashboard comercial não bloqueia a operação se os registros subjacentes estiverem corretos e auditáveis.

## Evidência e fechamento de cada rodada

Registrar HEAD, PR, migration (se houver), logs do CI, Vercel READY, testes manuais e diferenças de estoque/financeiro observadas em consultas somente leitura. Sem `GO` baseado apenas em build ou na aparência das telas.
