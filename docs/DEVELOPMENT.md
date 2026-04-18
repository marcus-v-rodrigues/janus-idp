# Guia de Desenvolvimento

Este guia detalha o ecossistema de desenvolvimento do Janus-IDP, focado em **TypeScript**, **React (SSR)** e **Drizzle ORM**.

---

## Estrutura do Projeto

- **`/src/views`**: Componentes React utilizados para renderização das interfaces.
- **`/src/client`**: Ponto de entrada para a hidratação (Hydration) do lado do cliente.
- **`/src/db`**: Definições de esquema e configuração do banco de dados (Drizzle).
- **`/src/routes`**: Rotas Express para OIDC, Admin e API.
- **`/src/services`**: Lógica de negócio (RBAC, claims, gestão de usuários).

---

## Frontend: React SSR e Hydration

O Janus utiliza uma arquitetura híbrida de renderização para garantir velocidade e interatividade.

### 1. Renderização no Servidor (SSR)
As páginas (Login, Dashboard, Consentimento) são inicialmente renderizadas no servidor usando `renderToString` do React. Isso garante que o HTML inicial carregue instantaneamente.
- Localização da lógica: `src/utils/renderer.tsx`

### 2. Hidratação (Hydration)
Após o HTML carregar, o arquivo `/dist/client.js` é baixado pelo navegador. O React "assume" o controle do HTML estático, transformando-o em um aplicativo interativo.
- Ponto de entrada: `src/client/index.tsx`

### Como adicionar um novo componente à Hidratação:
1. Crie o componente em `src/views/`.
2. Adicione o componente ao mapeamento dinâmico em `src/client/index.tsx`.
3. Ao renderizar via Express, use `enableHydration: true` no `renderView`.

---

## Banco de Dados com Drizzle

### Gerenciar Esquema
Se você alterar qualquer campo em `src/db/schema.ts`, siga estes passos:
1. **Gerar migração**: `npm run db:generate`
2. **Aplicar migração**: `npm run db:push` (em desenvolvimento) ou `npm run db:migrate` (em produção)

### Drizzle Studio (Visualização)
Você pode visualizar e editar os dados do banco através de uma interface web:
```bash
npm run db:studio
```
*(Acesse em `http://localhost:4983`)*

---

## Scripts Úteis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia o servidor em modo watch (recarregamento automático). |
| `npm run build` | Realiza o build completo (TS para JS e bundle do React Client). |
| `npm run db:seed` | Alimenta o banco com dados iniciais (Admin e Clientes padrão). |
| `npm run generate-keys` | Gera chaves RSA para assinatura OIDC. |
| `npm run lint` | Verifica erros de estilo e padronização no código. |

---

## Fluxo de Desenvolvimento Sugerido

1. **Alteração de Lógica**: O `ts-node-dev` reiniciará o servidor automaticamente.
2. **Alteração de View (React)**: O servidor recompilará o SSR, mas se a mudança for no comportamento cliente, você precisará garantir que o build do client foi atualizado (`npm run build:client`).
3. **Novas Dependências**: Lembre-se de rodar `npm install` e atualizar o Docker se necessário.
