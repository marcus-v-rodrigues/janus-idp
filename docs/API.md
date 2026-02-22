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

Cria um novo usuário no sistema e o vincula a um cliente específico para controle de acesso.

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
| `clientId` | string | Sim | ID do cliente OIDC ao qual o usuário será vinculado |

**Comportamento Idempotente**:

A API possui comportamento idempotente para facilitar integrações:

| Cenário | Status HTTP | Descrição |
|---------|-------------|-----------|
| Usuário novo | `201 Created` | Usuário criado e vinculado ao cliente |
| Usuário existe, senha correta, sem vínculo | `200 OK` | Vínculo criado (`isNewLink: true`) |
| Usuário existe, senha correta, já vinculado | `200 OK` | Sem alterações (`isNewLink: false`) |
| Usuário existe, senha incorreta | `401 Unauthorized` | Erro de credenciais |

**Respostas de Sucesso** (`201 Created` - Novo usuário):
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "email": "usuario@exemplo.com",
  "name": "Usuário de Exemplo",
  "role": "USER",
  "emailVerified": false,
  "createdAt": "2026-02-21T12:00:00.000Z",
  "updatedAt": "2026-02-21T12:00:00.000Z",
  "linkedToClient": true,
  "isNewLink": true
}
```

**Respostas de Sucesso** (`200 OK` - Usuário existente vinculado):
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "email": "usuario@exemplo.com",
  "name": "Usuário de Exemplo",
  "role": "USER",
  "emailVerified": false,
  "createdAt": "2026-02-21T12:00:00.000Z",
  "updatedAt": "2026-02-21T12:00:00.000Z",
  "linkedToClient": true,
  "isNewLink": true
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

- `400 Bad Request` - clientId faltando
```json
{
  "error": "Missing required field",
  "message": "clientId is required for user-client association"
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

## Controle de Acesso Granular

O Janus IdP implementa um sistema de controle de acesso granular que vincula usuários a clientes específicos. Isso garante que cada usuário só possa acessar as aplicações cliente às quais foi explicitamente autorizado.

### Como Funciona

1. **Criação de Usuário**: Ao criar um usuário via API, o campo `clientId` é obrigatório e define qual cliente o usuário poderá acessar
2. **Vínculo Múltiplo**: Um usuário pode ser vinculado a múltiplos clientes através de múltiplas chamadas à API
3. **Verificação no Login**: Durante o fluxo OIDC, o sistema verifica se o usuário tem permissão para acessar o cliente solicitante

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
// Retorno: 201 Created, isNewLink: true

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
// Retorno: 200 OK, isNewLink: true

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
// Retorno: 200 OK, isNewLink: false (já vinculado)
```

### Erro de Acesso Negado

Se um usuário tentar fazer login em uma aplicação cliente à qual não está vinculado, ele verá uma mensagem de erro:

```
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
| POST | `/oidc/introspection` | Endpoint de introspecção |
| POST | `/oidc/revocation` | Endpoint de revogação |
| GET | `/oidc/end_session` | Logout (RP-Initiated Logout) |

Para mais informações sobre o fluxo OIDC, consulte a documentação de [OpenID Connect Core](https://openid.net/connect/).
