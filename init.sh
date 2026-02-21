#!/bin/bash
# Script de inicialização do Janus IDP
# Executa migrações e seed antes de iniciar o servidor

set -e  # Encerra o script se algum comando falhar

echo "=========================================="
echo "Iniciando Janus IDP..."
echo "=========================================="

# Executa as migrações do banco de dados (push schema to database)
echo ""
echo "[1/3] Sincronizando schema do banco de dados..."
npx drizzle-kit push
echo "✓ Schema sincronizado com sucesso"

# Executa o seed para criar dados iniciais (incluindo cliente UX Auditor)
echo ""
echo "[2/3] Executando seed do banco de dados..."
npx ts-node drizzle/seed.ts
echo "✓ Seed concluído com sucesso"

# Inicia o servidor
echo ""
echo "[3/3] Iniciando servidor..."
echo "=========================================="
exec node dist/index.js
