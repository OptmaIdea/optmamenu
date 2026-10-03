# Checklist segmentado de homologação — OptmaMenu

**Data-base:** 20/08/2026  
**Branch:** `agent/homologacao-geral-20260820`

## Como usar

Cada item deve terminar com uma evidência quando executado: `PASS`, `FAIL`, `BLOCKED` ou `N/A`, acompanhada por screenshot, log, teste automatizado, SQL read-only ou referência de commit quando pertinente.

Antes de marcar `PASS`, validar comportamento visual, regra de negócio, persistência no banco e ausência de erro relevante no console.

---

## 2a — Cadastro de nova loja, signup, onboarding e identidade

- [ ] **H2A-001** Usar e-mail que não exista no Supabase Auth.
- [ ] **H2A-002** Abrir signup público sem sessão e validar layout desktop/mobile.
- [ ] **H2A-003** Testar PF com CPF válido.
- [ ] **H2A-004** Testar PJ com CNPJ válido.
- [ ] **H2A-005** Rejeitar CPF/CNPJ inválido sem enviar requisição desnecessária.
- [ ] **H2A-006** Rejeitar e-mail já utilizado com mensagem que não exponha informação sensível além do necessário.
- [ ] **H2A-007** Validar força/confirmar senha.
- [ ] **H2A-008** Confirmar `supabase.auth.signUp` e callback de e-mail.
- [ ] **H2A-009** Não criar loja antes de confirmar e-mail.
- [ ] **H2A-010** Confirmar e-mail e abrir etapa de criação da loja.
- [ ] **H2A-011** Criar empresa/loja de homologação claramente identificada.
- [ ] **H2A-012** Validar obrigatoriedade de razão/nome/fantasia conforme PF/PJ.
- [ ] **H2A-013** Gerar sugestão inicial de slug amigável.
- [ ] **H2A-014** Validar slug globalmente única no backend.
- [ ] **H2A-015** Tentar slug já ocupada e receber alternativas disponíveis.
- [ ] **H2A-016** Reservar/proteger aliases antigos quando slug for alterada, se regra atual assim definir.
- [ ] **H2A-017** Bloquear slug reservada/institucional.
- [ ] **H2A-018** Separar logo da empresa da logo pública da slug.
- [ ] **H2A-019** Fazer upload/alteração de logo administrativa.
- [ ] **H2A-020** Fazer upload/alteração de logo pública por slug/unidade.
- [ ] **H2A-021** Validar tamanho, MIME, extensão, limite e falha de upload.
- [ ] **H2A-022** Criar primeiro local de estoque no onboarding.
- [ ] **H2A-023** Definir local público da slug quando apropriado.
- [ ] **H2A-024** Finalizar onboarding e ir para `/admin`.
- [ ] **H2A-025** Atualizar página e garantir que onboarding não recomece indevidamente.
- [ ] **H2A-026** Fazer logout/login e voltar à loja correta.
- [ ] **H2A-027** Enviar e-mail de boas-vindas somente após ativação adequada.
- [ ] **H2A-028** Enviar convite de usuário com template correto.
- [ ] **H2A-029** Testar template de alteração de e-mail.
- [ ] **H2A-030** Testar reset de senha.
- [ ] **H2A-031** Testar aviso de alteração sensível de segurança.
- [ ] **H2A-032** Solicitar encerramento de conta e entrar em inativação reversível.
- [ ] **H2A-033** Garantir que conta inativada não continue operando normalmente.
- [ ] **H2A-034** Testar reativação dentro de 10 dias.
- [ ] **H2A-035** Testar aviso D+10 a D+20 com recomendação de backup.
- [ ] **H2A-036** Testar e-mail de despedida somente na exclusão definitiva.
- [ ] **H2A-037** Bloquear exclusão definitiva quando houver obrigação de retenção legal/fiscal.
- [ ] **H2A-038** Exportar/baixar dados permitidos antes da exclusão.
- [ ] **H2A-039** Verificar que planos pagos/benefícios não bloqueiam este onboarding.
- [ ] **H2A-040** Testar criação com rede lenta, refresh e callback duplicado sem duplicar loja.

---

## 2b — Usuários, permissões, login e área particular

