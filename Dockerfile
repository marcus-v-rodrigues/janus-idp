FROM node:24.12.0-slim

# Instala dependências necessárias para o Prisma (openssl)
RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Gera o Prisma Client durante o build
RUN npx prisma generate

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
