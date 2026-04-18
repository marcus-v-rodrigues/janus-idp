# Fundamentos e Lógica do Sistema

Este documento detalha a fundamentação teórica e a lógica de design do Janus-IDP, explicando por que o projeto existe, quais problemas ele resolve e os conceitos de segurança e identidade aplicados.

---

## 1. O Que é o Janus-IDP?

O Janus-IDP é um **Identity Provider (IdP)**. No contexto de **IAM (Identity and Access Management)**, ele é a autoridade central que detém a "verdade" sobre a identidade de um usuário.

### O Problema: Silos de Identidade
Em sistemas legados ou mal projetados, cada aplicação possui sua própria tabela de `usuarios` e seu próprio sistema de login. Isso gera:
- **Insegurança**: Múltiplas superfícies de ataque.
- **Má Experiência (UX)**: O usuário precisa de uma senha para cada sistema.
- **Fragmentação**: Difícil revogar o acesso de um usuário em todos os sistemas simultaneamente.

### A Solução: Identidade Federada
O Janus resolve isso através da **Federação de Identidade**. As aplicações (Clients) não conhecem a senha do usuário; elas apenas "confiam" no Janus. Se o Janus diz que o usuário é quem diz ser, a aplicação aceita.

---

## 2. Como Funciona a Lógica OIDC (OpenID Connect)

O Janus utiliza o protocolo **OpenID Connect (OIDC)**, que é uma camada de identidade construída sobre o **OAuth 2.0**.

- **OAuth 2.0**: Focado em **Autorização** (O que eu posso fazer? Ex: Acessar fotos). Ele emite um *Access Token*.
- **OIDC**: Focado em **Autenticação** (Quem sou eu?). Ele emite um *ID Token* (JWT).

### O Conceito de `sub` (Subject)
O `sub` é a peça fundamental da lógica. É um identificador único, imutável e nunca reatribuído (geralmente um UUID). 
- **Regra de Ouro**: Aplicações clientes devem usar o `sub` para identificar o usuário internamente, não o e-mail (que pode mudar).

---

## 3. Lógica de Autorização (RBAC)

O Janus implementa um modelo de **Controle de Acesso Baseado em Papéis (RBAC - Role-Based Access Control)**, mas com uma distinção importante:

### Papéis Globais vs. Papéis de Cliente
1. **Global Roles**: Papéis que têm significado em todo o ecossistema (ex: `janus_admin` ou `billing_admin`).
2. **Client Roles**: Papéis específicos de uma aplicação (ex: o usuário é `editor` no `App A`, mas apenas `viewer` no `App B`).

### Fluxo de Decisão
O Janus **não** decide se o usuário pode ver o botão "Excluir" no App A. 
1. O Janus autentica o usuário.
2. O Janus envia os papéis (roles) dentro do token.
3. O App A lê o token e decide: *"Se o papel 'editor' estiver aqui, eu mostro o botão"*.

---

## 4. Por que JWT e RS256?

### JWT (JSON Web Tokens)
Os tokens emitidos são **estateless** (sem estado). Isso significa que o token contém toda a informação necessária (claims). O servidor que recebe o token não precisa perguntar ao Janus "esse token é válido?" a cada segundo; ele pode validar a assinatura localmente.

### RS256 (Criptografia Assimétrica)
Utilizamos um par de chaves (Pública e Privada):
- **Chave Privada**: Só o Janus tem. Ele a usa para "carimbar" (assinar) o token.
- **Chave Pública**: Todo mundo tem. Elas a usam para verificar se o "carimbo" é legítimo.
Isso garante que ninguém consiga forjar um token sem ter a chave privada do Janus.

---

## 5. Arquitetura de Persistência (Stateless Server)

Embora o Janus use um banco de dados, o **servidor de aplicação é stateless**.
- Todas as sessões, grants e códigos de autorização são persistidos no PostgreSQL (tabela `OidcPayload`).
- **Consequência**: Você pode ter 10 instâncias do Janus rodando simultaneamente. Se uma cair, o usuário nem percebe, pois qualquer outra instância pode ler a sessão do banco de dados e continuar o processo.

---

## 6. Fluxo de Vida de uma Identidade

1. **Provisionamento**: O usuário é criado (via API ou Admin).
2. **Autenticação**: O usuário prova quem é (Senha + Login).
3. **Emissão de Claims**: O Janus calcula quais papéis aquele usuário tem para aquele cliente específico.
4. **Consumo**: O cliente recebe o token, valida a assinatura e cria a sessão local.
5. **Revogação**: Se o administrador desativar o usuário no Janus, o próximo *Refresh Token* falhará, e o acesso será cortado em todo o ecossistema.
