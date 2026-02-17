# Stage 1: Dependencies
FROM node:24.12.0-slim AS dependencies

# Instala dependências necessárias para o Prisma (openssl)
RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

# Copia package files e instala todas as dependências (incluindo dev)
COPY package*.json ./
RUN npm ci

# Stage 2: Builder
FROM node:24.12.0-slim AS builder

# Instala dependências necessárias para o Prisma (openssl)
RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

# Copia package files e instala todas as dependências (incluindo dev)
COPY package*.json ./
RUN npm ci

# Copia o código fonte
COPY . .

# Gera o Prisma Client durante o build
RUN npx prisma generate

# Compila o TypeScript
RUN npm run build

# Compila o seed script
RUN npx tsc prisma/seed.ts --outDir dist/prisma --module commonjs --target es2022 --esModuleInterop --skipLibCheck

# Stage 3: Production
FROM node:24.12.0-slim AS production

# Instala dependências necessárias para o Prisma (openssl)
RUN apt-get update -y && apt-get install -y openssl

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
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Copia arquivos TypeScript e configs para poder rodar ts-node em produção
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Traz o cliente Prisma gerado (o motor do banco) do builder para a produção
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Cria script de startup que roda migrações antes de iniciar
RUN echo '#!/bin/sh\n\
set -e\n\
echo "Running database migrations..."\n\
npx prisma migrate deploy\n\
echo "Migrations completed successfully"\n\
echo "Starting application..."\n\
exec node dist/index.js\n\
' > /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh

# Muda para usuário não-root
USER nodejs

EXPOSE 3000

# Usa o script de entrypoint que roda migrações antes de iniciar
ENTRYPOINT ["/app/docker-entrypoint.sh"]
