# Documentação da API

O Janus IdP expõe uma API REST para integração com serviços externos. Esta API permite criar usuários programaticamente para uso em integrações com outros serviços do ecossistema UX Auditor.

## Autenticação

Todos os endpoints da API requerem autenticação via header `X-Service-Key`.

```bash
X-Service-Key: <sua-chave-de-api>
```

A chave de API deve ser configurada na variável de ambiente `JANUS_SERVICE_API_KEY`.

## Base URL

```
http://localhost:3000/api
```

## Endpoints

### Criar Usuário

Cria um novo usuário no sistema e garante o papel global `user`. Se `clientId` for informado, o endpoint também atribui o papel padrão do cliente e devolve os papéis globais e específicos do cliente na resposta.

**Endpoint**: `POST /api/users`

**Headers**:
- `Content-Type`: `application/json`
- `X-Service-Key`: `<service-api-key>` (obrigatório)

**Body**:
```json
{
  "email": "usuario@exemplo.com",
  "password": "senhaSegura123",
  "name": "Usuário de Exemplo",
  "clientId": "meu-cliente-oidc"
}
```

**Campos**:
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `email` | string | Sim | Email válido do usuário |
| `password` | string | Sim | Senha com mínimo 6 caracteres |
| `name` | string | Não | Nome do usuário |
| `clientId` | string | Não | ID do cliente OIDC ao qual o usuário receberá o papel padrão |

**Comportamento Idempotente**:

A API possui comportamento idempotente para facilitar integrações:

| Cenário | Status HTTP | Descrição |
|---------|-------------|-----------|
| Usuário novo | `201 Created` | Usuário criado e papéis atribuídos |
| Usuário existe, senha correta, sem papel de cliente | `200 OK` | Papel padrão atribuído ao cliente, se aplicável |
| Usuário existe, senha correta, papéis já presentes | `200 OK` | Sem duplicação |
| Usuário existe, senha incorreta | `401 Unauthorized` | Erro de credenciais |

**Respostas de Sucesso** (`201 Created` - Novo usuário):
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "sub": "123e4567-e89b-12d3-a456-426614174000",
  "email": "usuario@exemplo.com",
  "name": "Usuário de Exemplo",
  "emailVerified": false,
  "createdAt": "2026-02-21T12:00:00.000Z",
  "updatedAt": "2026-02-21T12:00:00.000Z",
  "globalRoles": ["user"],
  "clientRoles": [
    { "code": "user", "clientId": "meu-cliente-oidc" }
  ],
  "created": true,
  "clientRoleCode": "user"
}
```

**Respostas de Sucesso** (`200 OK` - Usuário existente vinculado):
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "sub": "123e4567-e89b-12d3-a456-426614174000",
  "email": "usuario@exemplo.com",
  "name": "Usuário de Exemplo",
  "emailVerified": false,
  "createdAt": "2026-02-21T12:00:00.000Z",
  "updatedAt": "2026-02-21T12:00:00.000Z",
  "globalRoles": ["user"],
  "clientRoles": [
    { "code": "user", "clientId": "meu-cliente-oidc" }
  ],
  "created": false,
  "clientRoleCode": "user"
}
```

**Respostas de Erro**:

- `400 Bad Request` - Campos obrigatórios faltando
```json
{
  "error": "Missing required fields",
  "message": "email and password are required"
}
```

- `400 Bad Request` - Cliente não encontrado
```json
{
  "error": "Invalid client",
  "message": "The specified client does not exist"
}
```

- `400 Bad Request` - Email inválido
```json
{
  "error": "Invalid email",
  "message": "The provided email is not valid"
}
```

- `400 Bad Request` - Senha inválida
```json
{
  "error": "Invalid password",
  "message": "Password must be at least 6 characters long"
}
```

- `401 Unauthorized` - Senha incorreta para usuário existente
```json
{
  "error": "Invalid credentials",
  "message": "A user with this email already exists but the password is incorrect"
}
```

- `401 Unauthorized` - Chave de API inválida
```json
{
  "error": "Unauthorized",
  "message": "Invalid service key"
}
```

- `500 Internal Server Error` - Erro interno do servidor
```json
{
  "error": "Internal server error",
  "message": "An error occurred while creating the user"
}
```

## Exemplos

### cURL

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -H "X-Service-Key: your_service_api_key_here_change_in_production" \
  -d '{
    "email": "usuario@exemplo.com",
    "password": "senhaSegura123",
    "name": "Usuário de Exemplo",
    "clientId": "meu-cliente-oidc"
  }'
```

### JavaScript (Fetch)

```javascript
const response = await fetch('http://localhost:3000/api/users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Service-Key': 'your_service_api_key_here_change_in_production'
  },
  body: JSON.stringify({
    email: 'usuario@exemplo.com',
    password: 'senhaSegura123',
    name: 'Usuário de Exemplo',
    clientId: 'meu-cliente-oidc'
  })
});

const user = await response.json();
console.log(user);
```

### Python (requests)

```python
import requests

headers = {
    'Content-Type': 'application/json',
    'X-Service-Key': 'your_service_api_key_here_change_in_production'
}

data = {
    'email': 'usuario@exemplo.com',
    'password': 'senhaSegura123',
    'name': 'Usuário de Exemplo',
    'clientId': 'meu-cliente-oidc'
}

