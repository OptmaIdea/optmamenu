# Portal do cliente — decisões após homologação E2E (2026-09-14)

## Evidência homologada

O fluxo físico de OTP via OptmaSMSGate foi homologado com sucesso no cardápio público:

- SMS recebido no aparelho real;
- código correto validado;
- código incorreto rejeitado com feedback de erro;
- sessão Supabase Auth criada corretamente;
- identidade `customer/store` resolvida corretamente;
- logout funcionando.

## Ajustes imediatos desta rodada

### Contraste da loja pública

A loja pública passa a iniciar em uma fronteira visual própria, em modo claro, sem herdar inadvertidamente o tema do painel administrativo ou do sistema operacional.

Além disso, a cor de texto configurada para o cabeçalho passa por verificação de contraste. Se a combinação configurada não atingir contraste mínimo de 4.5:1, o frontend escolhe automaticamente texto branco ou escuro, conforme o melhor contraste com a cor primária.

### Carrinho vinculado ao cliente

O carrinho autenticado não deve permanecer visível após logout.

Regra adotada:

1. durante a sessão autenticada, o carrinho é salvo em armazenamento local individualizado por `store_id + customer_id`;
2. ao sair, o carrinho ativo é ocultado/limpo da sessão pública;
3. ao entrar novamente com o mesmo cliente na mesma loja, o carrinho individual é restaurado;
4. outro cliente no mesmo navegador não recebe o carrinho do cliente anterior;
5. antes da revalidação da sessão após recarregar a página, o carrinho autenticado anterior não é exibido;
6. itens escolhidos como visitante antes do login passam a pertencer ao cliente que acabou de se autenticar.

Esta implementação é local ao navegador. Persistência entre dispositivos fica para uma evolução posterior, caso desejada.

## Regra de autenticação definida

A direção de produto fica formalizada assim:

- OTP por SMS é obrigatório para confirmar o telefone no cadastro;
- o login normal deve ser feito por telefone + senha;
- o mesmo navegador/dispositivo poderá entrar apenas com senha enquanto a prova OTP estiver válida;
- nova confirmação OTP deve ser exigida quando ocorrer qualquer uma das condições:
  - 30 dias desde a última confirmação OTP do dispositivo;
  - 15 dias ou mais sem acesso do cliente;
  - novo navegador/dispositivo;
  - redefinição de senha;
  - troca de telefone;
  - ação sensível que exija step-up de autenticação.

Backend preparatório criado nesta rodada:

- `customer_auth_trusted_devices`;
- `customer_auth_password_challenges`;
- `customer_set_password_service_safe`;
- `customer_verify_password_service_safe`;
- `customer_trust_device_service_safe`;
- `customer_touch_trusted_device_service_safe`.

Essas primitivas são `service_role` only e não reabrem os RPCs públicos legados de autenticação.

**Importante:** a UX de login por senha + step-up OTP ainda não deve ser considerada concluída enquanto o Edge Function e a interface pública não estiverem ligados a essas primitivas e homologados fisicamente. O fluxo OTP-only continua sendo o comportamento de produção/homologação até essa troca ser fechada.

## Endereços — requisito preservado para C4

O cliente poderá manter no máximo **3 endereços de entrega salvos**.

Além desses endereços persistentes, o checkout deverá aceitar **um endereço provisório de entrega**, válido apenas para aquele pedido, sem obrigar o cliente a salvá-lo no cadastro.

Diretrizes:

- endereço provisório não conta no limite de 3;
- o cliente escolhe explicitamente se deseja transformar o endereço provisório em endereço salvo;
- o endereço usado no pedido deve permanecer registrado no snapshot do pedido, mesmo se o cliente editar/excluir o endereço salvo depois.

## Cartão — requisito de estudo e segurança

Não armazenar PAN completo, CVV/CVC ou equivalente diretamente no OptmaMenu.

A solução a estudar deve usar tokenização/cofre do provedor de pagamentos. O OptmaMenu deve guardar apenas identificadores/token do provedor e metadados não sensíveis necessários para reconhecimento, por exemplo bandeira e últimos 4 dígitos.

Requisitos de produto:

- salvar cartão somente com consentimento explícito do cliente;
- permitir revogar o consentimento e excluir o vínculo/token salvo;
- administradores e operadores nunca devem visualizar o número completo nem código de segurança;
- segredos/tokenização devem permanecer no backend/provedor, nunca em `localStorage`;
- antes de implementar, validar o modelo específico do provedor escolhido e o impacto de PCI DSS/LGPD.

Este item permanece fora da rodada atual e deve ser tratado como frente própria de pagamentos/tokenização.