- [ ] **H2B-001** Listar papéis atuais e congelar baseline desta rodada.
- [ ] **H2B-002** Criar usuário via convite.
- [ ] **H2B-003** Aceitar convite com usuário novo.
- [ ] **H2B-004** Aceitar convite com usuário que já pertence a outra loja.
- [ ] **H2B-005** Impedir e-mail duplicado dentro da mesma loja.
- [ ] **H2B-006** Impedir telefone normalizado duplicado dentro da mesma loja.
- [ ] **H2B-007** Resolver a ocorrência de telefone duplicado detectada na auditoria atual.
- [ ] **H2B-008** Validar telefone por OTP OptmaSMSGate no onboarding interno.
- [ ] **H2B-009** Manter Supabase Auth como identidade/sessão de funcionário.
- [ ] **H2B-010** Testar login/logout/refresh token/expiração de sessão.
- [ ] **H2B-011** Testar sessão expirada durante operação.
- [ ] **H2B-012** Ao logout, limpar estado de menu expandido.
- [ ] **H2B-013** Após novo login, iniciar em `/admin` conforme regra de landing.
- [ ] **H2B-014** Validar Home e atalhos por papel/permissão.
- [ ] **H2B-015** `view=false` deve ocultar menu/atalho/rota.
- [ ] **H2B-016** Acesso direto a rota sem `view` deve abrir 403 padrão.
- [ ] **H2B-017** 403 deve oferecer retorno claro para Início.
- [ ] **H2B-018** `manage=false` deve ser leitura real sem botões de alteração.
- [ ] **H2B-019** Testar template do papel sem override.
- [ ] **H2B-020** Adicionar permissão individual sem alterar template.
- [ ] **H2B-021** Retirar permissão individual sem alterar template.
- [ ] **H2B-022** Limpar overrides e voltar ao template.
- [ ] **H2B-023** Alterar papel e validar recomposição de permissões.
- [ ] **H2B-024** Bloquear usuário e invalidar acesso conforme regra.
- [ ] **H2B-025** Reativar usuário.
- [ ] **H2B-026** Registrar motivo/ocorrência de bloqueio/alteração.
- [ ] **H2B-027** Proprietário sempre poder revisar solicitações de alteração.
- [ ] **H2B-028** Usuário com permissão específica também poder revisar.
- [ ] **H2B-029** Usuário comum não poder revisar solicitação alheia.
- [ ] **H2B-030** Perfil: nome, e-mail, telefone, alias e foto.
- [ ] **H2B-031** Perfil: nascimento/endereço.
- [ ] **H2B-032** Cargo/função só alterável por autorizado quando aplicável.
- [ ] **H2B-033** Preferências de notificação.
- [ ] **H2B-034** Redes fixas comuns + site pessoal.
- [ ] **H2B-035** Dois campos sociais/livres adicionais.
- [ ] **H2B-036** Não coletar tipo sanguíneo/alergias nesta rodada sem política própria de dado sensível.
- [ ] **H2B-037** Padronizar um componente de spinner/loading.
- [ ] **H2B-038** Padronizar empty/error state.
- [ ] **H2B-039** Testar troca de loja/contexto para usuário multi-loja.
- [ ] **H2B-040** Garantir que gerente/operador não escape da loja autorizada.

---

## 2c — Estoque, produtos, categorias, fornecedores, compras e pricing

