# Fase 10 — Checkout público concluído e próxima etapa da loja

Data de fechamento: 31/07/2026
Branch: `agent/fase-10-loja-publica-blueprint`
Versão de referência: `0.10.0-rc.1`

## 1. Status da etapa

A frente de carrinho e checkout público foi considerada concluída para homologação externa com a Gelinhares.

Fluxo validado:

1. catálogo público por slug;
2. inclusão e edição de itens no carrinho;
3. aplicação visual das regras de preço por produto, categoria e grupo;
4. revisão final do pedido;
5. escolha entre entrega, retirada e contexto de mesa;
6. dados do cliente;
7. pagamento e troco;
8. CPF opcional;
9. observações;
10. validação autoritativa ao concluir;
11. criação do pedido;
12. abertura do WhatsApp;
13. acompanhamento público por token.

## 2. Regras de negócio consolidadas

### 2.1 Carrinho e estoque

Adicionar um produto ao carrinho não reserva estoque. A disponibilidade é validada novamente ao concluir o checkout.

Em caso de divergência de saldo, o pedido não é criado silenciosamente. O cliente recebe uma mensagem amigável e pode voltar ao carrinho para revisar os itens.

### 2.2 Entrega e retirada

A entrega exige endereço válido. O CEP aparece primeiro e ajuda a preencher logradouro, bairro, cidade e UF. O cliente ainda pode corrigir os dados manualmente.

Quando o endereço não possui número, a opção `Sem número` grava `S/N` e torna o complemento obrigatório.

A geolocalização é opcional e complementar. Em HTTP por IP local, o navegador pode bloquear a API; em HTTPS, pode solicitar permissão normalmente.

Pedidos de entrega aceitos pela loja não expiram automaticamente. Expiração operacional é admitida para retirada e para reservas técnicas ainda não aceitas ou não pagas.

### 2.3 Pagamento

O checkout já prepara as opções:

- Pix antecipado;
- Pix no recebimento;
- dinheiro;
- cartão no recebimento;
- link de pagamento.

No estágio atual, a escolha detalhada ainda é registrada nas observações enquanto o backend permanece compatível com o método autoritativo existente.

Dinheiro permite informar necessidade de troco e valor de referência.

### 2.4 Persistência local

Nome, telefone, endereço, pagamento, CPF e observações ficam salvos no navegador por loja até a conclusão do pedido ou limpeza dos dados do site.

O esvaziamento do carrinho não remove os dados do checkout.

### 2.5 Telefone

A validação brasileira aceita pontuação, DDD, prefixo `55`, `+55` e zero inicial em entradas comuns. Telefones internacionais usam DDI separado e número sem DDI.

A validação sintática não garante que o telefone tenha conta ativa no WhatsApp. Isso reforça a necessidade futura de comunicação interna no aplicativo e mecanismos de confirmação de contato.

### 2.6 Acompanhamento público

A página pública por token exibe:

- loja;
- número e código completo do pedido;
- status;
- itens;
- valores;
- modalidade;
- pagamento;
- data;
- retorno ao cardápio.

O rodapé institucional usa:

- OptmaMenu: `https://optmamenu.optmaidea.com.br`;
- OptmaIdea: `https://optmaidea.com.br`.

## 3. Texto-base para o manual do cliente

### Como o cliente finaliza um pedido

1. O cliente adiciona produtos ao carrinho.
2. O sistema apresenta o preço aplicado e os descontos disponíveis.
3. Em `Finalizar pedido`, o cliente escolhe entrega ou retirada.
4. Para entrega, começa pelo CEP e completa o endereço.
5. Informa nome e telefone.
6. Escolhe a forma de pagamento e, no caso de dinheiro, informa se precisa de troco.
7. Pode incluir CPF e observações.
8. Revisa o resumo.
9. O botão final só é liberado quando os dados obrigatórios estão válidos.
10. Ao concluir, o sistema valida novamente preços e estoque.
11. O pedido é criado e o WhatsApp é aberto com o link de acompanhamento.

### Observações operacionais para o lojista

- itens no carrinho ainda não estão reservados;
- divergências de estoque são tratadas antes da criação definitiva;
- pedidos de entrega aceitos exigem conclusão ou cancelamento justificado;
- pedidos para retirada podem ter prazo e expiração configuráveis;
- telefone inválido ou sem WhatsApp pode impedir o contato externo, por isso a comunicação interna será evoluída;
- entrega, taxas e pagamentos serão conectados às regras configuráveis da loja em etapa própria.

## 4. Formas oficiais de venda

O OptmaMenu passa a reconhecer quatro frentes de venda:

1. Venda Direta — módulo comercial administrativo;
2. PDV — operação presencial completa;
3. Mesa/Garçom — fluxo específico a ser consolidado na próxima etapa;
4. Slug/Loja Pública — catálogo, carrinho, checkout e acompanhamento público.

