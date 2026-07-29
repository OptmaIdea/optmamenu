# POS_9 - Financeiro - Fechamento do caixa do dia - Sangria, retiradas e multiplos caixas

## Status

Diretriz funcional registrada para etapa posterior.

## Contexto

Durante a modelagem do Fechamento do caixa do dia, foi definido que o fechamento nao pode considerar apenas a conferencia final.

Na operacao real, o caixa tambem precisa lidar com:

- varios caixas abertos;
- caixas por usuario, turno, frente, ponto ou terminal;
- sangrias/retiradas de dinheiro durante o expediente;
- limite de dinheiro permitido na frente de caixa;
- rastreabilidade de quem retirou, quando retirou, quanto retirou e para onde declarou que o dinheiro foi.

## Problema operacional

O excedente de dinheiro nao pode ficar indefinidamente na frente de caixa.

Quando o valor em dinheiro fica alto, a loja pode precisar fazer uma sangria/retirada para reduzir risco de:

- furto;
- roubo;
- fraude;
- erro de conferencia;
- divergencia no fechamento;
- conflito entre atendente, caixa, gerente e proprietario.

## Decisao registrada

Criar futuramente um fluxo proprio de sangria/retirada de caixa.

A sangria deve ser diferente de uma simples saida manual.

Ela representa:

```txt
Dinheiro saiu da frente de caixa.
```

Para onde foi e uma etapa operacional/de custodia que tambem deve ser registrada, mesmo antes de termos controle completo de bancos/saldos.

## Regra minima de sangria

Cada sangria deve registrar:

- loja;
- caixa/frente/turno, quando esse modelo existir;
- data e hora;
- valor retirado;
- motivo;
- usuario que solicitou;
- usuario que autorizou, se aplicavel;
- usuario que recebeu/ficou responsavel, se aplicavel;
- destino declarado;
- observacao;
- comprovante/anexo futuro, se necessario;
- relacao com fechamento do caixa;
- metadata/auditoria.

## Destinos possiveis iniciais

Mesmo sem controle de saldo bancario completo, o destino declarado pode ser:

- cofre;
- envelope de sangria;
- responsavel/gerente;
- proprietario;
- deposito bancario posterior;
- outro.

## Relacao com Livro Caixa

A sangria nao deve ser tratada como despesa operacional comum.

Ela deve reduzir o dinheiro fisico esperado na frente de caixa, mas nao necessariamente reduzir o resultado financeiro da loja.

Exemplo:

```txt
Vendas em dinheiro: R$ 500,00
Sangria para cofre: R$ 300,00
Dinheiro esperado na gaveta: R$ 200,00
Resultado financeiro em dinheiro do dia: R$ 500,00
```

Portanto, o fechamento precisa futuramente diferenciar:

- dinheiro vendido/recebido;
- dinheiro retirado por sangria;
- dinheiro fisico esperado na gaveta;
- dinheiro fisico contado;
- diferenca real.

## Relacao com fechamento do dia

No fechamento, deve aparecer:

- dinheiro recebido no dia;
- sangrias realizadas;
- dinheiro esperado na gaveta;
- dinheiro contado;
- diferenca;
- responsaveis pelas sangrias;
- observacoes.

## Multiplicidade de caixas

Foi registrada a necessidade futura de varios caixas abertos.

Cenarios esperados:

- um caixa por usuario/atendente;
- um caixa por turno;
- um caixa por terminal/dispositivo;
- um caixa por local/frente de atendimento;
- varios caixas simultaneos na mesma loja.

Cada caixa deve poder ser fechado individualmente.

## Modelo atual x futuro

### Modelo atual

A primeira implementacao de fechamento esta por:

- loja;
- data.

### Modelo futuro

Evoluir para:

- loja;
- data;
- caixa/turno/frente;
- responsavel;
- status do caixa;
- abertura;
- sangrias;
- fechamento individual.

## Configuracoes futuras

Configurar por loja:

- prazo maximo de caixa aberto;
- limite recomendado de dinheiro em gaveta;
- limite maximo antes de alertar sangria;
- exigencia de autorizacao para sangria;
- exigencia de observacao;
- exigir responsavel/destino;
- permitir ou nao sangria sem fechamento.

## Permissoes futuras sugeridas

- `cashbook.withdrawal.view`;
- `cashbook.withdrawal.create`;
- `cashbook.withdrawal.authorize`;
- `cashbook.withdrawal.cancel`;
- `cashbook.cash_register.view`;
- `cashbook.cash_register.open`;
- `cashbook.cash_register.close`;
- `cashbook.cash_register.manage`.

Enquanto essas permissoes granulares nao existirem, usar permissoes financeiras existentes somente para primeira versao controlada.

## Fora do escopo imediato

Nao implementar agora:

- controle completo de bancos;
- conciliacao bancaria;
- saldo de cofre;
- saldo de envelopes;
- fluxo completo de deposito;
- multiplos caixas reais no schema atual;
- anexos/comprovantes.

Esses itens ficam para etapa posterior apos estabilizar fechamento por loja/data.

## Proxima acao recomendada

Antes de implementar sangria, concluir a frente atual:

1. listar caixas abertos e atrasados;
2. bloquear edicao de caixa fechado;
3. criar historico de fechamentos;
4. melhorar mensagens de caixa fechado;
5. depois modelar sangria e multiplos caixas.