- [ ] **H2C-001** Criar/editar/desativar categoria.
- [ ] **H2C-002** Impedir exclusão destrutiva de categoria referenciada sem tratamento.
- [ ] **H2C-003** Criar produto com dados mínimos.
- [ ] **H2C-004** Criar produto com imagem, categoria e regras completas.
- [ ] **H2C-005** Editar produto com histórico/movimentos existentes.
- [ ] **H2C-006** Desativar produto e validar catálogo/PDV.
- [ ] **H2C-007** Configurar estoque global min/max.
- [ ] **H2C-008** Configurar min/max por local quando aplicável.
- [ ] **H2C-009** Fazer entrada manual/compra e conferir saldo físico.
- [ ] **H2C-010** Fazer ajuste positivo com motivo/auditoria.
- [ ] **H2C-011** Fazer ajuste negativo com saldo suficiente.
- [ ] **H2C-012** Bloquear ajuste negativo indevido conforme regra.
- [ ] **H2C-013** Fazer contagem física e verificar delta/auditoria.
- [ ] **H2C-014** Validar Vida do Produto com origem/destino/ref/document_code.
- [ ] **H2C-015** Cadastrar fornecedor PF/PJ conforme modelo disponível.
- [ ] **H2C-016** Validar Fornecedor 360º: contatos, compras, produtos, timeline.
- [ ] **H2C-017** Criar compra rascunho.
- [ ] **H2C-018** Confirmar/aplicar compra ao estoque.
- [ ] **H2C-019** Cancelar compra conforme regra de segurança.
- [ ] **H2C-020** Criar cotação, aprovar e converter.
- [ ] **H2C-021** Impedir conversão de cotação não aprovada.
- [ ] **H2C-022** Criar transferência manual.
- [ ] **H2C-023** Criar transferência a partir de sugestão.
- [ ] **H2C-024** Editar quantidade solicitada em transferência `draft`.
- [ ] **H2C-025** Remover item de transferência `draft`.
- [ ] **H2C-026** Adicionar item em transferência `draft`.
- [ ] **H2C-027** Impedir edição após envio.
- [ ] **H2C-028** Enviar transferência com saldo suficiente.
- [ ] **H2C-029** Saldo insuficiente deve gerar toast amigável sem UUID/erro relevante no console.
- [ ] **H2C-030** Receber transferência integral.
- [ ] **H2C-031** Receber com falta aceita.
- [ ] **H2C-032** Receber com perda/avaria.
- [ ] **H2C-033** Receber com retorno à origem.
- [ ] **H2C-034** Cancelar transferência antes do envio.
- [ ] **H2C-035** Estornar transferência recebida conforme permissão.
- [ ] **H2C-036** Preservar filtro da lista ao abrir detalhe e voltar.
- [ ] **H2C-037** “Enviadas por este local” mostrar destino.
- [ ] **H2C-038** “Recebidas neste local” mostrar origem.
- [ ] **H2C-039** Reservas ativas devem bater com `inventory_location_balances.reserved`.
- [ ] **H2C-040** Reserva expirada deve liberar saldo.
- [ ] **H2C-041** Cancelamento de pedido deve liberar reserva.
- [ ] **H2C-042** Confirmação deve consumir reserva sem sobra órfã.
- [ ] **H2C-043** Rodar reconciliação em modo dry/read-only e obter 0 divergências.
- [ ] **H2C-044** Testar dois checkouts disputando o último item.
- [ ] **H2C-045** Testar duas transferências disputando o mesmo saldo.
- [ ] **H2C-046** Criar grupo de pricing por categoria.
- [ ] **H2C-047** Criar grupo agregado com múltiplas categorias.
- [ ] **H2C-048** Validar desconto por quantidade combinada.
- [ ] **H2C-049** Validar precedência entre preço base e regras.
- [ ] **H2C-050** Registrar snapshot da regra/preço aplicada à venda.
- [ ] **H2C-051** Importar categorias/produtos em loja HML via preview.
- [ ] **H2C-052** Clonar alguns itens da Gelinhares para HML com novos IDs.
- [ ] **H2C-053** Garantir que estoque/preço da loja origem não sejam compartilhados involuntariamente.

---

## 2d — Comercial e clientes

- [ ] **H2D-001** Criar cliente PF administrativo.
- [ ] **H2D-002** Validar CPF e normalização de telefone.
- [ ] **H2D-003** Criar cliente PJ e mapear lacunas de CNPJ/razão social/inscrições.
- [ ] **H2D-004** Criar `Consumidor Final` genérico da loja.
- [ ] **H2D-005** PDV abrir com Consumidor Final como padrão.
- [ ] **H2D-006** Venda sem identificação não criar cliente novo.
- [ ] **H2D-007** Permitir nome de recibo no snapshot da venda.
- [ ] **H2D-008** Permitir CPF/CNPJ no snapshot da venda.
- [ ] **H2D-009** Permitir telefone/endereço no snapshot quando necessário.
- [ ] **H2D-010** Garantir que snapshot não altere/cadastre customer automaticamente.
- [ ] **H2D-011** Oferecer ação explícita `Cadastrar cliente` quando desejado.
- [ ] **H2D-012** Cliente criado administrativamente deve ser editável pela loja conforme regra.
- [ ] **H2D-013** Cliente criado por slug deve respeitar ownership/edição restrita.
- [ ] **H2D-014** Venda direta com cliente cadastrado.
- [ ] **H2D-015** Venda direta com Consumidor Final.
- [ ] **H2D-016** PDV com cliente PF.
- [ ] **H2D-017** PDV com cliente PJ.
- [ ] **H2D-018** Pedido por mesa/QR.
- [ ] **H2D-019** Pedido pela slug como visitante.
- [ ] **H2D-020** Pedido pela slug como cliente logado após H2I.
- [ ] **H2D-021** Origem comercial ser registrada: slug, mesa, PDV, venda direta etc.
- [ ] **H2D-022** Dashboard conseguir segmentar por origem/canal.
- [ ] **H2D-023** Documento auxiliar trazer identificação da venda e aviso `NÃO FISCAL`.
- [ ] **H2D-024** Não gerar DANFE/NF-e/NFC-e nesta rodada.
- [ ] **H2D-025** Canal B2B avançado permanecer sinalizado como futuro/premium, sem bloquear venda básica PJ.