Cada frente pode compartilhar o motor autoritativo de preço, estoque, pedidos e financeiro, mas terá regras de experiência e operação próprias.

## 5. Próxima etapa: loja pública propriamente dita

### 5.1 Base legal e consentimento

- banner de cookies com escolhas claras;
- termos de uso;
- política de privacidade;
- política de cookies;
- registro da aceitação dos termos quando houver conta;
- conteúdo por loja quando necessário e conteúdo geral da plataforma quando comum.

### 5.2 Catálogo

- manter a base atual;
- retirar do modal do produto perguntas de pagamento, entrega e dados pessoais, pois o checkout concentra essas decisões;
- reforçar busca, categorias, promoções e descoberta;
- incluir aviso de poucas unidades disponíveis;
- criar o modal `Saiba mais` para promoções por quantidade;
- preservar navegação rápida e mobile-first.

### 5.3 Área logada do cliente

- dados pessoais;
- consentimentos e termos aceitos;
- programa de fidelidade quando aceito;
- histórico de pedidos e compras;
- itens e categorias mais comprados;
- produtos favoritos e recompra rápida;
- mini dashboard pessoal;
- suporte ligado ao pedido.

### 5.4 Preferências locais de consumo

Permitir que o cliente informe preferências como:

- sem lactose;
- evitar abacaxi;
- alergia a cacau;
- outras restrições ou preferências.

Esses dados não devem ser enviados ao backend nesta primeira versão. Devem ficar somente no dispositivo, com aviso explícito de que servem apenas para filtrar e sugerir produtos.

O sistema não deve apresentar essas sugestões como recomendação médica nem garantir ausência de contaminação cruzada. Informações de alergênicos precisam continuar vindo do cadastro oficial do produto.

### 5.5 Institucional e divulgação

- história e identidade da loja;
- horários;
- formas de contato;
- redes sociais;
- endereço e mapa;
- promoções;
- fidelidade;
- termos e políticas;
- perguntas frequentes;
- rodapé completo e configurável.

A loja pública deve funcionar como presença digital mínima do lojista, sem depender de templates excessivos. Um site completo e hospedagem personalizada podem virar add-on futuro.

### 5.6 PWA e atalho por slug

Cada slug deve poder oferecer instalação como webapp, com identidade da loja quando tecnicamente viável. Antes de um aplicativo nativo, a prioridade recomendada é consolidar a experiência PWA por ser mais simples de manter, publicar e atualizar.

## 6. Decisões de layout

### 6.1 Modal do produto

Direção recomendada:

- celular: tela quase inteira ou `bottom sheet` alto, com fechamento evidente e botão de ação fixo;
- desktop/tablet: modal central com pequenas bordas, largura limitada e contexto visual preservado.

Evitar modal totalmente colado às bordas no desktop. No celular, pequenas margens podem ser mantidas apenas quando não reduzirem a área útil nem criarem sensação de janela minúscula.

### 6.2 FAQ e ajuda

Estrutura em duas camadas:

1. ajuda geral do OptmaMenu para conta, privacidade, pagamentos, pedidos e uso da plataforma;
2. ajuda da loja para horário, entrega, retirada, promoções, fidelidade, contato e políticas próprias.

Problemas de um pedido devem partir do próprio pedido, não de uma página genérica.

## 7. Tendências de produto e layout observadas para 2026

- jornada integrada entre descoberta, entrega, retirada e fidelidade;
- personalização por contexto e histórico, sem esconder as regras do usuário;
- redução da sobrecarga de escolha com coleções e sugestões relevantes;
- recompra rápida e atalhos para favoritos;
- identidade visual forte da loja, em vez de catálogo genérico;
- conteúdo institucional e de comunidade que valoriza o comércio local;
- PWA instalável e experiência consistente entre canais;
- suporte ligado diretamente ao pedido;
- transparência de estoque, prazo, taxas e disponibilidade;
- acessibilidade, tipografia legível, grandes áreas de toque e navegação simples;
- uso prudente de IA para descoberta e recomendações, sem substituir informação objetiva do produto.

## 8. Pendências preservadas

- revisão ampla das mensagens automáticas;
- regras de entrega e taxas;
- pagamentos configuráveis;
- prazo limite para aceitar pedidos antes do fechamento;
- operação separada de entrega e retirada;
- tela administrativa das regras de cobertura;
- modal `Saiba mais` das promoções por quantidade;
- comunicação interna do pedido;
- confirmação ou verificação de contato;
- poucas unidades disponíveis;
- regras completas de mesa/garçom.

## 9. Critério para publicação externa

Antes de enviar ao parceiro da Gelinhares:

1. atualizar a branch;
2. executar `npm run build`;
3. publicar preview ou produção;
4. testar a slug pública em desktop e celular;
5. criar um pedido real de entrega e um de retirada;
6. validar WhatsApp e acompanhamento;
7. confirmar que o rodapé usa os domínios públicos corretos;
8. coletar feedback sem alterar a regra autoritativa de estoque e preço.
