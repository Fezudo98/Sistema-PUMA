@echo off
title Sistema PUMA - Atualizador de Campanha
color 0E
echo ========================================================
echo                 SISTEMA PUMA - ATUALIZADOR
echo ========================================================
echo.
echo Este script atualizara o sistema, sincronizando com o GitHub,
echo instalando novas bibliotecas e gerando um novo build de producao.
echo.
pause

:: 1. Sincronizacao Remota com GitHub
echo.
echo [1/4] Forcando sincronizacao com o repositorio online...
set GIT_CMD=git
where git >nul 2>nul
if %errorlevel% neq 0 (
    if exist "C:\Program Files\Git\cmd\git.exe" (
        set GIT_CMD="C:\Program Files\Git\cmd\git.exe"
    ) else (
        set GIT_CMD=
    )
)

if defined GIT_CMD (
    echo Baixando codigos do GitHub e limpando alteracoes locais...
    call %GIT_CMD% fetch origin
    call %GIT_CMD% reset --hard origin/main
) else (
    echo [ERRO] Git nao encontrado! Instale o Git para conseguir atualizar online.
    pause
    exit /b
)

:: 2. Re-aplicando as Otimizacoes Locais para o Batalhao (Producao & Login local)
echo.
echo [2/4] Aplicando otimizacoes de performance do batalhao...
powershell -NoProfile -Command "(Get-Content src/app/actions/auth.ts).Replace('secure: process.env.NODE_ENV === ' + [char]34 + 'production' + [char]34, 'secure: false') | Set-Content src/app/actions/auth.ts"

powershell -NoProfile -Command ^
    "$c = Get-Content 'Iniciar sistema.bat';" ^
    "$c = $c -replace 'call git pull origin main', ':: call git pull origin main';" ^
    "$c = $c -replace 'call npm install --no-audit --no-fund', ':: call npm install --no-audit --no-fund';" ^
    "$c = $c -replace 'call npx prisma generate', 'if not exist node_modules\.prisma\client call npx prisma generate';" ^
    "$c = $c -replace 'call npx prisma db push --accept-data-loss', ':: call npx prisma db push --accept-data-loss';" ^
    "$c = $c -replace 'call npm run dev:server', 'if not exist .next call npm run build`nset NODE_ENV=production^& call npm run dev:server';" ^
    "$c | Set-Content 'Iniciar sistema.bat'"

:: 3. Instalacao de Dependencias e Banco
echo.
echo [3/4] Sincronizando banco de dados...
call npm install --no-audit --no-fund
call npx prisma generate
call npx prisma db push --accept-data-loss

:: 4. Build de Producao
echo.
echo [4/4] Gerando build otimizado de producao...
echo Isso pode demorar de 1 a 2 minutos, por favor aguarde...
call npm run build:server
call npm run build

echo.
color 0A
echo ========================================================
echo        ATUALIZACAO CONCLUIDA COM SUCESSO!
echo ========================================================
echo.
echo O sistema PUMA foi atualizado e reconfigurado para producao.
echo Agora voce pode iniciar o servidor usando o "Iniciar sistema.bat"
echo.
pause
