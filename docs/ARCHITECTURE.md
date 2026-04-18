# Arquitetura do Sistema

O Janus-IDP é um ecossistema de autenticação e autorização projetado para ser o nó central de confiança. Ele é construído sobre a engine `oidc-provider`, o que garante conformidade com as normas do **OpenID Foundation**.

## Componentes do Sistema

```mermaid
graph TD
    subgraph "External World"
        ClientApp[Cliente OIDC / NextAuth]
        UserAgent[Navegador do Usuário]
    end

    subgraph "Janus-IDP Server"
        Express[Express Engine]
        OIDC[OIDC Engine]
        Adapter[Drizzle Adapter]
        UI[React SSR Views]
        API[Management API]
    end

    subgraph "Data Layer"
        Postgres[(PostgreSQL)]
        Keys[RSA Keys]
    end

    UserAgent -- "1. Acesso UI" --> Express
    Express -- "2. Delegação" --> OIDC
    OIDC -- "3. Persistência" --> Adapter
    Adapter -- "4. SQL" --> Postgres
    OIDC -- "5. Assinatura" --> Keys
    ClientApp -- "6. API Calls" --> API
    API -- "7. CRUD" --> Postgres
```

## Fluxo de Autenticação (Authorization Code)

O Janus implementa o fluxo mais seguro do OIDC, garantindo que credenciais nunca toquem o cliente.

```mermaid
sequenceDiagram
    participant U as Usuário
    participant C as Cliente (App)
    participant J as Janus-IDP
    
    Note over C,J: 1. Início do Fluxo
    U->>C: Clica em "Login"
    C->>J: Redireciona para /oidc/auth (inclui PKCE)
    
    Note over J,U: 2. Interação no Janus
    J->>U: Renderiza Login (View: oidc/Login.tsx)
    U->>J: Submete Credenciais (POST /interaction/login)
    J->>J: Valida usuário no DB e verifica vínculos
    J->>U: Renderiza Consentimento (se necessário)
    U->>J: Aprova Consentimento (POST /interaction/confirm)
    
    Note over J,C: 3. Finalização
    J->>C: Redireciona para redirect_uri + authorization_code
    C->>J: Troca code por Token (POST /oidc/token)
    J->>C: Retorna ID Token (JWT) e Access Token
    
    Note over C,U: 4. Sessão Iniciada
    C->>U: Logado com Sucesso
```

## Estratégia de Autorização (Claims)

O Janus utiliza um modelo de **Autorização Descentralizada**. Ele não toma decisões de acesso para os clientes, mas entrega a "verdade" sobre o usuário.

1. **Claims**: Ao emitir um `id_token`, o Janus inclui uma claim customizada chamada `roles`.
2. **Formato do Contrato**:
   ```json
   {
     "roles": {
       "global": ["janus_admin"],
       "client": [
         { "code": "editor", "clientId": "ux-auditor" }
       ]
     }
   }
   ```
3. **Decisão Local**: O cliente (ex: uma aplicação Next.js) recebe este objeto e decide, localmente, se o usuário pode acessar determinada rota `/admin`.

## SSR e Hydration

A interface do Janus (login, consentimento, dashboard admin) é renderizada no servidor para:
- **Segurança**: Credenciais processadas no servidor.
- **Performance**: FCP (First Contentful Paint) imediato.
- **SEO/Audit**: Facilidade de rastreamento.

Após o carregamento inicial, o React "hidrata" o cliente para permitir interatividade sem recarregar a página inteiramente em transições administrativas.

## Escalabilidade e Stateless

O Janus é majoritariamente **stateless**. 
- Todo o estado de sessões e grants reside no banco de dados via `OidcPayload`.
- Isso permite que você escale o número de réplicas do container `janus-idp` horizontalmente atrás de um Load Balancer sem perder sessões ativas.
