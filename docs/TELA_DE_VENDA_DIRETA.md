Estamos dando sequência ao projeto OptmaMenu.

Antes de alterar qualquer arquivo, leia e considere o contexto dos arquivos/documentos abaixo:

- `.antigravity/skills/MEMORY.md`
- `docs/README.md`
- `docs/CRONOGRAMA_LANCAMENTO_2026_08_01.md`
- `docs/POS_9_MODELO_VENDAS_PEDIDOS_MESA_BALCAO_SLUG.md`
- `docs/POS_9_PDV_MOBILE_FIRST_DIRETRIZ.md`
- `docs/POS_9_VENDA_DIRETA_CLIENTE_EXISTENTE.md`
- `docs/POS_9_VENDA_DIRETA_BALCAO_E_PEDIDOS.md`
- `docs/POS_9_VENDA_DIRETA_DESCONTOS_ATACADO_2_DESCONTO_MANUAL_E_PRICE_RULES.md`

Contexto atual validado:

- A tela `/admin/direct-sales` já funciona.
- Venda direta salva venda, gera pedido e alimenta dashboard comercial.
- Build estava ok e console limpo nas validações anteriores.
- A tela já possui:
  - seleção de produto;
  - busca/filtro/ordenação de produtos;
  - quantidade;
  - desconto adicional;
  - regra de desconto por quantidade;
  - carrinho agrupando produtos repetidos;
  - botões para aumentar/diminuir quantidade;
  - remover item;
  - alterar/zerar desconto adicional;
  - seleção de cliente existente;
  - Cliente de balcão como default;
  - tentativa de vínculo com cliente operacional “Cliente de balcão” quando existir;
  - forma de pagamento amigável;
  - criação via `DirectSalesService.createAdminDirectSale`.

Não quebrar esses comportamentos.

Objetivo desta etapa:

Criar uma primeira versão de **PDV rápido mobile-first** para venda balcão, sem substituir a tela atual de venda direta.

A ideia é manter a tela atual como fluxo administrativo funcional e adicionar nela um botão para abrir o novo modo:

- “Abrir PDV rápido”
- ou “Modo balcão / PDV”

Ao clicar, abrir uma experiência visual em **modal grande/fullscreen**, parecida com um aplicativo de PDV/cardápio mobile:

- no desktop: modal grande central ou painel fullscreen;
- no mobile: fullscreen modal;
- no tablet: layout de app/painel.

Importante:

Não criar schema novo.
Não criar migration.
Não alterar RPC agora.
Não alterar permissões.
Não alterar a tela `/admin/orders`.
Não mexer em fluxo de slug/delivery agora.
Não implementar mesa/comanda funcional ainda.
Não implementar favoritos, mais vendidos, badge de promoção ou badge de desconto agora; apenas deixar anotado como futuro.

O foco imediato é apenas criar a camada visual/operacional do PDV rápido reaproveitando a lógica já existente da tela `/admin/direct-sales`.

Arquivos principais prováveis:

- `src/pages/private/admin/commercial/directSales/DirectSalesPage.tsx`
- `src/services/directSalesService.ts`

Preferência de implementação:

Se possível, criar componentes novos para não inflar demais `DirectSalesPage.tsx`, por exemplo:

- `src/pages/private/admin/commercial/directSales/components/QuickPosModal.tsx`
- `src/pages/private/admin/commercial/directSales/components/QuickPosProductCard.tsx`
- `src/pages/private/admin/commercial/directSales/components/QuickPosCartSheet.tsx`

Se a estrutura de componentes do projeto indicar outro padrão, seguir o padrão existente.

Requisitos do PDV rápido — primeira versão:

## 1. Botão para abrir o PDV rápido

Na tela `/admin/direct-sales`, adicionar botão destacado:

- “Abrir PDV rápido”

Esse botão deve abrir o modal/fullscreen do PDV.

A tela atual deve continuar funcionando exatamente como antes.

## 2. Modal/fullscreen

O PDV rápido deve abrir como uma camada por cima da tela atual.

Requisitos:

- botão de fechar/voltar;
- título claro, por exemplo “PDV rápido”;
- modo inicial: “Balcão”;
- não navegar para outra rota nesta primeira versão;
- não perder dados da tela atual se o modal for fechado, a menos que isso simplifique muito;
- evitar mexer em layout global.

Sugestão visual:

- fundo claro, limpo e com cards;
- mobile-first;
- botões grandes;
- alta legibilidade;
- carrinho sempre acessível.

## 3. Modos de venda

Nesta primeira versão, exibir um seletor visual simples com:

- Balcão
- Mesa
- Retirada

Mas comportamento funcional:

### Balcão
Ativo e funcional.
Usa a mesma lógica atual de venda direta.

### Mesa
Pode aparecer como opção desabilitada ou com badge “em breve”.
Não implementar comanda agora.

### Retirada
Pode se comportar igual a balcão por enquanto ou aparecer como opção futura, mas não deve quebrar a RPC.

Não incluir Delivery como fluxo principal do PDV neste momento.

Diretriz de negócio:
Delivery deve preferencialmente vir pelo slug/catálogo online. O PDV rápido não deve incentivar delivery manual agora.

## 4. Produtos em cards

Dentro do PDV rápido, exibir produtos em cards clicáveis.

Cada card deve mostrar:

- nome do produto;
- preço;
- categoria, se disponível;
- botão `+` para adicionar;
- destaque simples se houver desconto por quantidade aplicável, mas sem criar badge avançado agora.

Não exigir imagem agora, pois nem todos os produtos podem ter imagem válida.

