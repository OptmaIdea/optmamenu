# POS_9 - Financeiro - Fechamento do caixa do dia - UI de divergencia no historico

## Status

Implementado destaque visual de divergencia no historico de fechamentos.

## Arquivo alterado

- `src/pages/private/admin/financial/cashbook/components/DayClosingPanel.tsx`

Commit:

- `2fbb44fd171289d1c9f1c4761c8d1258cfad98c0`

## O que entrou

### 1. Leitura do metadata de divergencia

A tela agora interpreta os campos salvos no metadata:

- `has_divergence`;
- `divergence_type`;
- `divergence_level`;
- `occurrence_required`.

### 2. Badge visual no historico

Cada fechamento no historico passa a mostrar uma etiqueta:

- `Sem divergencia`;
- `Divergencia Leve`;
- `Divergencia Relevante`;
- `Divergencia Critica`.

Quando houver divergencia, tambem mostra:

- `Falta` ou `Sobra`;
- `Ocorrencia obrigatoria`, quando aplicavel.

### 3. Badge visual no detalhe do fechamento

Ao clicar em `Ver detalhes` de um caixa fechado, o resumo do fechamento tambem mostra a classificacao da divergencia.

## Regra visual

- Sem divergencia: verde;
- Divergencia leve: amarelo/ambar;
- Divergencia relevante: laranja;
- Divergencia critica: vermelho.

## Observacao

Ainda nao foi criada tabela propria de ocorrencias/resolucoes.

Esta etapa apenas exibe na UI a classificacao ja calculada e salva pelo backend.

## Validacao sugerida

1. Rodar `git pull`.
2. Rodar `npm run build`.
3. Abrir `/admin/cashbook`.
4. Ir em `Fechamento do dia`.
5. Conferir historico de fechamentos.
6. Ver se caixas sem divergencia aparecem como `Sem divergencia`.
7. Criar/testar um fechamento com divergencia em ambiente de teste.
8. Confirmar badge de divergencia, tipo e ocorrencia obrigatoria.
9. Conferir console limpo.