---

## 2e — Venda, devolução, cancelamento, estoque e financeiro

- [ ] **H2E-001** Venda confirmada baixa estoque uma única vez.
- [ ] **H2E-002** Venda confirmada gera cashbook conforme pagamento.
- [ ] **H2E-003** Pagamento pendente gera pendência sem afetar saldo indevidamente.
- [ ] **H2E-004** Confirmar pendência e afetar saldo uma vez.
- [ ] **H2E-005** Retry da confirmação não duplica cashbook.
- [ ] **H2E-006** Retry da confirmação não duplica baixa de estoque.
- [ ] **H2E-007** Cancelar pedido ainda reservado libera reserva.
- [ ] **H2E-008** Cancelar venda já confirmada gera estorno de estoque conforme regra.
- [ ] **H2E-009** Cancelar venda já confirmada gera estorno financeiro auditável.
- [ ] **H2E-010** Devolução total repõe quantidade correta.
- [ ] **H2E-011** Devolução parcial repõe somente itens/quantidades devolvidos.
- [ ] **H2E-012** Devolução parcial calcula financeiro corretamente.
- [ ] **H2E-013** Estorno de fidelidade acompanha cancelamento/devolução quando aplicável.
- [ ] **H2E-014** Cancelamento repetido não duplica estornos.
- [ ] **H2E-015** Refresh no meio da finalização recupera estado real do servidor.
- [ ] **H2E-016** Perda de resposta após commit servidor não permite segunda venda duplicada.
- [ ] **H2E-017** Timeline mostra eventos em ordem e com referência amigável.

---

## 2f — Configuração, conteúdo e responsividade da slug

- [ ] **H2F-001** Ativar/desativar loja pública.
- [ ] **H2F-002** Ativar/desativar catálogo público.
- [ ] **H2F-003** Alterar slug com validação e alias conforme regra.
- [ ] **H2F-004** Definir local de estoque da slug.
- [ ] **H2F-005** Definir reserva mínima presencial.
- [ ] **H2F-006** Definir teto online.
- [ ] **H2F-007** Definir threshold de poucas unidades.
- [ ] **H2F-008** Publicar/ocultar produto individual.
- [ ] **H2F-009** Aplicar override por produto.
- [ ] **H2F-010** Quantidade exata aparecer somente em baixo estoque quando habilitada.
- [ ] **H2F-011** Indisponível ficar sem possibilidade de compra.
- [ ] **H2F-012** Produtos indisponíveis ordenados conforme regra atual.
- [ ] **H2F-013** Subir imagem de banner válida.
- [ ] **H2F-014** Subir vídeo válido e reproduzir sem quebrar layout.
- [ ] **H2F-015** Rejeitar/explicar mídia inválida ou excessiva.
- [ ] **H2F-016** Carrossel auto-loop/swipe/setas/indicadores.
- [ ] **H2F-017** Respeitar reduced motion.
- [ ] **H2F-018** Exibir somente redes cadastradas.
- [ ] **H2F-019** E-mail público da loja vir de configuração.
- [ ] **H2F-020** Logo pública diferente da administrativa.
- [ ] **H2F-021** Campo de domínio customizado aparecer desabilitado/“em breve”, sem promessa funcional.
- [ ] **H2F-022** Testar 320/360/375/390/412/480 px.
- [ ] **H2F-023** Testar tablet Android em portrait/landscape.
- [ ] **H2F-024** Testar 768/820/1024/1280/1440 px.
- [ ] **H2F-025** Nenhum conteúdo crítico coberto por barra fixa/carrinho/footer.
- [ ] **H2F-026** Sem scroll horizontal acidental.
- [ ] **H2F-027** Imagens não deformam/estouram CLS perceptível.

---

## 2g — Carrinho e checkout

