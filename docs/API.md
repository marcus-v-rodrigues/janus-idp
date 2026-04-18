# Documentação da API de Gerenciamento

O Janus-IDP expõe uma API RESTful para integração programática com serviços do ecossistema. Através desta API, é possível gerenciar usuários e vínculos de papéis de forma automatizada.

## Autenticação

Todos os endpoints requerem o header `X-Service-Key`. 
- **Header**: `X-Service-Key: <sua-chave-de-serviço>`
- **Configuração**: Definida na variável de ambiente `JANUS_SERVICE_API_KEY`.

---

## Endpoints

### 1. Criar Usuário
`POST /api/register`

Endpoint para criação de novos usuários no sistema.

**Body (JSON):**
```json
{
  "email": "user@example.com",
  "password": "strongPassword123",
  "name": "Nome do Usuário"
}
```

**Respostas:**
- **`201 Created`**: Novo usuário criado e papel básico `user` atribuído.
- **`409 Conflict`**: Usuário já existe no sistema.
- **`400 Bad Request`**: Dados inválidos (email mal formatado, senha curta).
- **`401 Unauthorized`**: Chave de serviço inválida.

---

### 2. Gerenciar Papéis de Cliente
`POST /api/roles/assignments`

Permite que um serviço externo gerencie os papéis de seus usuários dentro do Janus-IDP.

**Headers**:
- `X-Service-Key`: `<service-api-key>` (obrigatório)

**Body (JSON):**
```json
{
  "email": "usuario@exemplo.com",
  "clientId": "meu-app-cliente",
  "roleCode": "editor",
  "action": "add" 
}
```

**Campos**:
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `email` | string | Email do usuário alvo |
| `clientId` | string | ID do cliente OIDC ao qual o papel pertence |
| `roleCode` | string | Código identificador do papel (ex: 'admin', 'editor') |
| `action` | string | Ação a realizar: `"add"` ou `"remove"` |

**Respostas:**
- **`200 OK`**: Ação realizada com sucesso. Retorna o objeto do usuário atualizado.
- **`404 Not Found`**: Usuário, Cliente ou Papel não encontrado.
- **`400 Bad Request`**: Campos obrigatórios faltando ou ação inválida.
- **`401 Unauthorized`**: Chave de serviço inválida.
- **`500 Internal Server Error`**: Erro no processamento.

---

### 3. Listar Usuários (Admin)
`GET /api/admin/users`
*(Requer autenticação de sessão de administrador no navegador ou chave de serviço)*

Retorna uma lista paginada de todos os usuários cadastrados.

---

## Melhores Práticas de Integração

### Sincronização de Usuários
1. Use `POST /api/register` para garantir que o usuário tenha uma conta no Janus.
2. Se receber `409 Conflict`, o usuário já existe e você pode prosseguir para a gestão de papéis.
3. Use `POST /api/roles/assignments` com `action: "add"` para conceder acesso às funcionalidades do seu sistema.

### Segurança em Clientes
**NUNCA** exponha sua `JANUS_SERVICE_API_KEY` no frontend de uma aplicação. Esta chave deve ser utilizada apenas em chamadas Server-to-Server (Backend-to-Backend). Para o registro público de usuários via navegador, utilize a tela de registro OIDC em `/oidc/interaction/:uid/register`.

### Verificação de Saúde (Healthcheck)
`GET /health`

Retorna o estado de saúde do serviço e a conectividade com o banco de dados.
**Resposta:** `200 OK`
```json
{
  "status": "ok",
  "database": "connected"
}
```
