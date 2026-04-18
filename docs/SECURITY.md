# Segurança e Gestão de Chaves

A segurança é o pilar central do Janus-IDP. Implementamos múltiplos níveis de proteção para garantir a integridade dos dados e a confiabilidade dos tokens de identidade.

## Algoritmos de Assinatura (RS256)

O Janus utiliza **RS256** (RSA Signature with SHA-256) para assinar todos os tokens JWT e ID Tokens emitidos. 

1. **Chave Privada**: Permanece exclusivamente no servidor Janus, usada para assinar os tokens.
2. **Chave Pública**: Exposta publicamente no endpoint `/oidc/jwks`. Clientes baixam esta chave para validar a assinatura dos tokens recebidos.

---

## Gestão de Chaves RSA

As chaves RSA são essenciais para o funcionamento do OIDC. O Janus gerencia isso de três formas:

### 1. Geração Automática (Desenvolvimento)
Se nenhuma chave for configurada, o Janus gerará um par de chaves RSA-2048 em memória na inicialização.

### 2. Persistência em Disco
O Janus tentará salvar/ler chaves de `./keys/private.pem` e `./keys/public.pem`.
No Docker, o volume `rsa_keys` garante que a mesma chave seja usada mesmo após reinicializações.

### 3. Variáveis de Ambiente (Recomendado para Produção)
Para maior segurança, você pode passar as chaves codificadas em **Base64** via variáveis de ambiente:
- `RSA_PRIVATE_KEY`
- `RSA_PUBLIC_KEY`

**Como gerar:**
```bash
npm run generate-keys
```
*(O script exibirá as chaves em Base64 prontas para o seu arquivo `.env`)*

---

## Proteção de Credenciais

- **Senhas**: Nunca são armazenadas em texto plano. Utilizamos o algoritmo **Bcrypt** com um fator de custo apropriado para resistir a ataques de força bruta.
- **Cookies de Sessão**:
    - **HttpOnly**: Protege contra roubo de cookies via ataques XSS.
    - **Secure**: Em produção, os cookies só viajam via HTTPS.
    - **SameSite**: Definido como `Lax` por padrão para equilibrar segurança CSRF e usabilidade OIDC.

---

## Segurança da Rede (Docker)

O Janus foi projetado para rodar em uma rede isolada (`ux-auditor-network`). 
- Apenas a porta do Janus-IDP (ex: 3000) deve ser exposta ao balanceador de carga externo.
- A comunicação com o banco de dados PostgreSQL ocorre em rede interna, protegida pelo Docker.

---

## Headers de Segurança (Helmet)

Implementamos o middleware **Helmet.js** que configura automaticamente headers HTTP de proteção:
- `Content-Security-Policy` (CSP)
- `X-Frame-Options` (Prevenção de Clickjacking)
- `X-Content-Type-Options` (Prevenção de MIME sniffing)

---

## Melhores Práticas para Produção

1. **Sempre use HTTPS**: Tokens de autenticação transmitidos via HTTP são vulneráveis a interceptação.
2. **Rotação de Chaves**: Planeje a rotação periódica das chaves RSA. O Janus permite múltiplas chaves no JWKS para transição suave (grace period).
3. **Segredos Fortes**: Utilize segredos longos e aleatórios para `COOKIE_SECRET`, `JANUS_SERVICE_API_KEY` e `OIDC_COOKIES_KEYS`.