- [ ] **H2G-001** Adicionar item pelo card.
- [ ] **H2G-002** Adicionar item pelo modal.
- [ ] **H2G-003** Incrementar/decrementar quantidade.
- [ ] **H2G-004** Remover item.
- [ ] **H2G-005** Carrinho vazio.
- [ ] **H2G-006** Carrinho persistido após refresh conforme política.
- [ ] **H2G-007** Trocar slug/loja sem misturar carrinhos.
- [ ] **H2G-008** Regra de pricing por quantidade correta.
- [ ] **H2G-009** Pricing agregado entre categorias correto.
- [ ] **H2G-010** Produto muda de preço com carrinho aberto: quote/final deve prevalecer.
- [ ] **H2G-011** Produto fica indisponível com carrinho aberto: checkout deve impedir/consertar.
- [ ] **H2G-012** Produto ocultado com carrinho aberto.
- [ ] **H2G-013** Última unidade disputada por dois usuários.
- [ ] **H2G-014** Entrega respeita mínimo configurado.
- [ ] **H2G-015** Retirada sem mínimo quando configurada assim.
- [ ] **H2G-016** CEP válido.
- [ ] **H2G-017** CEP inválido/serviço indisponível.
- [ ] **H2G-018** Endereço sem número quando permitido.
- [ ] **H2G-019** Telefone BR e internacional suportado conforme normalizador.
- [ ] **H2G-020** Dinheiro/troco.
- [ ] **H2G-021** Pix.
- [ ] **H2G-022** Cartão.
- [ ] **H2G-023** Forma pendente/pagar na retirada.
- [ ] **H2G-024** WhatsApp abre mensagem correta quando habilitado.
- [ ] **H2G-025** Tracking público por token sem vazar dados além do necessário.
- [ ] **H2G-026** Duplo clique em finalizar não duplica pedido.
- [ ] **H2G-027** Back/forward navegador mantém estado coerente.
- [ ] **H2G-028** Rede lenta mostra loading útil.
- [ ] **H2G-029** Offline não promete pedido concluído sem ACK servidor.
- [ ] **H2G-030** Validar mobile/tablet/desktop completo.

---

## 2h — Financeiro

- [ ] **H2H-001** Criar `Financeiro → Saldos por conta`.
- [ ] **H2H-002** Mostrar saldo consolidado e soma por contas.
- [ ] **H2H-003** Mostrar `Não distribuído` explicitamente.
- [ ] **H2H-004** Listar os 32 lançamentos atuais não classificados da Gelinhares.
- [ ] **H2H-005** Classificar lançamento manualmente com auditoria.
- [ ] **H2H-006** Não classificar histórico automaticamente.
- [ ] **H2H-007** Dinheiro direcionar ao caixa configurado.
- [ ] **H2H-008** Pix direcionar à conta/carteira configurada.
- [ ] **H2H-009** Cartão a receber direcionar a `Recebíveis de cartão`.
- [ ] **H2H-010** Liquidação de cartão transferir recebível para banco/conta.
- [ ] **H2H-011** Transferência entre contas não afetar resultado financeiro indevidamente.
- [ ] **H2H-012** Entrada manual selecionar somente contas/naturezas coerentes.
- [ ] **H2H-013** Saída manual não oferecer receita incompatível.
- [ ] **H2H-014** Entrada manual não oferecer despesa incompatível quando regra impedir.
- [ ] **H2H-015** Estornar lançamento com trilha de auditoria.
- [ ] **H2H-016** Venda cancelada disparar estorno adequado e idempotente.
- [ ] **H2H-017** Pendentes não entrarem em saldo realizado.
- [ ] **H2H-018** Fechamento do dia bater com meios de pagamento.
- [ ] **H2H-019** Contagem de dinheiro por denominações.
- [ ] **H2H-020** Conciliação bancária manual.
- [ ] **H2H-021** Divergência de conciliação gerar ocorrência clara.
- [ ] **H2H-022** Importação de extrato permanecer marcada futura.
- [ ] **H2H-023** Testar permissões financeiras view/manage/ações sensíveis.

---

## 2i — Cliente online + OptmaSMSGate OTP

