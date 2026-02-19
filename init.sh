#!/bin/bash
# Script de inicialização do Janus IDP
# Executa migrações e seed antes de iniciar o servidor

set -e  # Encerra o script se algum comando falhar

echo "=========================================="
echo "Iniciando Janus IDP..."
echo "=========================================="

# Executa as migrações do banco de dados
echo ""
echo "[1/3] Executando migrações do banco de dados..."
npx prisma migrate deploy
echo "✓ Migrações concluídas com sucesso"

# Executa o seed para criar dados iniciais (incluindo cliente UX Auditor)
echo ""
echo "[2/3] Executando seed do banco de dados..."
npx prisma db seed
echo "✓ Seed concluído com sucesso"

# Inicia o servidor
echo ""
echo "[3/3] Iniciando servidor..."
echo "=========================================="
exec node dist/index.js
