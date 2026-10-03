# Fase 10.3A — Navegação entre documentos legais da loja

Data: 01/08/2026

## Objetivo

Melhorar a experiência dos documentos legais públicos vinculados à slug da loja, mantendo a separação entre documentos institucionais da plataforma e documentos aplicáveis ao relacionamento comercial entre consumidor e estabelecimento.

## Entrega

O componente `StoreLegalPage` passou a oferecer navegação direta entre:

- Termos de uso da loja;
- Política de privacidade da loja;
- Política de cookies da loja.

As rotas continuam isoladas por slug:

```text
/s/:storeSlug/legal/termos
/s/:storeSlug/legal/privacidade
/s/:storeSlug/legal/cookies
```

## Comportamento

- a slug canônica carregada pelo storefront é preservada nos links;
- o documento ativo recebe destaque visual e `aria-current="page"`;
- a navegação é horizontal e rolável no celular;
- o retorno leva ao catálogo da mesma loja;
- a política de cookies permite reabrir o gerenciador global de preferências;
- não há redirecionamento para a área administrativa autenticada.

## Esclarecimento de responsabilidades

Os textos operacionais passaram a distinguir:

- a loja, responsável pela venda, atendimento, preparo, separação e entrega;
- a OptmaIdea, responsável pela infraestrutura técnica do OptmaMenu;
- o cliente, responsável pelos dados informados no pedido.

Também foi registrado que o envio do pedido representa uma solicitação sujeita à confirmação operacional da loja.

## Limites

- os textos continuam marcados como versão operacional inicial;
- não houve alteração de banco, migração ou persistência de aceite;
- a revisão jurídica especializada permanece obrigatória antes da publicação definitiva.
