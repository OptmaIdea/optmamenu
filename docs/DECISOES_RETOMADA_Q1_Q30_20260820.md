# Decisões de retomada Q1–Q30 — OptmaMenu

**Data:** 20/08/2026  
**Origem:** respostas do mantenedor ao questionário `QUESTIONARIO_RETOMADA_GERAL_OPTMAMENU_20260820`.

Este arquivo preserva as decisões de produto da retomada. Ele deve ser consultado junto com `MASTER_RETOMADA_HOMOLOGACAO_OPTMAMENU_20260820.md` antes de alterar arquitetura, onboarding, autenticação, dados sensíveis, financeiro, PWA ou critérios de release.

## Decisões

1. **Branch/PR:** encerrar PR #7 e seguir em branch específica de homologação geral.
2. **HML:** usar o Supabase atual com loja explicitamente identificada como homologação.
3. **Massa HML:** preservar temporariamente; depois remover dados de teste, mantendo cadastros úteis de categorias/produtos. Testar reaproveitamento desses cadastros em outra loja do grupo por clone/import seguro.
4. **Signup owner:** e-mail+senha → confirmação de e-mail → criação de loja → onboarding → slug → primeiro local → `/admin`.
5. **E-mails:** incluir confirmação/auth, boas-vindas, convite, alteração de e-mail, reset de senha, segurança, encerramento e despedida.
6. **Encerramento:** inativação reversível por 10 dias; entre D+10 e D+20 enviar aviso de reativação/backup; exclusão definitiva após prazo e obrigações legais/fiscais.
7. **Identidade:** logo da empresa é interna; logo da slug é pública; unidades/slugs podem ter logos próprias.
8. **Slug ocupada:** sugerir alternativa disponível.
9. **Papéis:** manter papéis atuais nesta rodada.
10. **Permissões:** papel fornece baseline; override individual pode acrescentar/retirar sem alterar template.
11. **Perfil interno:** nome, e-mail, telefone, alias, foto, nascimento, endereço, cargo/função, preferências de notificação, redes sociais fixas comuns, site pessoal e dois campos livres extras. Dados de saúde ficam condicionados a política específica por serem sensíveis.
12. **Alteração de dados:** proprietário sempre pode aprovar; outros somente com permissão explícita.
13. **OTP interno:** validar telefone de funcionário e desenhar OTP/step-up também para usuários internos; sem duplicidade de e-mail/telefone na mesma loja.
14. **Consumidor Final:** cliente genérico padrão para venda sem identificação; dados informados ficam no snapshot/documento da venda.
15. **Cadastro automático:** nunca transformar snapshot de venda em cliente automaticamente. Cadastro exige ação explícita; cliente de slug se cadastra voluntariamente com termos.
16. **Customer auth:** senha + OTP.
17. **Pedidos anteriores:** não vincular retroativamente pedidos visitantes à conta criada depois.
18. **Raspadinha:** campanha promocional independente, podendo conceder pontos, cupom, produto ou mensagem/prêmio.
19. **Financeiro:** `Saldos por conta` entra antes da área logada do cliente.
20. **Histórico financeiro sem conta:** não inferir/classificar automaticamente; exibir `Não distribuído` e permitir consulta/classificação manual auditada.
21. **PWA:** shell administrativo OptmaMenu + PWA próprio por slug. Identidade pública pertence ao lojista. Domínio customizado fica posterior, com placeholder de tela agora.
22. **Atendente IA:** opcional por loja, estritamente grounded em fontes autorizadas e contratos atuais, com handoff humano.
23. **Consentimentos:** separados por SMS, WhatsApp, push, e-mail e mensageiros futuros; operacional separado de marketing.
24. **Novo pedido:** alerta visual persistente + som configurável + push opcional; suportar cenário de celular/tablet e futura tela/TV dedicada.
25. **Antigravity:** fornecer protocolo/script para diagnóstico e testes autônomos.
26. **Matriz mínima:** Chrome desktop, Firefox desktop, Android/Chrome, iPhone/Safari quando disponível, tablet Android e larguras intermediárias. Edge e iPad não são obrigatórios nesta rodada.
27. **Offline:** objetivo inclui operação offline/degradada para PDV/estoque, com limites de consistência explicitados.
28. **Fiscal:** CPF/CNPJ e snapshots + documento auxiliar não fiscal; NF-e/NFC-e/DANFE ficam futuros.
29. **Import/bootstrap:** incluir nesta rodada. PDF deve priorizar templates HTML/CSS/print gratuitos e leves.
30. **Gate parceiro:** build/deploy limpo, console sem erro relevante, testes críticos, nova loja completa, estoque/comercial/financeiro reconciliados, permissões por papel, slug/carrinho/checkout responsivos e limitações conhecidas documentadas.

## Recomendações arquiteturais associadas

Estas são recomendações técnicas, não novas decisões de produto:

- funcionários devem continuar usando **Supabase Auth** como identidade/sessão; OptmaSMSGate deve validar celular e fornecer OTP/step-up, em vez de criarmos armazenamento próprio de senha de funcionário;
- categorias/produtos compartilhados entre lojas devem ser clonados/importados com novos IDs e ownership correto; não mover `store_id` de registros existentes;
- tipo sanguíneo/alergias de funcionário não devem ser coletados por padrão sem finalidade, base legal, acesso e retenção próprios;
- PWA/offline deve usar fila local idempotente e nunca apresentar operação crítica como confirmada antes do ACK do servidor;
- documento auxiliar em PDF deve começar por HTML/CSS de impressão + Print to PDF do navegador.
