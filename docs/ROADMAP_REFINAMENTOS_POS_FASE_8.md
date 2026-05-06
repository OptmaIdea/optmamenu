# Roadmap de refinamentos após a Fase 8

## Ajustes finos operacionais

- Corrigir cards de venda na Vida do Produto e Movimentações:
  - `Destino` deve mostrar nome do cliente;
  - `Ref.` deve mostrar `order_code` amigável `PED-...`;
  - evitar UUID truncado quando houver código amigável.
- Verificar inclusão de vendas concluídas em Atividades recentes.
- Limpeza controlada de reservas antigas de testes.
- Habilitar botões “Nova entrada” e “Nova saída” no Livro de Caixa.

## Entrega e logística

- Configurar taxa de entrega por km.
- Configurar meio de transporte.
- Criar regras avançadas por bairro/região/distância.
- Evoluir pedido mínimo por método de entrega.

## QR/Garçom digital

- Gerar QR Codes reais por mesa/comanda.
- Criar área administrativa para impressão/baixar QR.
- Definir se pedido de mesa finaliza por WhatsApp, login de cliente ou outro canal.

## Fidelidade avançada

- Unificar `/admin/loyalty` e `/admin/loyalty/advanced`.
- Configurar níveis Bronze, Prata, Ouro, Esmeralda e Black:
  - ativo/inativo;
  - cor;
  - nome;
  - pontos mínimos;
  - multiplicador;
  - benefícios.
- Bônus de adesão por aceite no programa.
- Bônus por atingir nível pela primeira vez.
- Expiração de pontos.
- Multiplicador por categoria/produto.
- Sistema de selos por compras.
- Tela de prêmios e resgates.
- Tela de clientes ativos com saldos e extratos.
- Termos legais e aceite.
- Limpeza da lógica antiga de fidelidade no front.

## Marketing e mensagens

- Melhorar fluxo manual com fila de WhatsApp.
- Avaliar Telegram Bot/canal depois que app estiver rodando.
- Planejar atendimento automático por WhatsApp via n8n ou módulo próprio.
- Considerar push notifications.
- Reaproveitar `/admin/messages-admin` para mensagens operacionais/não promocionais.

## Relatórios e documentos

- Relatórios gerenciais em PDF.
- Exportação PDF em fornecedores, compras, cotações, transferências e manuais operacionais.
- Manual operacional para lojistas.

## Governança e expansão

- Fase 9: usuários, permissões, senhas e aprovações.
- Configuração total do sistema pelo lojista.
- Superadmin.
- Multiusuários/multilojas.
- Exclusividade e personalização de slug.
- Produtos por grupo empresarial/fábrica.
- Código geral de produto para uso por lojas e conferência/importação de romaneios.
- Módulo próprio de OTP.
- Estratégia offline/localStorage para conexão ruim.
- BI e fiscal em etapas futuras.
- Possível migração para SQL próprio/servidor pequeno e barato.
