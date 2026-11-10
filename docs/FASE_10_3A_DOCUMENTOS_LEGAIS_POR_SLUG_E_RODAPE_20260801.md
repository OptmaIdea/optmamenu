# Fase 10.3A — documentos legais por slug e rodapé público

Data: 01/08/2026

## Problemas observados

1. O rodapé público era coberto pela barra fixa do carrinho quando havia itens.
2. Os links do rodapé da loja pública levavam aos documentos gerais da plataforma, sem preservar a identidade e o contexto da loja acessada por slug.

## Ajuste visual

O rodapé agora acrescenta espaço inferior quando identifica uma loja pública com carrinho ativo. A área reservada evita que a barra fixa cubra links, versões e conteúdo legal no celular.

## Separação dos documentos

Foram criadas páginas legais próprias por slug:

- `/s/:storeSlug/legal/termos`
- `/s/:storeSlug/legal/privacidade`
- `/s/:storeSlug/legal/cookies`

Essas páginas:

- carregam a loja pelo contrato público existente;
- exibem o nome da loja;
- retornam ao catálogo canônico da loja;
- tratam catálogo, pedido, entrega, pagamento, privacidade e cookies no contexto da relação entre consumidor, loja e plataforma;
- permanecem públicas e independentes da área administrativa autenticada.

## Comportamento do rodapé

Em rotas de loja, cardápio, QR, mesa e checkout, os links passam a apontar para os documentos da slug correspondente.

Fora do contexto de uma loja, permanecem os documentos institucionais gerais:

- `/terms`
- `/politica-privacidade`
- `/politica-cookies`

## Estado jurídico

O conteúdo das páginas por slug é uma versão operacional inicial. Ele não deve ser considerado texto jurídico definitivo antes de revisão especializada.

## Arquivos

- `src/pages/store/StoreLegalPage.tsx`
- `src/App.tsx`
- `src/components/common/PublicLegalFooter.tsx`