- [ ] **H2I-001** Threat model da autenticação customer antes de habilitar produção.
- [ ] **H2I-002** Revisar `customer_credentials/customer_sessions/customer_otps` e grants.
- [ ] **H2I-003** Cadastro voluntário na slug.
- [ ] **H2I-004** Aceite versionado de termos/privacidade.
- [ ] **H2I-005** Definir senha com requisitos mínimos.
- [ ] **H2I-006** Enviar OTP pelo OptmaSMSGate.
- [ ] **H2I-007** OTP correto valida telefone.
- [ ] **H2I-008** OTP incorreto incrementa tentativas com rate limit.
- [ ] **H2I-009** OTP expirado não autentica.
- [ ] **H2I-010** Reenvio respeita cooldown.
- [ ] **H2I-011** OTP usado não reutiliza.
- [ ] **H2I-012** Login senha + OTP.
- [ ] **H2I-013** Recuperação de senha + OTP.
- [ ] **H2I-014** Sessão expira/revoga corretamente.
- [ ] **H2I-015** Logout invalida sessão do cliente.
- [ ] **H2I-016** Não vincular pedidos visitantes antigos ao novo cadastro.
- [ ] **H2I-017** Histórico mostra somente pedidos futuros/vinculados à conta conforme regra.
- [ ] **H2I-018** Cliente da Loja A não acessa perfil/pedido/consentimento da Loja B.
- [ ] **H2I-019** Testar brute force/rate limit/enumeração.
- [ ] **H2I-020** Nenhum hash/token/OTP sensível retornado ao browser.

---

## 2j — Fidelidade e campanhas de recompensa

- [ ] **H2J-001** Pontos por venda conforme regra.
- [ ] **H2J-002** Multiplicador por categoria/produto quando configurado.
- [ ] **H2J-003** Extrato de pontos.
- [ ] **H2J-004** Expiração de pontos.
- [ ] **H2J-005** Estorno de pontos por cancelamento.
- [ ] **H2J-006** Estorno proporcional em devolução parcial quando aplicável.
- [ ] **H2J-007** Tiers/níveis.
- [ ] **H2J-008** Benefícios.
- [ ] **H2J-009** Resgate/troca de pontos.
- [ ] **H2J-010** Duplo resgate impedido.
- [ ] **H2J-011** Histórico/auditoria de ajuste manual.
- [ ] **H2J-012** Raspadinha nascer como campanha independente.
- [ ] **H2J-013** Raspadinha conceder pontos.
- [ ] **H2J-014** Raspadinha conceder cupom.
- [ ] **H2J-015** Raspadinha conceder produto.
- [ ] **H2J-016** Raspadinha conceder mensagem/prêmio.
- [ ] **H2J-017** Critério/limite de participação auditável e não manipulável no frontend.

---

## 2k — Marketing e futuro Consultor de Marketing

- [ ] **H2K-001** Revisar Central de Marketing existente.
- [ ] **H2K-002** Criar/editar segmento.
- [ ] **H2K-003** Criar campanha.
- [ ] **H2K-004** Preview de destinatários respeitar loja/consentimento.
- [ ] **H2K-005** WhatsApp manual não fingir envio/entrega/leitura.
- [ ] **H2K-006** Marcação manual de enviado ser explícita.
- [ ] **H2K-007** Separar mensagem operacional de marketing.
- [ ] **H2K-008** Consentimento por canal.
- [ ] **H2K-009** Opt-out impedir nova seleção de marketing daquele canal.
- [ ] **H2K-010** Preparar etapa final `Consultor de Marketing` referenciando documentação já existente.

---

## 2l — Termos, ajuda, suporte e consentimentos

- [ ] **H2L-001** Termos públicos da loja por slug.
- [ ] **H2L-002** Política de privacidade por slug.
- [ ] **H2L-003** Política de cookies.
- [ ] **H2L-004** Cookie consent versionado.
- [ ] **H2L-005** Reabrir preferências de cookies.
- [ ] **H2L-006** Rodapé legal mobile/desktop.
- [ ] **H2L-007** Contato da loja por e-mail configurado.
- [ ] **H2L-008** Contato institucional OptmaIdea correto.
- [ ] **H2L-009** Aceite de termos no cadastro customer.
- [ ] **H2L-010** Registrar versão/data do aceite.
- [ ] **H2L-011** Central de preferências por SMS/WhatsApp/push/e-mail.
- [ ] **H2L-012** Futuro Telegram/outro não aparecer como ativo antes de existir.
- [ ] **H2L-013** Criar/help center administrativo mínimo.
- [ ] **H2L-014** Fluxo de suporte com contato claro.
- [ ] **H2L-015** Fluxo de encerramento e retenção explicado.

---

# 2m — Governança de release, migrations e deploy

