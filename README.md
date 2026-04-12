# Janus IdP

Janus IdP é um Identity Provider (IdP) construído com **Node.js**, **Express**, **oidc-provider**, **Drizzle ORM** e **React (SSR)**. Esta versão foi projetada para rodar inteiramente via **Docker Compose**.

## 🚀 Funcionalidades

- **Docker Ready**: Infraestrutura completa (App + Banco) com um único comando.
- **OpenID Connect Core**: Suporte a fluxos de `authorization_code` e `refresh_token`.
- **Persistência em PostgreSQL**: Armazenamento seguro de payloads OIDC e configurações de clientes.
- **Configuração Dinâmica**: Clientes OAuth carregados do banco de dados na inicialização.
- **Drizzle ORM**: ORM TypeScript moderno e leve para PostgreSQL.
- **Portal Administrativo**: Interface web para gerenciamento de usuários e clientes.
- **React SSR**: Renderização server-side com hydratação client-side para melhor performance e UX.
- **API Externa**: REST API para integração com serviços externos.

## 🛠️ Pré-requisitos

- **Docker** e **Docker Compose** instalados.

## 📦 Como Instalar e Rodar

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/marcus-v-rodrigues/janus-idp.git
   cd janus-idp
   ```

2. **Configure as variáveis de ambiente:**
   Copie o arquivo `.env.example` para `.env`:
   ```bash
   cp .env.example .env
   ```
   *Certifique-se de que as variáveis `POSTGRES_USER`, `POSTGRES_PASSWORD` e `POSTGRES_DB` no `.env` correspondam ao que o App usará para conectar.*

3. **Crie a rede Docker externa (requisito do ecossistema UX Auditor):**
   ```bash
   docker network create ux-auditor-network
   ```

4. **Suba o ambiente completo:**
   ```bash
   docker compose up -d --build
   ```
   Este comando irá:
   - Iniciar o banco de dados PostgreSQL.
   - Construir a imagem da aplicação.
   - Realizar o build do código TypeScript e do bundle client-side React.
   - Executar migrações do banco de dados.
   - Popular o banco de dados com seed (usuário admin e clientes padrão).
   - Iniciar o servidor na porta configurada (padrão: 3000).

   **O container será iniciado automaticamente com:**
   - Usuário administrador padrão (ver credenciais nos logs)
   - Cliente OIDC pré-configurado (UX Auditor)

## 🗄️ Gerenciando o Banco de Dados (Via Docker)

Como a aplicação roda dentro do container, você pode executar comandos de manutenção usando `docker exec`:

### Gerar Migrations
```bash
docker compose exec app npm run db:generate
```

### Aplicar Migrations (Push)
```bash
docker compose exec app npm run db:push
```

### Popular Banco (Seed)
```bash
docker compose exec app npm run db:seed
```

### Drizzle Studio
```bash
docker compose exec app npm run db:studio
```

## 🧪 Como Testar

Após iniciar os containers, o servidor estará disponível em `http://localhost:3000`.

### Portal Administrativo

O Janus IdP possui um portal administrativo completo para gerenciamento do sistema:

- **URL**: `http://localhost:3000/admin`
- **Credenciais**: Definidas no arquivo `.env` via variáveis `ADMIN_EMAIL` e `ADMIN_PASSWORD`

**Funcionalidades disponíveis:**
- Dashboard com estatísticas do sistema
- Gerenciamento de clientes OAuth (criar, editar, excluir)
- Gerenciamento de usuários (listar, resetar senha, alterar função)
- Geração de client secrets

### Configurações do Cliente OIDC

1. **Authorize URI**: `http://localhost:3000/oidc/auth`
2. **Token URI**: `http://localhost:3000/oidc/token`
3. **Client ID**: `ux-auditor` (criado automaticamente pelo seed)
4. **Scope**: `openid profile email offline_access`
5. **Redirect URI**: `http://localhost:3001/api/auth/callback/janus`
6. **Resource**: enviar explicitamente quando o client quiser um audience específico para a API

