# Fase 10.3A — Rodapé legal público

Data: 2026-08-01

## Objetivo

Criar um ponto persistente e reutilizável de acesso aos documentos legais públicos e às preferências de cookies, sem duplicar links em cada tela da loja pública.

## Implementação

Foi criado o componente `src/components/common/PublicLegalFooter.tsx` e renderizado no nível da aplicação, dentro do `BrowserRouter`.

O rodapé aparece em rotas públicas e é ocultado em:

- `/admin` e subrotas;
- `/pdv`;
- `/onboarding` e subrotas.

## Conteúdo exposto

- Termos de Uso;
- Política de Privacidade;
- Política de Cookies;
- ação para reabrir as preferências de cookies;
- datas atualmente declaradas nos documentos existentes;
- links institucionais do OptmaMenu e da OptmaIdea.

## Reabertura do consentimento

A ação `Gerenciar cookies` dispara o evento já adotado na etapa anterior:

```text
optmamenu:open-cookie-preferences
```

O componente global de consentimento relê a decisão armazenada e abre diretamente a tela de preferências.

## Decisão de versionamento

O rodapé não inventa uma nova versão para Termos de Uso ou Política de Privacidade. Enquanto esses documentos não forem revisados, ele exibe a data que já consta nas páginas atuais: `11/02/2026`.

A Política de Cookies permanece identificada como versão `1.0`.

## Riscos e próximos passos

- Termos de Uso e Política de Privacidade ainda precisam de revisão jurídica e funcional específica para a operação multi-loja e para a relação entre plataforma, lojista e consumidor.
- O aceite autenticado dos documentos ainda não é persistido no backend.
- O rodapé global deve ser homologado junto às barras fixas de carrinho e checkout em celular, verificando espaçamento e ausência de sobreposição.

## Arquivos alterados

- `src/components/common/PublicLegalFooter.tsx`
- `src/App.tsx`
- `docs/FASE_10_3A_RODAPE_LEGAL_PUBLICO_20260801.md`
