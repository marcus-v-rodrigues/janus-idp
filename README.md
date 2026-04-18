# Janus-IDP

![OIDC Certified](https://img.shields.io/badge/OIDC-Certified-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?style=flat-square&logo=postgresql&logoColor=white)

**Janus-IDP** é um Provedor de Identidade (IdP) moderno, seguro e centralizado, baseado no protocolo **OpenID Connect (OIDC)**. Projetado para integrar sistemas de forma escalável e segura.

---

## 🚀 Início Rápido (Docker)

A forma mais simples de rodar o Janus-IDP é via Docker Compose.

1. **Configuração de Ambiente**:
   ```bash
   cp .env.example .env
   ```

2. **Criação da Rede**:
   ```bash
   docker network create ux-auditor-network
   ```

3. **Subir o Sistema**:
   ```bash
   docker compose up -d --build
   ```

O sistema estará disponível em:
- **Janus UI**: `http://localhost:3000`
- **Admin Portal**: `http://localhost:3000/admin`
- **OIDC Discovery**: `http://localhost:3000/oidc/.well-known/openid-configuration`

---

## 🏗️ Arquitetura e Tecnologia

O Janus é construído sobre pilares de alta performance e segurança:

- **Engine OIDC**: [`oidc-provider`](https://github.com/panva/node-oidc-provider) (v9.x).
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/) com PostgreSQL.
- **Frontend**: React com Renderização no Servidor (SSR) e Hidratação Client-side.
- **Segurança**: Assinatura RSA (RS256), Hashing Bcrypt e Proteção de Sessão.

---

## 📚 Documentação Detalhada

Clique nos links abaixo para explorar aspectos específicos do sistema:

| Seção | Descrição |
|-------|-----------|
| 🧠 [**Fundamentos**](docs/FUNDAMENTALS.md) | Teoria de Identidade, OIDC, lógica de papéis (RBAC) e conceitos. |
| 📐 [**Arquitetura**](docs/ARCHITECTURE.md) | Diagramas de componentes e fluxos OIDC (Authorization Code). |
| 🗄️ [**Banco de Dados**](docs/DATABASE.md) | Diagrama ERD, definições de tabelas e estratégia de persistência. |
| 🛡️ [**Segurança**](docs/SECURITY.md) | Gestão de chaves RSA, criptografia e headers de proteção. |
| 🔌 [**API de Gerenciamento**](docs/API.md) | Endpoints REST para integração programática e automatização. |
| 💻 [**Desenvolvimento**](docs/DEVELOPMENT.md) | Guia para desenvolvedores, SSR, Hydration e scripts de utilidade. |
| 🚀 [**Implantação**](docs/DEPLOYMENT.md) | Guia de produção, Docker, variáveis de ambiente e HTTPS. |

---

## 🛠️ Credenciais Padrão (Seed)

Ao rodar o `db:seed` (automático no Docker Compose), os seguintes dados são criados:

- **Administrador**:
  - **Email**: `admin@example.com` (ou definido no `.env`)
  - **Senha**: `admin123` (ou definida no `.env`)
- **Cliente OIDC**:
  - **Client ID**: `ux-auditor`
  - **Client Secret**: Gerado aleatoriamente ou fixo via seed.

---

## 📄 Licença

Este projeto é software livre sob a licença [ISC](LICENSE).
