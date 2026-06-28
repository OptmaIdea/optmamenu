# Fase 9 — Closeout geral

## Status

Concluída tecnicamente.

Este documento consolida o encerramento geral da Fase 9 do OptmaMenu.

## Escopo fechado

A Fase 9 consolidou:

- Usuários;
- Governança;
- Permissões;
- Segurança;
- Configurações;
- Realtime;
- Supabase Advisors / Hardening.

## Permissões

Modelo consolidado:

```txt
owner > all > override individual > custom role > base/template role > fallback false
```

Comportamento validado:

- `view=false` oculta menu, aba, rota e bloqueia acesso direto;
- `manage=false` mantém a tela em modo leitura, com campos desabilitados e ações ocultas;
- `security.view` é a porteira absoluta do módulo Segurança.

## Segurança e usuários

Foram consolidados:

- membros por loja;
- convites;
- papéis;
- funções personalizadas;
- permissões individuais;
- matriz de permissões;
- ações sensíveis;
- logs;
- histórico;
- senha master;
- idle timeout;
- contexto de sessão.

## Configurações

Configurações e Segurança foram separadas no sidebar.

Configurações passou a concentrar ajustes operacionais e comerciais, incluindo a base para Pedido Online, aparência, atendimento, mensagens e loja pública.

## Realtime

A fase consolidou padrões de versionamento e atualização para permissões, permitindo refletir mudanças administrativas com mais segurança.

## Supabase Advisors / Hardening

A subfrente 9.14 foi fechada.

Resultado principal:

- início: 184 funções `SECURITY DEFINER` executáveis por `authenticated`;
- final: 120 funções;
- redução: 64 funções removidas da superfície `authenticated`.

Também foram tratados:

- grants públicos indevidos;
- funções públicas intencionais;
- RLS em tabelas internas;
- RLS enabled sem policy;
- funções legadas/inativas;
- helpers sensíveis sem uso atual;
- exceções intencionais documentadas.

O aviso `Leaked Password Protection Disabled` permanece fora do escopo por decisão do projeto.

## Riscos residuais aceitos

Sem bloqueio para fechamento:

- algumas telas ainda podem receber refinamento fino de UX `manage=false`;
- alguns fluxos ainda podem evoluir de vínculo de loja para permissões granulares;
- funções comerciais com dados de cliente devem continuar recebendo hardening incremental;
- funções de estoque podem ampliar o uso de permissões granulares;
- Pedido Online ainda deve ganhar configuração mais completa.

## Pontas registradas para sequência

Próximas frentes recomendadas:

1. Revisão fina de UX `manage=false`;
2. Pedido Online / Configurações comerciais;
3. Clientes 360º / Vida do Cliente;
4. Fidelidade avançada;
5. Marketing, segmentos e campanhas;
6. QR Code por mesa/comanda;
7. Entrega por km e regras avançadas;
8. Exportações PDF/manuais;
9. Hardening granular contínuo.

## Decisão final

A Fase 9 fica tecnicamente fechada.

Critérios atendidos:

- governança de usuários implementada;
- permissões funcionais validadas;
- Segurança separada e protegida;
- Configurações organizadas;
- modo leitura `manage=false` padronizado;
- `view=false` validado como ocultação/bloqueio;
- Advisors auditados e consolidados;
- riscos residuais conhecidos e documentados.
