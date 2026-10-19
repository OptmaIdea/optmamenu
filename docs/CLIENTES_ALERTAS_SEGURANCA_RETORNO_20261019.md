# Clientes — continuação, alertas de segurança e limites SMS/OTP (19/10/2026)

## Baseline verificado

- Repositório `OptmaIdea/optmamenu`, branch `agent/homologacao-geral-20260820`.
- Supabase `lgkkfmqzaorrutuoqeax`, migrations de ledger imutável SMS/OTP e limpeza de 90 dias aplicadas.
- Vercel em homologação; confirmar CI / READY para o SHA do último commit desta rodada.
- O cancelamento/expiração de pedidos não foi reaberto após o aceite do usuário.

## Entrega pontual de Clientes / Segurança

A revisão das funções em produção identificou dois fatos:
1. O e-mail de **recuperação de senha** já trazia a logo da loja, mas o **aviso posterior de senha alterada** mostrava somente o nome.
2. A função `customer-auth-session`, na ação `set_password`, alterava a senha e revogava sessões, mas não enviava o aviso de segurança por Brevo. O envio ocorria apenas em `customer-password-recovery`.

Implementações:
- `supabase/functions/customer-password-recovery/index.ts`: aviso posterior de senha alterada usa `stores.logo_url` (somente HTTPS) e escapa conteúdo HTML; fallback para nome da loja.
- `supabase/functions/customer-auth-session/index.ts`: após atualização **com sucesso de senha já existente**, envia aviso transacional em HTML com branding da loja para e-mail **verificado**. Falha de Brevo não modifica a senha, apenas registra código genérico/estado no log, sem registrar endereço ou token. Cadastro inicial de senha não gera aviso de *alteração* indevido.
- Ambas as funções foram publicadas e conferidas contra o GitHub: `customer-password-recovery` versão **6** e `customer-auth-session` versão **13**, ambas `ACTIVE` e com conteúdo publicado idêntico ao versionado.

## Limites de SMS/OTP — sem alterações

- Permanece **3/10 minutos e 10/24 horas por telefone e loja**, com limite adicional global por número nas várias lojas.
- 15 cadastros em uma hora, em telefones diferentes, não esgotam uma quota coletiva de loja.
- Concorrência protegida em código por `pg_advisory_xact_lock`; **ensaio com dois clientes SQL independentes continua pendente**.
- Os testes de regressão com alteração administrativa de registros `customer_otps`, normalização e acesso negativo a tabelas já tinham passado; **não repetidos** nesta rodada.

## Validações e limite do aceite

- Confirmada paridade código GitHub/Edge Functions em produção e deploy das funções.
- Ainda **não foi disparado e-mail real** nesta rodada, para não alterar senha nem consumir OTP de clientes existentes.
- Critério de aceite: usando conta de teste com e-mail verificado, em `Minha conta → Segurança`, alterar a senha com a senha atual e confirmar duas entradas distintas no Brevo: se houver recuperação via e-mail, código de recuperação + aviso posterior; no fluxo de alteração normal, aviso de senha alterada com logo. Não repetir se o limite SMS estiver esgotado.
- Quando dispositivo era confiável e ainda dentro da validade, a recuperação preserva sua confiança; aparelho novo, revogado ou vencido requer SMS adicional por segurança. **Não remover o segundo fator sem nova evidência**.

## Pendências fora deste pacote

- Concluir prova real de concorrência SMS usando conexões SQL distintas com dados de teste.
- Confirmação da entrega transacional do e-mail de alteração de senha na Brevo (aplicação confirmada, entrega não inferida).
- Efetivação financeira dos cancelamentos pagos requer autorização do provedor e conciliação em Pedidos/Financeiro; não modificar por esta frente.
