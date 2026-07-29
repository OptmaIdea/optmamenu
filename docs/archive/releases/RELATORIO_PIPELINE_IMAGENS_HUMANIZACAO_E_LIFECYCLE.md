# 📋 Relatório Consolidado: Pipeline de Imagens, Humanização de Documentos e Redefinição do Lifecycle

> **OptmaMenu — Versão 0.9.14 (Pós-Fase 9.14 Hardening)**  
> **Data de Atualização**: 25 de Julho de 2026  
> **Escopo**: Otimização de mídia no frontend, padronização visual de códigos de documentos e reformulação da UX/UI da Vida do Produto.

---

## 📸 1. Pipeline Central de Otimização de Imagens no Frontend

### 1.1 Objetivo e Arquitetura
Para mitigar o consumo de armazenamento no Supabase Storage (especialmente na cota do Free Tier de 1 GB) e otimizar o carregamento no PDV, aplicativo mobile e loja pública, foi estabelecido um **pipeline central de processamento de imagens no frontend antes do upload**.

Toda imagem enviada passa pelas seguintes etapas obrigatórias:
1. **Validação**: Verificação de formatos aceitos (`image/jpeg`, `image/png`, `image/webp`) e rejeição de formatos pesados ou incompatíveis (GIF animado, SVG enviado por usuários, BMP, TIFF).
2. **Limite de Entrada**: Aceitação de arquivos brutos de até **10 MB** (ajustado para acomodar fotos originais tiradas diretamente por câmeras modernas de smartphones de 6,75 MB a 8 MB sem forçar o lojista a usar ferramentas externas de edição).
3. **Redimensionamento Proporcional (Anti-Upscale)**: Ajuste de dimensões mantendo a proporção de aspecto. Imagens menores que o limite do perfil **não são ampliadas**.
4. **Preservação de Transparência (Alpha Channel)**: Manutenção da transparência nativa em PNGs/WebPs recortados (logos e mascotes) sem preenchimento de fundo branco.
5. **Conversão para WebP**: Saída padronizada em `image/webp` com qualidade otimizada por perfil.
6. **Nomenclatura Segura**: Geração de nomes aleatórios seguros com `createClientUuid()` de `src/utils/clientUuid.ts` (ex.: `product_5e84f407-64bf-4a75-8b24-06daab7a40c5.webp`).

---

### 1.2 Perfis de Otimização Definidos

```ts
export const IMAGE_PROFILES = {
  product:  { maxWidth: 800,  maxHeight: 800,  quality: 0.82 },
  category: { maxWidth: 800,  maxHeight: 800,  quality: 0.82 },
  avatar:   { maxWidth: 512,  maxHeight: 512,  quality: 0.82 },
  logo:     { maxWidth: 800,  maxHeight: 800,  quality: 0.90 },
  banner:   { maxWidth: 1600, maxHeight: 900,  quality: 0.82 },
} as const;
```

---

### 1.3 Módulos e Componentes Criados e Integrados

- **Utilitário Central**: `src/utils/imageOptimization.ts`
- **Componente Reutilizável de Upload**: `src/components/common/ImageUploadField.tsx` (suporta drag-and-drop, estados visuais *"Otimizando imagem..."* / *"Enviando imagem..."* e estatística de economia de espaço).
- **Telas Integradas**:
  - Cadastro e Edição de Produtos (`useProductSave.ts`, `ImageSection.tsx`)
  - Cadastro e Edição de Categorias (`useCategorySave.ts`, `CategoryEditModal.tsx`)
  - Identidade Visual / Logos e Banners da Loja (`Appearance.tsx`)
  - Avatares de Usuários e Equipe (`userAvatarService.ts`, `MyProfileIdentityTab.tsx`, `UserDetailModal.tsx`)
  - Recompensas do Programa de Fidelidade (`RewardsConfig.tsx`)

---

### 1.4 Limitação Técnica de Exclusão de Arquivos Antigos no Storage via Frontend

> [!WARNING]
> **Diagnóstico de Permissões RLS (Supabase Storage)**  
> Durante os testes de substituição de foto no bucket `user-avatars`, identificou-se que requisições em modo `upsert: true` (UPDATE) ou chamadas de deleção remota `.remove([paths])` disparadas via cliente REST do frontend podem ser bloqueadas com o erro:  
> `StorageApiError: new row violates row-level security policy` (HTTP 400 Bad Request).
>
> **Causa**: As políticas RLS padrão do Supabase Storage no banco de dados concedem permissão de **INSERT (POST)** para usuários autenticados, mas restringem permissões de **UPDATE (PUT)** e **DELETE** no cliente frontend para determinados caminhos/prefixos.
>
> **Comportamento Atual no Frontend**:
> - O upload de novas imagens é realizado em modo **INSERT autorizado** (`upsert: false`), gerando um novo arquivo otimizado em WebP que sobe com sucesso (HTTP 200 OK).
> - O banco de dados é atualizado via RPC com a nova URL do avatar.
> - A rotina de limpeza de arquivos antigos legados é executada em modo seguro (com `try/catch`). Se o RLS do Supabase barrar a instrução de `DELETE` no cliente, o upload da nova foto **não falha** nem trava a aplicação.
>
> **Pendência Recomendada Pré-Lançamento (Server-Side)**:
> Para expurgar definitivamente os arquivos antigos acumulados nas pastas do Storage sem depender de permissões RLS no frontend:
> 1. Ajustar a política RLS de `DELETE` no bucket `user-avatars` / `products` no console do Supabase para autorizar o próprio `owner` a deletar seus objetos antigos.
> 2. Ou executar o script administrativo de faxina de Storage (`--dry-run`) registrado no cronograma pré-lançamento.

