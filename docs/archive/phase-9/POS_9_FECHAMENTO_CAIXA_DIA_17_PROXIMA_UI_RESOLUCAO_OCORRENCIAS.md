# POS_9 - Financeiro - Fechamento do caixa do dia - Proxima UI de resolucao de ocorrencias

## Status

Backfill validado pelo usuario.

Resultado informado:

```json
[
  {
    "section": "count_by_status_after_backfill",
    "status": "open",
    "total": 1
  }
]
```

Isso confirma que existe 1 ocorrencia aberta vinculada ao fechamento divergente de teste.

## Contexto funcional

A UI ja mostra no historico:

```txt
Divergencia Leve · Falta · Ocorrencia obrigatoria
```

A tabela de ocorrencias tambem ja esta sincronizada.

## Proxima etapa frontend

Criar UI simples de acompanhamento/resolucao dentro do modal de detalhes do fechamento.

### Modal de detalhes deve mostrar

- status da ocorrencia;
- tipo de divergencia: falta/sobra;
- nivel: leve/relevante/critica;
- observacao de abertura;
- diferenca total;
- data de criacao;
- usuario que resolveu, quando houver;
- data/hora de resolucao, quando houver;
- observacao de resolucao.

### Acoes iniciais

Permitir mudar status para:

- em analise;
- aguardando confirmacao externa;
- resolvida;
- cancelada;
- ajuste autorizado.

### Regra de resolucao

Para status final, exigir observacao:

- resolvida;
- cancelada;
- ajuste autorizado.

### Exemplos de resolucao

- banco/maquininha indisponivel no fechamento;
- comprovante localizado depois;
- venda pendente confirmada depois;
- erro de digitacao;
- troco errado confirmado;
- ajuste autorizado.

## Observacao tecnica

A primeira tentativa de criar service frontend para ocorrencias foi bloqueada pela ferramenta nesta rodada.

Nao insistir no mesmo payload grande.

Na proxima rodada, fazer em passos menores:

1. criar arquivo de service pequeno apenas com `list`;
2. validar build;
3. adicionar funcao de atualizacao em segundo commit;
4. depois conectar no `DayClosingPanel`.

## Estado atual seguro

- Backend de ocorrencias criado.
- Backfill executado.
- 1 ocorrencia aberta validada.
- UI ja destaca divergencia.
- Falta UI de resolucao.
