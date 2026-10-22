# Fase 10.3A — Canais de contato nos documentos legais da loja

Data: 01/08/2026

## Objetivo

Dar consequência prática aos documentos legais por slug, permitindo que o cliente identifique a responsabilidade da loja e da plataforma e encontre canais adequados para dúvidas, pedidos e exercício de direitos.

## Entrega

As páginas públicas abaixo passaram a exibir uma seção própria de contato:

- `/s/:storeSlug/legal/termos`
- `/s/:storeSlug/legal/privacidade`
- `/s/:storeSlug/legal/cookies`

## Canais expostos

### Loja

Quando o contrato público disponibiliza um número válido, é exibido um botão para abrir o WhatsApp da própria loja.

A mensagem é montada conforme o documento aberto:

- termos: dúvida sobre os termos de uso;
- privacidade: solicitação relacionada a dados pessoais;
- cookies: dúvida sobre cookies e preferências.

A origem do número respeita a ordem pública já usada no catálogo:

1. `store.whatsapp.digits`;
2. `store.contacts.whatsapp_business`;
3. `store.phone_number`.

Nenhum número é inventado. Quando o contato não está disponível ou não é válido, o botão da loja não é renderizado.

### OptmaIdea

É mantido um canal separado para assuntos relacionados à infraestrutura técnica do OptmaMenu:

- `legal@optmaidea.com`

A separação evita direcionar à plataforma questões que pertencem à venda, ao preparo, à entrega e ao atendimento da loja.

## Cookies

Na política de cookies da loja permanece disponível a ação para reabrir o painel global de preferências:

- `optmamenu:open-cookie-preferences`

## Limites desta entrega

- nenhum chamado é persistido no backend;
- nenhuma nova tabela ou migração foi criada;
- não foi criada central de solicitações LGPD;
- os textos permanecem operacionais e sujeitos a revisão jurídica.

## Próxima evolução recomendada

Criar um fluxo autenticado ou tokenizado de solicitações de direitos do titular, com protocolo, status, prazo, responsável e trilha de auditoria. Essa evolução exige desenho de dados e autorização explícita para mudanças no banco.
