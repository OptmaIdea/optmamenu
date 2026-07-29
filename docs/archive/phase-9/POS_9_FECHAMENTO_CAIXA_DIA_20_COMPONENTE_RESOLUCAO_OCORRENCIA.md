# POS_9 - Financeiro - Fechamento do caixa do dia - Componente de resolucao de ocorrencia

## Status

Componente de resolucao criado.

## Arquivo criado

- `src/pages/private/admin/financial/cashbook/components/CashbookOccurrenceResolutionBox.tsx`

Commit:

- `07e5989e3a46fd90508fd1f5a230bc19c2ebfabf`

## Objetivo

Permitir atualizar uma ocorrencia de divergencia diretamente no modal de detalhes do fechamento.

## Acoes iniciais suportadas

- `under_review`: Em analise;
- `waiting_external_confirmation`: Aguardando confirmacao externa;
- `resolved`: Resolvida.

## Regra inicial

Para marcar como resolvida, exige observacao.

## Service usado

- `CashbookDiscrepancyService.resolve(...)`

## Integracao pendente

O componente ainda precisa ser importado e usado no `DayClosingPanel.tsx`, dentro do modal de detalhes do fechamento.

A integracao foi deixada para patch manual/rodada seguinte porque o arquivo `DayClosingPanel.tsx` esta grande e a atual ferramenta de GitHub exige substituir o arquivo inteiro, aumentando o risco de sobrescrever algo que esta funcionando.

## Patch manual sugerido

1. Adicionar import:

```ts
import CashbookOccurrenceResolutionBox from './CashbookOccurrenceResolutionBox';
```

2. Dentro de `renderClosingSummary`, logo apos `{renderOccurrenceCard(occurrence)}`, adicionar:

```tsx
{occurrence && (
  <CashbookOccurrenceResolutionBox
    storeId={storeId}
    occurrence={occurrence}
    canResolve={canClose}
    onUpdated={(updated) => {
      setOccurrences((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
    }}
  />
)}
```

## Validacao sugerida apos integrar

1. Rodar `npm run build`.
2. Abrir `/admin/cashbook`.
3. Ir em `Fechamento do dia`.
4. Abrir `Historico de fechamentos`.
5. Clicar em `Ver detalhes` no fechamento divergente.
6. Conferir box `Atualizar ocorrencia`.
7. Marcar como `Em analise`.
8. Depois marcar como `Resolvida` com observacao.
9. Conferir console limpo.