Se houver imagem disponível e for fácil reaproveitar, exibir; caso contrário, manter card textual bonito.

## 5. Filtros e ordenadores

Toda tela nova com lista deve nascer com filtro e ordenador.

No PDV rápido, incluir:

- busca por produto/categoria;
- filtro por categoria;
- ordenador:
  - Nome A-Z;
  - Nome Z-A;
  - Menor preço;
  - Maior preço;
  - Categoria.

Pode reaproveitar a lógica já criada em `DirectSalesPage.tsx`.

## 6. Carrinho fixo / bottom bar

No mobile, exibir uma barra fixa no rodapé do modal:

Exemplo:

```txt
🛒 3 itens | Ver carrinho | R$ 42,50

No desktop, pode ser lateral ou bottom bar, conforme mais simples.

A barra deve ter:

quantidade total de itens;
total final;
botão “Ver carrinho” ou área clicável para abrir o carrinho.
7. Carrinho em bottom sheet ou painel

Ao clicar em “Ver carrinho”, abrir uma área de carrinho no próprio modal.

Pode ser:

bottom sheet no mobile;
painel lateral no desktop;
ou seção expansível simples, se for mais seguro.

O carrinho deve permitir:

ver itens agrupados;
aumentar quantidade;
diminuir quantidade;
remover item;
alterar desconto adicional;
zerar desconto adicional;
mostrar:
subtotal bruto;
desconto por quantidade;
desconto adicional;
total final.

Reaproveitar a lógica já existente do carrinho atual.

8. Cliente e pagamento

Nesta primeira versão do PDV rápido:

Cliente default: Cliente de balcão;
telefone opcional;
forma de pagamento com dropdown usando store_payment_methods;
permitir selecionar cliente existente se já estiver simples reaproveitar;
se isso deixar o modal complexo demais, manter Cliente de balcão e forma de pagamento primeiro, e deixar seleção de cliente existente na tela administrativa atual.

Importante:
Não forçar telefone para Cliente de balcão.

Regra de negócio:
Se o cliente quiser promoções, fidelidade ou campanhas, ele deve se cadastrar/conceder permissões. O PDV balcão não deve forçar esse cadastro.

9. Concluir venda

O botão principal deve ser muito claro:

“Concluir venda”

Deve chamar o mesmo fluxo já validado:

DirectSalesService.createAdminDirectSale

Deve enviar os mesmos dados essenciais:

storeId;
items;
customerId quando aplicável;
customerName;
customerPhone;
paymentMethodCode;
salesChannel: direct;
fulfillmentType: in_person;
metadata indicando origem, por exemplo:
source: 'quick_pos_modal';
mode: 'counter'.

Após sucesso:

mostrar toast de sucesso;
limpar carrinho do PDV rápido;
exibir código do pedido gerado;
não redirecionar automaticamente.
10. Segurança

Preservar:

rota protegida por orders.manage;
nenhuma alteração de permissões;
nenhuma alteração de RLS/RPC;
nenhuma alteração no catálogo de permissões.
11. Não quebrar tela atual

A tela atual /admin/direct-sales deve continuar funcionando com:

fluxo administrativo;
filtros atuais;
carrinho atual;
seleção de cliente;
desconto adicional;
forma de pagamento;
concluir venda.

O novo PDV rápido deve ser uma camada adicional, não substituição.

12. Documentação

Criar documento curto:

docs/POS_9_PDV_RAPIDO_MODAL_1.md

Registrar:

objetivo;
arquivos alterados;
comportamento;
limitações;
o que ficou para depois;
checklist de validação.
13. Validação obrigatória

Depois das alterações, rodar:

npm run build

Validar manualmente:

/admin/direct-sales abre normalmente.
A tela atual continua funcionando.
Botão “Abrir PDV rápido” aparece.
Modal abre e fecha.
Busca/filtro/ordenação de produto funciona no modal.
Produto adiciona ao carrinho pelo botão +.
Produto repetido agrupa.
Quantidade aumenta/diminui.
Carrinho mostra subtotal, descontos e total.
Forma de pagamento é selecionável.
Venda conclui com sucesso.
Pedido é gerado.
Dashboard comercial recebe venda.
Console permanece limpo.
Mobile/responsivo não quebra.
14. Futuro — apenas anotar, não implementar agora

Registrar como futuro:

favoritos;
mais vendidos;
badge de promoção;
badge de desconto por quantidade;
modo mesa/comanda completo;
QR de mesa público;
PWA/quiosque;
recibo/impressão;
histórico de vendas separado de Pedidos.
15. Cuidados finais

Antes de alterar, verifique o estado atual do arquivo para não sobrescrever commits recentes.

Se a alteração ficar grande demais, prefira entregar em partes:

Parte 1

Criar botão + modal vazio com layout base.

Parte 2

Adicionar cards de produtos + filtros.

Parte 3

Adicionar carrinho.

Parte 4

Conectar concluir venda.

Priorize estabilidade sobre velocidade.

Não mexer diretamente na RPC se não for necessário.

Não alterar comportamento da tela Pedidos.

Não transformar Pedidos em histórico de vendas.

Comece implementando a Parte 1 e Parte 2 se considerar mais seguro.


---

## Observação importante

Eu recomendo mesmo fazer em partes, nessa ordem:

```txt
1. botão + modal fullscreen abrindo/fechando
2. cards de produto com busca/filtro/ordem
3. carrinho visual
4. concluir venda usando o service atual

Assim você reduz muito o risco de quebrar a venda direta atual.

A ideia central é:

Tela atual = administrativa e segura
PDV rápido = operacional, mobile-first e intuitivo

E os dois convivem sem conflito.