- [ ] **H2M-001** Confirmar branch `agent/homologacao-geral-20260820`.
- [ ] **H2M-002** Confirmar PR de homologação apontando para `main`.
- [ ] **H2M-003** `git status` limpo antes de cada baseline.
- [ ] **H2M-004** `npm ci` sem erro.
- [ ] **H2M-005** `npm test`.
- [ ] **H2M-006** `npm run build`.
- [ ] **H2M-007** `npm run lint` e registrar dívida, sem ocultar falhas.
- [ ] **H2M-008** Comparar migrations Git versus `supabase migration list`.
- [ ] **H2M-009** Nenhuma migration remota sem arquivo versionado.
- [ ] **H2M-010** Vercel preview `READY` no head homologado.
- [ ] **H2M-011** Build logs sem erro oculto.
- [ ] **H2M-012** Documentar rollback de release.
- [ ] **H2M-013** Registrar versão do produto em UI/rodapé.
- [ ] **H2M-014** Não commitar secrets/tokens.

---

# 2n — Segurança, RLS e multi-tenant

- [ ] **H2N-001** Inventariar todas as RPCs SECURITY DEFINER.
- [ ] **H2N-002** Classificar `PUBLIC_ANON`, `AUTHENTICATED`, `INTERNAL`.
- [ ] **H2N-003** Revogar anon em RPC administrativa indevida.
- [ ] **H2N-004** Revogar authenticated genérico quando autorização interna não for suficiente.
- [ ] **H2N-005** Fixar `search_path` de funções sensíveis.
- [ ] **H2N-006** Revisar RLS de customer credentials/sessions/OTPs.
- [ ] **H2N-007** Revisar RLS/grants de orders/reservations/cashbook.
- [ ] **H2N-008** Usuário Loja A tentar ler IDs Loja B.
- [ ] **H2N-009** Usuário Loja A tentar mutar IDs Loja B.
- [ ] **H2N-010** Visitante tentar RPC administrativa.
- [ ] **H2N-011** Testar storage/bucket entre lojas.
- [ ] **H2N-012** Rate limit de signup/login/OTP/public order.
- [ ] **H2N-013** Avaliar habilitar leaked password protection no Auth.
- [ ] **H2N-014** CSP/headers/cookies em Vercel.
- [ ] **H2N-015** Logs não conterem senha/OTP/token/documento completo desnecessário.

---

# 2o — Offline, reconexão, concorrência e idempotência

- [ ] **H2O-001** Definir app shell PWA offline.
- [ ] **H2O-002** IndexedDB com versão/schema de cache.
- [ ] **H2O-003** Fila de mutações com `client_operation_id`.
- [ ] **H2O-004** Operação offline ficar visivelmente `pending_sync`.
- [ ] **H2O-005** Reconectar e sincronizar uma vez.
- [ ] **H2O-006** Retry não duplicar venda/movimento/cashbook.
- [ ] **H2O-007** Conflito de estoque após reconexão gerar resolução explícita.
- [ ] **H2O-008** Dois dispositivos offline não fingirem consistência global.
- [ ] **H2O-009** Transferência offline não ficar `received/shipped` sem ACK servidor.
- [ ] **H2O-010** Fechamento financeiro offline permanecer pendente.
- [ ] **H2O-011** Public checkout offline não concluir sem validação autoritativa.
- [ ] **H2O-012** Cache inválido/versão antiga ser migrado ou limpo com segurança.

---

# 2p — Acessibilidade, responsividade e performance

- [ ] **H2P-001** Navegação por teclado nas telas críticas.
- [ ] **H2P-002** Foco visível.
- [ ] **H2P-003** Labels de formulário associados.
- [ ] **H2P-004** Modais prendem/restauram foco.
- [ ] **H2P-005** Contraste suficiente.
- [ ] **H2P-006** Zoom 200% sem perda crítica.
- [ ] **H2P-007** Chrome desktop.
- [ ] **H2P-008** Firefox desktop.
- [ ] **H2P-009** Android Chrome.
- [ ] **H2P-010** iPhone Safari quando disponível.
- [ ] **H2P-011** Tablet Android portrait/landscape.
- [ ] **H2P-012** Catálogo grande sem travamento evidente.
- [ ] **H2P-013** Lazy loading de mídia.
- [ ] **H2P-014** Evitar requests duplicados desnecessários.
- [ ] **H2P-015** Revisar FKs sem índice após correção funcional.
- [ ] **H2P-016** Revisar RLS initplan/múltiplas permissive policies.

---

# 2q — Observabilidade e alertas

- [ ] **H2Q-001** Console limpo nos fluxos homologados.
- [ ] **H2Q-002** Erro esperado não usar `console.error` como falha inesperada.
- [ ] **H2Q-003** Toast sem UUID/SQL/Postgres cru.
- [ ] **H2Q-004** Novo pedido online gerar aviso visual persistente.
- [ ] **H2Q-005** Som configurável.
- [ ] **H2Q-006** Não repetir som indefinidamente após reconhecimento.
- [ ] **H2Q-007** Browser notification somente após permissão.
- [ ] **H2Q-008** Contador/badge coerente.
- [ ] **H2Q-009** Modo tela dedicada/TV para fila de pedidos.
- [ ] **H2Q-010** Link do alerta abrir pedido correto.
- [ ] **H2Q-011** Origem do pedido aparecer em dashboard/admin.

