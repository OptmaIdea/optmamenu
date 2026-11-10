# P04 — JWT assinado no PostgREST local e RLS real de clientes

Objetivo: sem custo do Supabase Pro e sem pessoas reais, testar o HTTP/JWT junto às RLS derivadas da produção.

CI: PostgreSQL 17 temporário instala a fixture de P02 (2 lojas, 3 clientes fictícios); role authenticator sem BYPASSRLS;
contêiner postgrest/postgrest:v14.13 verifica JWT HS256 com chave aleatória criada no GitHub Actions;
Node gera tokens sintéticos e exige respostas esperadas pela API REST em pedidos e fidelidade.

Casos: visitante sem token; cliente A; cliente A2 na mesma loja; cliente B com telefone idêntico em outra loja;
claim de store_id fraudado; sessão inexistente; proprietário A; token inválido e expirado.

IMPORTANTE: JWTs são assinados pelo teste Node, NÃO emitidos pelo GoTrue/Supabase Auth.
Valida-se criptografia da assinatura pelo PostgREST e RLS, mas não login, OTP, sessão emitida pelo Auth nem refresh.
Nenhuma chave ou PII de produção é usada, nenhum cliente real é alterado.

Referência: https://docs.postgrest.org/en/v14/references/configuration.html
