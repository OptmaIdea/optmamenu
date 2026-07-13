# OptmaMenu

SaaS — Painel administrativo para estabelecimentos (restaurantes, lanchonetes, etc.)

## 📋 Visão Geral

OptmaMenu é uma plataforma SaaS completa que oferece cardápio digital, gestão de pedidos, controle de estoque, financeiro, clientes/fidelidade, marketing e configurações para estabelecimentos alimentícios.

Fa parte do ecossistema Optma (OptmaMenu + OptmaIdea).

## 🛠️ Stack Tecnológica

| Camada | Tecnologia | Versão |
|--------|------------|--------|
| **Framework UI** | React | 19.x |
| **Linguagem** | TypeScript | ~5.8 |
| **Build Tool** | Vite | 7.x |
| **Estilização** | Tailwind CSS | v4 |
| **Roteamento** | React Router DOM | v7 |
| **Backend / DB** | Supabase (PostgreSQL) | SDK v2 |
| **Estado Global** | Zustand | v5 |
| **Formulários** | React Hook Form + Zod | — |
| **Animações** | Framer Motion | v12 |
| **Ícones** | Lucide React | v0.563+ |
| **Drag and Drop** | @dnd-kit | v6+ |
| **Toasts** | Sonner | v2 |
| **PWA** | vite-plugin-pwa | v1 |
| **Testes** | Vitest + Testing Library | — |
| **Formatação** | Prettier + ESLint | — |

## 🚀 Começando

### Pré-requisitos

- Node.js (versão LTS recomendada)
- npm ou yarn
- Conta no Supabase

### Instalação

1. Clone o repositório:
   ```bash
   git clone <URL_DO_REPOSITORIO>
   cd optmamenu
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Configure as variáveis de ambiente:
   - Copie `.env.example` para `.env`
   - Preencha os valores necessários (URL e chave do Supabase, etc.)

4. Inicie o Supabase localmente (opcional, para desenvolvimento):
   ```bash
   supabase start
   ```

5. Execute o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

O aplicativo estará disponível em `http://localhost:5173`

## 📜 Scripts Disponíveis

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Servidor de desenvolvimento (Vite HMR) |
| `npm run build` | Build de produção (tsc + vite build) |
| `npm run preview` | Visualiza o build de produção localmente |
| `npm run lint` | Verifica código com ESLint |
| `npm run lint:fix` | Corrige automaticamente problemas do ESLint |
| `npm run format` | Formata código com Prettier |
| `npm run format:check` | Verifica se o código está formatado corretamente |
| `npm run test` | Executa testes com Vitest |
| `npm run test:watch` | Executa testes em modo watch |
| `npm run convert:webp` | Converte imagens para formato WebP |
| `npm run convert:webp:delete` | Remove imagens WebP convertidas |
| `npm run convert:webp:quality` | Converte imagens WebP com qualidade específica |

## 🗂️ Estrutura do Projeto

```
optmamenu/
├── src/                    # Código fonte principal
│   ├── components/         # Componentes UI reutilizáveis
│   ├── pages/              # Páginas baseadas em rotas
│   ├── hooks/              # Custom React hooks
│   ├── services/           # Funções de serviço/API
│   ├── store/              # Estado global (Zustand)
│   ├── types/              # Definições TypeScript
│   ├── utils/              # Funções utilitárias
│   ├── constants/          # Valores constantes
│   ├── __tests__/          # Testes
│   ├── App.tsx             # Componente raiz
│   └── main.tsx            # Entry point
├── supabase/               # Configuração Supabase
│   ├── schema/             # Definições de esquema DB
│   ├── migrations/         # Migrações de banco de dados
│   ├── functions/          # Funções Edge do Supabase
│   └── seed.sql            # Dados iniciais
├── public/                 # Arquivos estáticos
├── scripts/                # Scripts utilitários
│   ├── convert-to-webp.js  # Conversão de imagens para WebP
│   └── serve-local.cjs     # Servidor local para testes
├── .agents/                # Regras e skills do agente de IA (AGENTS.md e skills/)
├── docs/                   # Documentação adicional
└── .env                    # Variáveis de ambiente (não versionado)
```

## 🔐 Segurança

⚠️ **Importante**: O arquivo `.env` contém variáveis de ambiente sensíveis e **NUNCA** deve ser commitado no repositório. Ele já está configurado no `.gitignore`.

Variáveis necessárias no `.env`:
- `VITE_SUPABASE_URL`: URL do projeto Supabase
- `VITE_SUPABASE_ANON_KEY`: chave anonima do Supabase (segura para frontend)
- `SUPABASE_JWT_SECRET`: secret JWT (apenas para backend, sem prefixo VITE_)

Consulte `.env.example` para um modelo completo.

## 📚 Documentação

Documentação detalhada pode ser encontrada na pasta `docs/` e nas regras/skills do agente de IA em `.agents/`.

- `.agents/AGENTS.md` - Contexto geral e regras do projeto
- `.agents/skills/design_system/SKILL.md` - Identidade visual completa
- `.agents/skills/page_layout_standard/SKILL.md` - Padrão de layout das páginas admin

## 🧪 Testes

Execute os testes com:
```bash
npm run test
```

Para modo watch durante desenvolvimento:
```bash
npm run test:watch
```

## 📦 Build para Produção

Gerar build otimizado para produção:
```bash
npm run build
```

Visualizar o build localmente:
```bash
npm run preview
```

O build será gerado na pasta `dist/`.

## 🤝 Contribuição

Este é um projeto solo atualmente. Para sugestões ou reportes de issues, por favor abra uma issue no repositório.

## 📄 Licença

Este projeto é proprietário e parte do ecossistema Optma.

---

*Desenvolvido com ❤️ usando React, TypeScript, Vite e Supabase*