O cliente `ux-auditor` é configurado pelo seed com `authorization_code` e `refresh_token`, então o `offline_access` funciona de forma consistente quando o cliente o solicitar.

Se o client precisar de um access token JWT com audience da API, ele deve enviar `resource` na requisição OIDC. O `defaultResource` existe apenas como fallback controlado para compatibilidade.

### Integração com NextAuth

Se estiver usando NextAuth, o papel do Janus é autenticar o usuário e devolver as claims. O app cliente usa essas claims para montar a sessão e proteger as rotas.

```ts
import NextAuth from 'next-auth';

export const authOptions = {
  providers: [
    {
      id: 'janus',
      name: 'Janus',
      type: 'oidc',
      issuer: process.env.JANUS_ISSUER,
      wellKnown: `${process.env.JANUS_ISSUER}/.well-known/openid-configuration`,
      clientId: process.env.JANUS_CLIENT_ID,
      clientSecret: process.env.JANUS_CLIENT_SECRET,
      authorization: {
        params: {
          scope: 'openid profile email offline_access',
        },
      },
      checks: ['pkce', 'state'],
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          roles: profile.roles,
        };
      },
    },
  ],
  callbacks: {
    async jwt({ token, profile }) {
      if (profile) {
        token.roles = profile.roles;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.roles = token.roles;
      return session;
    },
  },
};
```

Exemplo de uso no cliente:

```ts
const globalRoles = session?.user?.roles?.global ?? [];
const clientRoles = session?.user?.roles?.client ?? [];

const canAccessAdmin = globalRoles.includes('janus_admin');
const canAccessClient = clientRoles.some((role) => role.clientId === 'ux-auditor');
```

Exemplo do que o cliente recebe após login bem-sucedido via `userinfo` ou `id_token`:

```json
{
  "sub": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Usuário de Exemplo",
  "email": "usuario@exemplo.com",
  "email_verified": true,
  "roles": {
    "global": ["user"],
    "client": [
      { "code": "user", "clientId": "ux-auditor" }
    ]
  }
}
```

### Endpoints OIDC

Acesse a configuração do OpenID:
`http://localhost:3000/oidc/.well-known/openid-configuration`

Endpoint JWKS:
`http://localhost:3000/oidc/jwks`

### API para Serviços Externos

O IdP expõe uma API REST para integração com serviços externos:

- **POST `/api/users`**: Cria um novo usuário no sistema
  - Header obrigatório: `X-Service-Key` (configure via `JANUS_SERVICE_API_KEY` no `.env`)
  - Corpo: `{ email, password, name? }`

## 📚 Documentação

- [Arquitetura do Sistema](docs/ARCHITECTURE.md)
- [Configuração de Ambiente](docs/ENVIRONMENT.md)
- [Configuração de Chaves RSA](docs/KEYS_SETUP.md)
- [React SSR e Hydration](docs/HYDRATION.md)
- [Documentação da API](docs/API.md)

## 🛠️ Desenvolvimento Local (Sem Docker para o App)

Se preferir rodar apenas o Banco de Dados via Docker e o código localmente:

1. **Suba apenas o banco:**
   ```bash
   docker compose up -d janus-db
   ```

2. **Instale dependências:**
   ```bash
   npm install
   ```

3. **Configure as variáveis de ambiente:**
   Para desenvolvimento local, ajuste o `.env`:
   ```bash
   POSTGRES_HOST=localhost  # Use localhost em vez de janus-db
   DATABASE_URL="postgresql://janus_admin:123_senha_segura@localhost:5432/janus-db?schema=public"
   ```

4. **Execute as migrações e seed:**
   ```bash
   npm run db:push
   npm run db:seed
   ```

5. **Inicie o servidor em modo desenvolvimento:**
   ```bash
   npm run dev
   ```

## 📄 Licença

Este projeto está sob a licença ISC.