---

# 2r — Importação, exportação, impressão e PDF

- [ ] **H2R-001** Import CSV categorias com preview.
- [ ] **H2R-002** Import CSV produtos com preview.
- [ ] **H2R-003** Import CSV fornecedores com preview.
- [ ] **H2R-004** Import CSV clientes com preview.
- [ ] **H2R-005** Import estoque inicial com preview.
- [ ] **H2R-006** Linhas inválidas não abortarem silenciosamente o lote inteiro.
- [ ] **H2R-007** Relatório de erros por linha.
- [ ] **H2R-008** Reimport não duplicar quando houver chave externa declarada.
- [ ] **H2R-009** Export CSV pt-BR com BOM/separador esperado.
- [ ] **H2R-010** Template HTML/CSS de documento auxiliar de venda.
- [ ] **H2R-011** Template de compra/cotação/transferência quando necessário.
- [ ] **H2R-012** `@media print` sem menu/botões indevidos.
- [ ] **H2R-013** Salvar como PDF pelo browser mantém legibilidade.
- [ ] **H2R-014** Não introduzir biblioteca PDF pesada sem necessidade comprovada.

---

# 2s — PWA por slug, assistente e canais

- [ ] **H2S-001** Manifest do shell administrativo.
- [ ] **H2S-002** Manifest/identidade por slug.
- [ ] **H2S-003** Nome/ícone/theme color por loja pública.
- [ ] **H2S-004** Instalação Android Chrome.
- [ ] **H2S-005** Instalação iOS Safari quando disponível.
- [ ] **H2S-006** Update do service worker sem prender usuário em versão quebrada.
- [ ] **H2S-007** Placeholder de domínio customizado desabilitado.
- [ ] **H2S-008** Assistente usar somente knowledge sources autorizadas.
- [ ] **H2S-009** Preço e estoque consultados por ferramenta/API atual, não memória do modelo.
- [ ] **H2S-010** Alergênico só responder quando dado cadastrado.
- [ ] **H2S-011** Status de pedido exigir identidade/token apropriado.
- [ ] **H2S-012** Assistente admitir que não sabe.
- [ ] **H2S-013** Escalonamento para humano.
- [ ] **H2S-014** Consentimentos separados por canal.
- [ ] **H2S-015** SMS via OptmaSMSGate quando contratado/habilitado.
- [ ] **H2S-016** WhatsApp conforme capacidade disponível.
- [ ] **H2S-017** Push/web push.
- [ ] **H2S-018** E-mail.
- [ ] **H2S-019** Telegram/outro permanecer futuro.

---

# 2t — Navegação e experiência em tablet

- [ ] **H2T-001** Inventariar todas as rotas e entradas de menu.
- [ ] **H2T-002** Identificar telas com excesso de ações simultâneas.
- [ ] **H2T-003** Separar navegação primária de atalhos contextuais.
- [ ] **H2T-004** Testar sidebar expandida/compacta em tablet.
- [ ] **H2T-005** Evitar duas linhas de mini-botões sem hierarquia.
- [ ] **H2T-006** Definir padrão de título/subtítulo/ações principais.
- [ ] **H2T-007** Definir padrão de filtros recolhíveis em telas densas.
- [ ] **H2T-008** Priorizar touch target adequado.
- [ ] **H2T-009** Avaliar bottom navigation/context navigation em mobile onde fizer sentido.
- [ ] **H2T-010** Não redesenhar antes de medir os fluxos homologados e tarefas mais frequentes.

---

# Gate final — pronto para parceiro

- [ ] **GATE-001** Build/deploy sem erro.
- [ ] **GATE-002** Zero erro relevante no console nos fluxos homologados.
- [ ] **GATE-003** Testes automatizados críticos passando.
- [ ] **GATE-004** Cadastro completo de uma loja nova.
- [ ] **GATE-005** Estoque/comercial/financeiro reconciliados.
- [ ] **GATE-006** Permissões validadas por papéis.
- [ ] **GATE-007** Slug pública/carrinho/checkout validados mobile e desktop.
- [ ] **GATE-008** Limitações conhecidas documentadas.
