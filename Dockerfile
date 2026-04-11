# Stage 1: Dependencies
FROM node:24.12.0-slim AS dependencies

WORKDIR /app

# Copia package files e instala todas as dependências (incluindo dev)
COPY package*.json ./
RUN npm ci

# Stage 2: Builder
FROM node:24.12.0-slim AS builder

WORKDIR /app

# Copia package files e instala todas as dependências (incluindo dev)
COPY package*.json ./
RUN npm ci

# Copia o código fonte
COPY . .

# Compila o TypeScript
RUN npm run build

# Stage 3: Production
FROM node:24.12.0-slim AS production

# Instala o wget para o healthcheck
RUN apt-get update -y && apt-get install -y wget && rm -rf /var/lib/apt/lists/*

# Cria usuário não-root para segurança
RUN groupadd -r nodejs && useradd -r -g nodejs nodejs

WORKDIR /app

# Copia dependências de produção do stage de dependencies
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/package*.json ./

# Copia ts-node e TypeScript para poder rodar TypeScript em produção
COPY --from=builder /app/node_modules/ts-node ./node_modules/ts-node
COPY --from=builder /app/node_modules/typescript ./node_modules/typescript

# Copia o código compilado do stage de builder
COPY --from=builder /app/dist ./dist
# Copia o diretório public com os assets client-side (incluindo o bundle de hidratação)
COPY --from=builder /app/public ./public

# Copia arquivos TypeScript e configs para poder rodar ts-node em produção
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/src ./src
COPY --from=builder /app/drizzle ./drizzle

# Cria diretório para chaves RSA com permissões adequadas
RUN mkdir -p /app/keys && chown -R nodejs:nodejs /app/keys

# Copia o script de inicialização que roda migrações e seed antes de iniciar
COPY --chown=nodejs:nodejs init.sh /app/init.sh
RUN chmod +x /app/init.sh

# Muda para usuário não-root
USER nodejs

EXPOSE 3000

# Usa o script de inicialização que roda migrações e seed antes de iniciar
ENTRYPOINT ["/app/init.sh"]