response = requests.post('http://localhost:3000/api/users', headers=headers, json=data)
user = response.json()
print(user)
```

## Best Practices

### Segurança

1. **Nunca exponha a chave de API** no código frontend
2. **Use HTTPS** em produção para criptografar todas as requisições
3. **Alterne a chave de API** periodicamente
4. **Use chaves diferentes** para diferentes ambientes (dev, staging, prod)

### Validações

A API realiza as seguintes validações no lado do servidor:

- **Email**: Formato válido usando regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- **Senha**: Mínimo de 6 caracteres
- **clientId**: Verifica se o cliente existe no sistema
- **Vínculo usuário-cliente**: Verifica duplicatas antes de criar vínculo

### Retry e Error Handling

```javascript
async function createUserWithRetry(userData, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch('http://localhost:3000/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Key': 'your_service_api_key_here_change_in_production'
        },
        body: JSON.stringify(userData)
      });

      if (response.ok) {
        return await response.json();
      }

      const error = await response.json();
      
      // Erros que não devem ser retentados
      if (response.status === 400) {
        // Erro de validação - não retry
        throw new Error(error.message);
      }
      if (response.status === 401) {
        // Credenciais incorretas ou chave inválida - não retry
        throw new Error(error.message);
      }

      // Aguarde antes de retry para erros transitórios
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    } catch (error) {
      if (i === maxRetries - 1) throw error;
    }
  }
}
```

## Papéis e Acesso no Cliente

O Janus IdP autentica o usuário e devolve os papéis dele no retorno da API e nas claims OIDC. A decisão de acesso a rotas e funcionalidades passa a ser responsabilidade do cliente.

### Como Funciona

1. **Criação de Usuário**: Ao criar um usuário via API, o campo `clientId` atribui o papel padrão daquele cliente
2. **Vínculo Múltiplo**: Um usuário pode receber papéis de vários clientes em chamadas diferentes
3. **Autenticação OIDC**: No login, o Janus autentica o usuário e emite os papéis globais e de cliente
4. **Autorização no App**: O cliente usa esses papéis para proteger rotas e tratar acesso negado

### Exemplo de Múltiplos Vínculos

```javascript
// Primeiro vínculo - cria o usuário
await fetch('http://localhost:3000/api/users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Service-Key': 'your_service_api_key'
  },
  body: JSON.stringify({
    email: 'usuario@exemplo.com',
    password: 'senhaSegura123',
    name: 'Usuário de Exemplo',
    clientId: 'cliente-app-1'
  })
});
// Retorno: 201 Created

// Segundo vínculo - adiciona acesso a outro cliente
await fetch('http://localhost:3000/api/users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Service-Key': 'your_service_api_key'
  },
  body: JSON.stringify({
    email: 'usuario@exemplo.com',
    password: 'senhaSegura123',
    clientId: 'cliente-app-2'
  })
});
// Retorno: 200 OK

// Tentativa duplicada - idempotente
await fetch('http://localhost:3000/api/users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Service-Key': 'your_service_api_key'
  },
  body: JSON.stringify({
    email: 'usuario@exemplo.com',
    password: 'senhaSegura123',
    clientId: 'cliente-app-2'
  })
});
// Retorno: 200 OK
```

### Claims OIDC

Quando o cliente solicita o escopo `profile`, o Janus inclui uma claim `roles` com a seguinte estrutura:

```json
{
  "roles": {
    "global": ["user"],
    "client": [
      { "code": "user", "clientId": "meu-cliente-oidc" }
    ]
  }
}
```

O cliente deve usar essas claims para decidir acesso a páginas, rotas e recursos.

### Acesso Negado no Cliente

Se o usuário não tiver o papel necessário para uma rota ou área do app, o próprio cliente deve mostrar a interface de acesso negado.

Exemplo de mensagem:

```text
Access Denied
Você não tem permissão para acessar esta aplicação. Entre em contato com o administrador para solicitar acesso.
```

## Endpoints Internos (Admin)

Além da API pública, o Janus IdP possui endpoints internos acessíveis através do portal administrativo em `/admin`. Estes endpoints são protegidos por autenticação de sessão e não são destinados para uso direto por serviços externos.

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/admin` | Dashboard com estatísticas |
| GET/POST | `/admin/login` | Login do administrador |
| GET | `/admin/logout` | Logout do administrador |
| GET | `/admin/clients` | Lista de clientes |
| GET | `/admin/clients/new` | Formulário novo cliente |
| GET | `/admin/clients/:id/edit` | Formulário editar cliente |
| POST | `/admin/clients` | Criar/atualizar cliente |
| POST | `/admin/clients/:id/delete` | Excluir cliente |
| GET | `/admin/clients/generate-secret` | Gerar novo client secret |
| GET | `/admin/users` | Lista de usuários |
| POST | `/admin/users/:id/reset-password` | Redefinir senha do usuário |
| POST | `/admin/users/:id/toggle-role` | Alternar função do usuário |

## Endpoints OIDC (OpenID Connect)

O provedor OIDC expõe os endpoints padrão do protocolo no caminho `/oidc`:

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/oidc/.well-known/openid-configuration` | Configuração do provedor |
| GET | `/oidc/jwks` | Conjunto de chaves públicas |
| GET | `/oidc/auth` | Endpoint de autorização |
| POST | `/oidc/token` | Endpoint de token |
| GET | `/oidc/userinfo` | Endpoint OIDC de informações do usuário |
| POST | `/oidc/introspection` | Endpoint de introspecção |
| POST | `/oidc/revocation` | Endpoint de revogação |
| GET | `/oidc/end_session` | Logout (RP-Initiated Logout) |

Exemplo de uso do `userinfo` com `curl`:

```bash
curl -H "Authorization: Bearer <access_token>" \
  http://localhost:3000/oidc/userinfo
```

Exemplo de retorno do `GET /oidc/userinfo`:

```json
{
  "sub": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Usuário de Exemplo",
  "email": "usuario@exemplo.com",
  "email_verified": true
}
```

Para mais informações sobre o fluxo OIDC, consulte a documentação de [OpenID Connect Core](https://openid.net/connect/).
