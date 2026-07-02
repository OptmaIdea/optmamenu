# POS_9 - Financeiro - Fechamento do caixa do dia - Configuracao e resolucao de divergencia

## Status

Diretriz funcional registrada para etapa posterior.

## Contexto

A primeira regra minima de classificacao de divergencia ja foi implementada no backend com limites temporarios.

Validacao atual confirmou fechamentos sem divergencia classificados corretamente:

- `has_divergence = false`;
- `divergence_type = none`;
- `divergence_level = none`;
- `occurrence_required = false`.

## Ponto reforcado

Os limites de divergencia leve, relevante e critica nao devem ficar fixos no codigo para sempre.

Eles devem virar configuracao por loja.

## Configuracoes futuras por loja

Criar configuracoes como:

- tolerancia para divergencia leve;
- limite para divergencia relevante;
- limite para divergencia critica;
- exigir ocorrencia para qualquer divergencia;
- exigir permissao superior para divergencia relevante;
- exigir permissao/senha superior para divergencia critica;
- permitir ou bloquear fechamento com divergencia critica;
- exigir observacao sempre que houver divergencia;
- exigir resolucao posterior;
- notificar owner/supervisor.

Sugestoes de chaves:

```txt
cashbook_closing_low_divergence_limit
cashbook_closing_relevant_divergence_limit
cashbook_closing_critical_divergence_limit
cashbook_closing_require_occurrence_any_divergence
cashbook_closing_require_review_for_relevant
cashbook_closing_require_owner_for_critical
```

## Resolucao de divergencia

A divergencia nao termina no fechamento.

O fechamento registra o problema. Depois deve existir um fluxo de resolucao.

Exemplo real:

```txt
Problema no sistema do banco impossibilitou a conferencia no momento do fechamento.
```

Nesse caso, a diferenca pode ser temporaria. Depois que o banco voltar, o responsavel revisa o fechamento e resolve a ocorrencia.

## Status sugeridos para ocorrencia

- `open`: aberta;
- `waiting_external_confirmation`: aguardando banco/maquininha/sistema externo;
- `under_review`: em analise;
- `resolved`: resolvida;
- `cancelled`: cancelada/erro de abertura;
- `converted_to_loss`: assumida como perda/falta real;
- `converted_to_adjustment`: resolvida por ajuste financeiro autorizado.

## Tipos de resolucao

- erro de digitacao corrigido;
- comprovante localizado;
- banco/maquininha indisponivel no fechamento;
- pagamento caiu depois;
- lancamento estava em forma de pagamento errada;
- venda estava pendente e foi confirmada depois;
- troco/retirada/sangria nao registrada;
- falta real;
- sobra real;
- perda assumida;
- ajuste autorizado.

## Dados minimos da resolucao

A resolucao deve registrar:

- ocorrencia/fechamento relacionado;
- usuario que resolveu;
- data/hora da resolucao;
- tipo de resolucao;
- descricao;
- valor resolvido;
- diferenca remanescente;
- anexos/comprovantes futuros;
- metadata/auditoria.

## Modelo recomendado

### Etapa atual

Continuar registrando no `metadata` do fechamento:

- `has_divergence`;
- `divergence_type`;
- `divergence_level`;
- `occurrence_required`;
- `divergence_snapshot`.

### Etapa futura

Criar tabela propria para ocorrencias/resolucoes financeiras, por exemplo:

- `cashbook_closing_occurrences`;
- `cashbook_closing_occurrence_events`.

Ou usar uma tabela operacional geral:

- `operational_occurrences` com tipo `cashbook_closing_divergence`.

## Regra importante

O sistema deve permitir fechar o caixa com divergencia quando necessario, mas nunca deve deixar a divergencia sem rastro.

Fechar com divergencia significa:

```txt
A operacao foi encerrada, mas existe uma pendencia de auditoria/resolucao.
```

## Proxima implementacao sugerida

Antes de criar o fluxo completo de resolucao:

1. exibir etiqueta visual no historico para divergencias;
2. exibir status `ocorrencia obrigatoria` quando houver divergencia;
3. futuramente criar tela/modal de resolucao;
4. depois criar configuracoes por loja dos limites e exigencias.
