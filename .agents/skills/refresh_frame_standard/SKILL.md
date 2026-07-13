---
name: refresh_frame_standard
description: Padrão de atualização e atualização automática das tabelas e painéis
---
# Skill: Padrão de Atualização de Frame (Refresh Frame Logic)

## Visão Geral
Esta skill estabelece a arquitetura padrão para a atualização/refresh dos componentes e telas de administração no frame interno do OptmaMenu, utilizando o custom hook `useRefreshFrame`.

---

## Padrão Técnico

Sempre que um novo componente/página de administração for criado para ser exibido dentro do layout interno (`PrivateLayout`), ou quando um componente existente for atualizado na IDE ou via CLI:

1. **Importação do Hook**:
   O componente deve importar o hook `useRefreshFrame` de `@/hooks/useRefreshFrame`.

   ```typescript
   import { useRefreshFrame } from '@/hooks/useRefreshFrame';
   ```

2. **Registro da Função de Refresh**:
   O componente deve registrar sua respectiva função de recarga/atualização de dados (ex: `handleRefresh`, `fetchData`, etc.) com o hook.

   ```typescript
   useRefreshFrame(handleRefresh);
   ```

3. **Garantia de Estabilidade da Função**:
   Certifique-se de que a função passada para `useRefreshFrame` esteja devidamente envolvida em um `useCallback` ou seja estável entre re-renderizações para evitar múltiplos event listeners desnecessários.

   ```typescript
   const handleRefresh = useCallback(async () => {
       // Lógica para recarregar dados do Supabase/API
   }, [/* dependências */]);
   ```

4. **Objetivo**:
   Isso garante que o botão **Atualizar** localizado no Acesso Rápido (na barra superior do `PrivateLayout.tsx`) atualize o conteúdo do frame atual enviando o evento customizado `optmamenu.refresh` a que o hook está inscrito.

