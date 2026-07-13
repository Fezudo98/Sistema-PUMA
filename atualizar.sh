#!/bin/bash
# Script de Atualização do PUMA para VPS Linux
set -e

echo "========================================================"
echo "                 SISTEMA PUMA - ATUALIZADOR (LINUX)"
echo "========================================================"
echo

# 1. Puxar alterações do repositório
echo "[1/4] Baixando códigos atualizados do GitHub..."
git fetch origin
git reset --hard origin/main

# 2. Instalar novas bibliotecas
echo "[2/4] Verificando e instalando bibliotecas pendentes..."
npm install --no-audit --no-fund

# 3. Sincronizar Banco de Dados
echo "[3/4] Sincronizando Banco de Dados e aplicando alterações..."
npx prisma generate
npx prisma db push

# 4. Compilar aplicação
echo "[4/4] Gerando build otimizado de produção..."
npm run build:server
npm run build

# 5. Reiniciar o processo PM2
echo "Reiniciando o servidor PUMA no PM2..."
if pm2 show puma-server > /dev/null 2>&1; then
    pm2 reload puma-server
else
    pm2 start npm --name "puma-server" -- run start
fi

echo
echo "========================================================"
echo "        ATUALIZAÇÃO CONCLUÍDA COM SUCESSO!"
echo "========================================================"