---

## 🔢 2. Humanização Global de Referências de Documentos

### 2.1 Objetivo
Substituir a exibição de códigos longos e poluídos em cards, tabelas, linhas do tempo e observações (ex.: `PED-20260725-004413-5930` ou `TRF-20260724-013302-550`) por siglas compactas e amigáveis, mantendo a integridade técnica dos dados completos no banco de dados.

### 2.2 Utilitário Central e Padrão Compacto
- **Arquivo**: `src/utils/documentReference.ts`
- **Padrão Visual sem Espaço**:
  - `PED-20260725-004413-5930` $\rightarrow$ **`PED#5930`**
  - `TRF-20260724-013302-550` $\rightarrow$ **`TRF#550`**
  - `ENT-20260724-123456-AB12` $\rightarrow$ **`ENTR#AB12`**
  - `CXA-20260725-004413-19DC` $\rightarrow$ **`CXA#19DC`**
  - `COT-20260724-123456-CD34` $\rightarrow$ **`COT#CD34`**
  - `PUR-20260724-123456-9900` $\rightarrow$ **`COMP#9900`**

### 2.3 Substituição Automática em Narrativas e Motivos
A função `humanizeTextReferences(text)` aplica expressões regulares em textos livres e descritivos.
- **Exemplo de Substituição em Narrativas**:
  - *Antes*: `Venda direta concluída pelo pedido PED-20260725-004413-5930.`
  - *Depois*: `Venda direta concluída pelo pedido PED#5930.`
- **Tooltips**: Os códigos originais brutos continuam acessíveis passando o cursor sobre a referência (atributo HTML `title`).

---

## 📦 3. Redefinição UX/UI da Vida do Produto (`ProductLifecyclePage.tsx`)

### 3.1 Melhorias Estruturais e Visualização Fixa
A tela `/admin/products/inventory/lifecycle/:productId` foi completamente reformulada para resolver a poluição visual prévia:

1. **Nome do Produto Sempre Visível (Cabeçalho Fixo em Destaque)**:
   - Apresenta de forma proeminente o **nome completo do produto consultado**, foto oficial, categoria, código SKU, preço de venda atual e o badge de status consolidado do estoque (Normal, Alerta de Baixo Estoque ou Crítico).
2. **Navegação Organizada em 5 Abas Temáticas**:
   - `Resumo & Diagnóstico`: Visão rápida do estoque total, disponibilidades por local e saúde dos lotes.
   - `Estoque por Local`: Tabela e cards detalhados por loja, depósito e área de atendimento.
   - `Movimentações`: Histórico de entradas (`ENTR#`), saídas por venda (`PED#`), transferências (`TRF#`) e baixas, com narrativas humanizadas e sem códigos brutos expostos.
   - `Fornecedores & Custos`: Histórico de compras, cotações e fornecedores vinculados.
   - `Auditoria`: Ocorrências de divergência de estoque e registros de ajuste físico.

### 3.2 Experiência de Foto em `/admin/my-profile`
Na tela **Meus Dados** (`/admin/my-profile`), a gestão da foto de perfil foi aprimorada:
- **Ampliar Foto**: Clique na imagem abre o Modal Lightbox com a foto em alta definição.
- **Substituir Foto**: Botão direto de substituição com conversão automática para WebP e validação amigável.
- **Console Limpo**: Silenciados os logs de exceção ruidosos no console para erros de validação esperados pelo formulário.

---

## 📊 4. Resumo de Validação e Commits

| Frente | Validação (`npm run build`) | Status Git / Commit |
|---|---|---|
| Otimização de Imagens | ✅ Aprovado em 5.84s | `feat: implementar pipeline central de otimizacao de imagens` (`c903ca5`) |
| Humanização de Referências | ✅ Aprovado em 9.34s | `fix: aplicar formato compacto de referencias e humanizacao` (`5f1c0f1`) |
| UX/UI Vida do Produto | ✅ Aprovado em 6.28s | `feat: reformular layout da Vida do Produto com cabecalho fixo` (`8986995`) |
| Ajuste RLS / 10MB / Console | ✅ Aprovado em 5.95s | `fix: silenciar logs ruidosos de validacao no console` (`adc736c`) |

---

*Relatório mantido pela equipe de engenharia do OptmaMenu.*
