# Fase 10.3A — Rodapé legal compacto e contatos públicos

Data: 01/08/2026

## Objetivo

Reduzir o destaque visual do rodapé público, especialmente no celular, mantendo acesso claro aos documentos legais, versionamento, preferências de cookies, identificação institucional e canais de contato corretos.

## Rodapé público

O componente `PublicLegalFooter` foi reorganizado com:

- conteúdo centralizado;
- fundo `slate` levemente diferenciado das demais áreas;
- título e texto explicativo mais discretos;
- links legais compactos;
- ação para reabrir preferências de cookies;
- linha institucional com OptmaIdea e OptmaMenu;
- versão atual da aplicação (`0.10.0-rc.1`);
- linha compacta com datas e versão dos documentos;
- e-mail institucional `faleconosco@optmaidea.com.br`;
- preservação do espaçamento inferior quando houver barra fixa do carrinho.

## Redes sociais

As redes sociais são exibidas somente quando estiverem publicadas na configuração pública da loja em `visual_config.social_links`.

Campos atualmente reconhecidos:

- `instagram`;
- `facebook`;
- `tiktok`;
- `twitter`;
- `website`.

A apresentação usa somente ícones com rótulos acessíveis. Nenhuma rede vazia ou presumida é mostrada.

## Contato da loja

Nas páginas legais específicas por slug, o contato da loja deixou de usar WhatsApp.

A fonte passa a ser:

```text
/admin/settings → Contatos → e-mail principal
```

Contrato público consumido:

```ts
visual_config.contact_email
```

Quando o e-mail estiver disponível, o sistema cria um `mailto:` com assunto e mensagem ajustados ao documento atual:

- termos;
- privacidade;
- cookies.

Quando o e-mail não estiver publicado, o botão da loja não é exibido e uma mensagem neutra informa a indisponibilidade do canal.

## Contato da plataforma

O contato institucional adotado para a OptmaIdea é:

```text
faleconosco@optmaidea.com.br
```

Esse endereço é usado no rodapé público e nas páginas legais da loja.

## Separação de responsabilidades

- Loja: pedidos, atendimento comercial e dados diretamente vinculados à compra.
- OptmaIdea: infraestrutura técnica e assuntos institucionais do OptmaMenu.

## Arquivos alterados

- `src/components/common/PublicLegalFooter.tsx`
- `src/pages/store/StoreLegalPage.tsx`

## Banco de dados

Nenhuma migration ou alteração de banco foi realizada.
