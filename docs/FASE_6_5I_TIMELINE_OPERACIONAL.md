# Fase 6.5I — Timeline operacional e auditoria leve

## 1. Objetivo

Explicar a criação da camada `operational_timeline_events` como uma linha do tempo amigável para processos operacionais.

## 2. Diferença entre audit_logs e operational_timeline_events

### audit_logs

Auditoria geral/técnica.

Usada para registrar ações de baixo nível, alterações de dados, rastreabilidade interna e logs menos amigáveis.

### operational_timeline_events

Linha do tempo operacional.

Usada para telas, processos, acompanhamento gerencial e histórico legível de cotações, compras, transferências, movimentações e fornecedores.

## 3. Entidades cobertas

- Cotações
- Compras
- Transferências
- Movimentações de estoque
- Fornecedores
- Produtos
- Futuras vendas/devoluções

## 4. Padrão de códigos operacionais

- `COT-...` para cotações
- `ENT-...` para documentos de compra/entrada
- `TRF-...` para transferências

## 5. Eventos implementados

### Cotações

- cotação criada
- canal definido
- cotação enviada
- canal alterado
- responsável alterado
- fornecedor respondeu
- cotação aprovada
- cotação rejeitada
- cotação cancelada
- cotação convertida em compra
- compra vinculada cancelada

### Compras

- compra criada
- compra confirmada
- compra aplicada ao estoque
- compra cancelada
- rascunho excluído

### Transferências

- transferência criada
- transferência enviada
- transferência recebida
- transferência cancelada

## 6. Campos importantes

- `store_id`
- `entity_type`
- `entity_id`
- `event_type`
- `title`
- `description`
- `severity`
- `status`
- `occurred_at`
- `actor_user_id`
- `channel`
- `old_data`
- `new_data`
- `metadata`
- campos relacionados: fornecedor, produto, cotação, compra, transferência e movimentação

## 7. View de consumo

`v_operational_timeline_events`

Responsável por:

- labels amigáveis;
- `reference_label`;
- labels de status/canal/severidade;
- normalização para telas;
- base para Atividades recentes.

## 8. Telas que consomem timeline

- detalhe/andamento da cotação;
- detalhe/andamento da compra;
- detalhe/andamento da transferência;
- Atividades recentes.

## 9. Datas e timezone

Padrão definido:

- timestamps operacionais devem ser gravados com `now()`;
- códigos operacionais podem usar horário de São Paulo para composição textual;
- frontend formata datas com helper centralizado;
- `issue_date` é data documental/fiscal, não data operacional.

## 10. Decisões de segurança

- views convertidas para `security_invoker`;
- RLS preservado;
- funções internas óbvias tiveram execução pública revogada;
- RPCs operacionais `SECURITY DEFINER` devem permanecer sob revisão controlada.

## 11. Pendências futuras

- hardening completo de RPCs `SECURITY DEFINER`;
- saneamento de datas da camada comercial/legada;
- expansão para vendas/devoluções;
- painel gerencial mais avançado de atividades.