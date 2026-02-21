# Configuração de Chaves JWKS para RS256

Este documento explica como o Janus IdP gerencia chaves RSA para assinatura RS256.

## Visão Geral

O provedor OIDC usa o algoritmo RS256 para assinar tokens ID e JWTs. Isso requer um par de chaves RSA (chave privada para assinatura, chave pública para verificação).

## Formato de Chaves

O oidc-provider espera as chaves no formato JWK (JSON Web Key). Existem dois tipos de JWK:

1. **JWK Público**: Contém apenas parâmetros públicos (n, e, kty, alg, use, kid)
   - Usado para verificação de assinaturas
   - Exposto no endpoint JWKS

2. **JWK Privado**: Contém todos os parâmetros, incluindo os privados (d, p, q, dp, dq, qi)
   - Usado para assinar tokens
   - NUNCA deve ser exposto publicamente

**Importante**: O oidc-provider PRECISA do JWK privado completo para poder assinar tokens com RS256. Por isso, a função `getPemKeys()` converte a chave privada PEM para JWK completo com todos os parâmetros.

## Geração Automática de Chaves

Ao iniciar o servidor sem fornecer chaves, o sistema irá:

1. Gerar automaticamente um novo par de chaves RSA-2048
2. Tentar salvar as chaves no diretório `./keys/` (se houver permissão)
3. Usar essas chaves para assinar tokens

**Nota:** Isso é adequado para desenvolvimento, mas NÃO é recomendado para produção.

**Ambientes Docker:** O Dockerfile foi configurado para criar o diretório `/app/keys` com as permissões adequadas antes de mudar para o usuário não-root. Isso permite que a aplicação salve as chaves RSA no container.

O docker-compose.yml já está configurado com um volume `rsa_keys` para persistir as chaves entre reinicializações do container:

```yaml
volumes:
  - rsa_keys:/app/keys
```

Isso garante que:
- As chaves RSA sejam geradas apenas na primeira execução
- As chaves sejam persistidas entre reinicializações do container
- O container tenha permissão para escrever no diretório `/app/keys`

Se o servidor não tiver permissão para criar o diretório `./keys/`, as chaves serão geradas apenas na memória. Isso é aceitável para testes em containers, mas para produção use variáveis de ambiente.

## Geração Manual de Chaves

Você pode gerar chaves manualmente usando o script fornecido:

```bash
npm run generate-keys
```

Isso irá:
- Gerar um novo par de chaves RSA-2048
- Salvar `private.pem` e `public.pem` no diretório `./keys/`
- Exibir a chave pública para referência

## Configuração de Produção

Para produção, você deve:

1. **Gerar chaves seguras** (use um ambiente seguro ou HSM)
2. **Definir variáveis de ambiente** com suas chaves no formato PEM codificadas em Base64:

```bash
# Gerar chaves e codificar em Base64
npm run generate-keys

# O script irá exibir as chaves já codificadas em Base64 para copiar para o .env
# Ou você pode codificar manualmente:
cat keys/private.pem | base64 -w 0  # Para RSA_PRIVATE_KEY
cat keys/public.pem | base64 -w 0   # Para RSA_PUBLIC_KEY
```

```bash
# No seu arquivo .env ou ambiente de produção
# As chaves devem estar codificadas em Base64
RSA_PRIVATE_KEY="LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCi4uLgotLS0tLUVORCBQUklWQVRFIEtFWS0tLS0t"
RSA_PUBLIC_KEY="LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KLi4uCi0tLS0tRU5EIFBVQkxJQyBLRVktLS0tLQ=="
```

3. **Nunca faça commit das chaves no controle de versão** (o diretório `keys/` está no `.gitignore`)

**Alternativa para Docker:** Você pode gerar as chaves localmente e montá-las como volume no container:

```bash
# Gera as chaves localmente
npm run generate-keys

# No docker-compose.yml, descomente ou adicione:
# volumes:
#   - ./keys:/app/keys:ro  # :ro para somente leitura
```

Isso permite que você mantenha as chaves no host e o container as leia sem precisar de variáveis de ambiente.

## Rotação de Chaves

Para rotacionar chaves em produção:

1. Gere um novo par de chaves
2. Adicione a nova chave pública ao endpoint JWKS
3. Atualize as variáveis de ambiente `RSA_PRIVATE_KEY` e `RSA_PUBLIC_KEY`
4. Reinicie o servidor

## Verificação

Após iniciar o servidor, você pode verificar o endpoint JWKS:

```bash
curl http://localhost:3000/oidc/jwks
```

Isso deve retornar uma resposta JSON com sua chave pública no formato JWKS:

```json
{
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "kid": "abc123...",
      "alg": "RS256",
      "n": "...",
      "e": "AQAB"
    }
  ]
}
```

## Melhores Práticas de Segurança

1. **Tamanho da Chave**: Use RSA-2048 ou RSA-4096 para produção
2. **Armazenamento**: Armazene chaves privadas de forma segura (ex: AWS KMS, HashiCorp Vault)
3. **Acesso**: Restrinja o acesso às chaves privadas
4. **Rotação**: Roteie as chaves regularmente (ex: a cada 90 dias)
5. **Backup**: Mantenha backups seguros das chaves
6. **Ambiente**: Nunca faça commit de chaves no controle de versão

## Solução de Problemas

### Chaves não encontradas

Se você ver a mensagem "Nenhuma chave RSA encontrada":
- O sistema irá gerar automaticamente novas chaves
- Verifique o diretório `./keys/` para as chaves geradas

### Erro de permissão ao criar diretório

Se você ver um erro `EACCES: permission denied, mkdir '/app/keys'`:
- Isso geralmente acontece em ambientes Docker onde o usuário não tem permissão para criar diretórios
- O sistema irá gerar as chaves apenas na memória e continuar funcionando
- Para produção, use variáveis de ambiente `RSA_PRIVATE_KEY` e `RSA_PUBLIC_KEY`
- Para desenvolvimento local, verifique as permissões do diretório

**Solução Docker:** O Dockerfile já está configurado para criar o diretório `/app/keys` com as permissões corretas antes de mudar para o usuário não-root. Se você ainda encontrar este erro, reconstrua a imagem:

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

O docker-compose.yml também está configurado com um volume `rsa_keys` para persistir as chaves entre reinicializações do container.

### Formato de chave inválido

Certifique-se de que suas chaves estejam codificadas em Base64:
- As variáveis de ambiente `RSA_PRIVATE_KEY` e `RSA_PUBLIC_KEY` devem conter chaves PEM codificadas em Base64
- Para codificar uma chave PEM em Base64: `cat private.pem | base64 -w 0`
- O sistema decodifica automaticamente as chaves de Base64 para PEM ao carregá-las
- O formato PEM original deve incluir `-----BEGIN PRIVATE KEY-----` e `-----END PRIVATE KEY-----` (ou `-----BEGIN PUBLIC KEY-----` e `-----END PUBLIC KEY-----`)

### Endpoint JWKS não respondendo

Verifique se:
- O provedor OIDC está em execução
- A rota `/oidc` está configurada corretamente
- As chaves foram carregadas corretamente (verifique os logs do servidor)
