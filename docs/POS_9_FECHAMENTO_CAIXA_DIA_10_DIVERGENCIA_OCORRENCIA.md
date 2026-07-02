# POS_9 - Financeiro - Fechamento do caixa do dia - Divergencia e ocorrencia

## Status

Regra funcional registrada.

## Contexto

A primeira versao visual do fechamento esta funcionando com:

- caixas abertos;
- caixas atrasados;
- historico de fechamentos;
- bloqueio de caixa fechado;
- detalhes externos salvos no metadata;
- observacoes preservadas.

Durante a validacao surgiu a pergunta:

```txt
Qual regra adotaremos quando o caixa ficou divergente?
```

## Decisao

Sim: caixa divergente deve gerar ocorrencia.

A ocorrencia deve servir como registro formal para:

- auditoria;
- apuracao posterior;
- protecao da loja;
- protecao do operador;
- rastreabilidade de erro, falta, sobra, fraude ou problema operacional.

## Classificacao sugerida

### 1. Sem divergencia

Quando:

```txt
difference_total = 0
```

Regra:

- caixa fecha normalmente;
- nao gera ocorrencia;
- apenas registra fechamento.

### 2. Divergencia leve / tolerada

Quando a diferenca esta dentro de uma tolerancia configurada.

Exemplo inicial:

```txt
ate R$ 1,00 ou ate R$ 2,00
```

Regra:

- caixa pode fechar;
- exige observacao;
- marca fechamento como `divergence_level = low` no metadata ou campo futuro;
- gera ocorrencia simples/leve se a loja desejar.

### 3. Divergencia relevante

Quando a diferenca supera a tolerancia configurada.

Regra:

- caixa pode fechar para nao travar operacao;
- exige observacao obrigatoria;
- gera ocorrencia obrigatoria;
- deve ficar pendente de revisao por proprietario/supervisor;
- deve aparecer no dashboard/alertas financeiros.

### 4. Divergencia critica

Quando a diferenca supera limite critico.

Exemplo inicial:

```txt
acima de R$ 20,00, R$ 50,00 ou percentual do movimento
```

Regra:

- gera ocorrencia critica;
- exige justificativa detalhada;
- pode exigir senha/permissao superior;
- pode bloquear fechamento final ou permitir fechamento com status `closed_with_critical_divergence` em etapa futura;
- deve alertar proprietario.

## Tipos de divergencia

A ocorrencia deve identificar o sentido:

### Falta

```txt
confirmed_total < expected_total
```

Significa que o valor conferido foi menor que o esperado.

### Sobra

```txt
confirmed_total > expected_total
```

Significa que o valor conferido foi maior que o esperado.

Ambas precisam de rastreabilidade.

## Dados minimos da ocorrencia

A ocorrencia de divergencia deve registrar:

- loja;
- caixa/fechamento;
- data do caixa;
- usuario responsavel pelo fechamento;
- data/hora do fechamento;
- valor esperado;
- valor conferido;
- diferenca total;
- diferenca por forma de pagamento;
- tipo: sobra ou falta;
- nivel: leve, relevante ou critica;
- observacao obrigatoria;
- metadata com snapshots;
- status da ocorrencia: aberta, em analise, resolvida, cancelada;
- responsavel pela revisao, quando houver.

## Modelo atual

Hoje, a primeira implementacao ja salva:

- `expected_total`;
- `confirmed_total`;
- `difference_total`;
- diferencas por forma de pagamento;
- `notes`;
- `metadata`;
- `closed_by`;
- `closed_at`.

Portanto, ja temos base para identificar divergencia.

## Modelo futuro

Criar uma estrutura propria de ocorrencias financeiras, por exemplo:

- `cashbook_closing_occurrences`;
- ou uma tabela geral `operational_occurrences` com tipo `cashbook_closing_divergence`.

Para a etapa atual, pode-se primeiro registrar no `metadata` do fechamento:

```json
{
  "has_divergence": true,
  "divergence_type": "shortage",
  "divergence_level": "relevant",
  "occurrence_required": true
}
```

Depois evoluir para tabela propria.

## Regras futuras de configuracao por loja

Configurar por loja:

- tolerancia de divergencia leve;
- limite de divergencia critica;
- exigir ocorrencia para qualquer divergencia;
- exigir senha/permissao para fechar com divergencia;
- permitir ou nao fechamento com divergencia critica;
- exigir anexo/comprovante;
- notificar proprietario.

## Permissoes futuras sugeridas

- `cashbook.occurrence.view`;
- `cashbook.occurrence.create`;
- `cashbook.occurrence.review`;
- `cashbook.occurrence.resolve`;
- `cashbook.close_with_divergence`;
- `cashbook.close_with_critical_divergence`.

## Recomendacao para primeira versao

Antes de criar tabela propria de ocorrencias, aplicar a regra minima:

1. Se `difference_total = 0`, fechamento normal.
2. Se `difference_total != 0`, exigir observacao.
3. Salvar no metadata:
   - `has_divergence`;
   - `divergence_type`;
   - `divergence_level`;
   - `occurrence_required`.
4. Mostrar no historico que o fechamento teve divergencia.
5. Depois criar tabela propria de ocorrencias financeiras.

## Observacao importante

O fechamento com divergencia nao deve simplesmente impedir a loja de encerrar o dia.

Em muitos casos, a operacao precisa ser encerrada mesmo com divergencia.

O sistema deve permitir encerrar com rastreabilidade e revisao posterior, nao apagar o problema nem travar a loja sem alternativa.
