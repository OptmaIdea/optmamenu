# POS_9 — Decisão: financeiro leigo x financeiro técnico e vida do empréstimo

## Decisão principal

O OptmaMenu deve separar a operação simples do usuário leigo da estrutura técnica financeira usada para governança, balancete, fluxo de caixa e auditoria.

No Livro Diário, o usuário não deve precisar entender o Plano de Contas como estrutura contábil. Para ele, o campo deve representar o motivo do lançamento.

No Plano de Contas, o administrador pode continuar vendo códigos, grupos, natureza, impacto no resultado, impacto no caixa físico e regras gerenciais.

## Linguagem para usuário leigo

- Entrada: dinheiro entrando na loja.
- Saída: dinheiro saindo da loja.
- Motivo do lançamento: por que entrou ou saiu dinheiro.
- Conta financeira: onde entrou ou de onde saiu o dinheiro.

Exemplos:

- Entrada de troco: motivo = reforço de troco; conta financeira = caixa físico.
- Compra de embalagem: motivo = embalagens; conta financeira = caixa físico, banco ou Pix.
- Despesa comum: motivo = despesa operacional; conta financeira = conta usada para pagar.

## Categorias que não devem aparecer no lançamento manual simples

Algumas categorias existem no Plano de Contas, mas não devem ser escolhidas diretamente pelo operador no botão Nova entrada / Nova saída.

Devem nascer de fluxos próprios:

- Venda em dinheiro, Pix, débito e crédito: nascem do fluxo de venda/pedido.
- Devolução de venda: deve nascer pela venda original, com vínculo, valor, operador, data e rastreabilidade.
- Cancelamento sobre vendas: deve nascer pelo cancelamento da venda original.
- Transferências internas: devem nascer pelo fluxo de transferência financeira entre contas.
- Empréstimo recebido e pagamento do principal: devem nascer pelo módulo de Empréstimos.

## Empréstimos

Empréstimo não deve ser tratado apenas como categoria solta no Livro Diário.

Deve existir uma vida do empréstimo, com controle de:

- instituição/credor;
- valor principal contratado;
- valor líquido recebido;
- data de entrada;
- parcelas previstas;
- principal pago;
- juros pagos;
- encargos, IOF, multas e tarifas;
- saldo remanescente;
- status: aberto, em dia, atrasado, quitado, renegociado, cancelado.

Exemplo:

- Entrou R$ 5.000,00 por empréstimo Bradesco.
- A empresa pagará R$ 6.800,00 no total.
- R$ 5.000,00 representam principal.
- R$ 1.800,00 representam juros/encargos financeiros.

No resultado gerencial:

- principal recebido não é receita operacional;
- amortização do principal não é despesa operacional;
- juros e encargos são despesas financeiras;
- o saldo remanescente do empréstimo deve ser acompanhado separadamente.

## Fluxo futuro recomendado

### Cadastro do empréstimo

Campos sugeridos:

- credor/instituição;
- contrato ou referência;
- valor contratado;
- valor líquido recebido;
- conta financeira de entrada;
- data de recebimento;
- quantidade de parcelas;
- taxa/juros quando informável;
- observações e anexos.

Ao registrar o empréstimo, o sistema cria o lançamento financeiro técnico de entrada do principal, vinculado ao empréstimo.

### Pagamento de parcela

Cada parcela pode conter:

- valor de principal/amortização;
- juros;
- IOF/tarifa/multa;
- desconto, se houver;
- conta financeira usada no pagamento.

O sistema cria os lançamentos no Livro Diário com vínculo ao empréstimo.

### Relatório/Vida do Empréstimo

A tela deve mostrar:

- valor inicial;
- total pago;
- principal pago;
- juros/encargos pagos;
- saldo remanescente;
- próximas parcelas;
- histórico de eventos;
- impacto no fluxo de caixa.

## Prioridade do projeto

Antes do módulo completo de empréstimos, a prioridade operacional é:

1. fechar consistência financeira atual;
2. revisar permissões;
3. revisar slug/loja pública;
4. finalizar vendas online e WhatsApp básico;
5. revisar advisors do Supabase;
6. testar o aplicativo;
7. publicar na Vercel;
8. preparar manual de instruções para clientes de teste.

O módulo completo de empréstimos fica registrado como etapa posterior, mas as categorias técnicas já devem ser protegidas para não confundirem o operador no lançamento manual simples.
