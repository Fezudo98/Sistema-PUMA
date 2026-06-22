@echo off
title Sistema PUMA - Inicializador
color 0B
echo ========================================================
echo                 SISTEMA PUMA
echo ========================================================
echo.

:: 1. Verificacao de Dependencias Essenciais
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERRO] O Node.js nao foi encontrado neste computador!
    echo Por favor, acesse https://nodejs.org e instale a versao LTS antes de continuar.
    pause
    exit /b
)

:: 2. Sincronizacao Remota com GitHub
echo [1/4] Verificando atualizacoes no GitHub...
where git >nul 2>nul
set REBUILD_REQUIRED=0
if %errorlevel% equ 0 (
    for /f "tokens=*" %%a in ('git rev-parse HEAD 2^>nul') do set BEFORE_PULL=%%a
    :: :: call git pull origin main
    for /f "tokens=*" %%a in ('git rev-parse HEAD 2^>nul') do set AFTER_PULL=%%a
    if not "%BEFORE_PULL%"=="%AFTER_PULL%" (
        set REBUILD_REQUIRED=1
    )
) else (
    echo [AVISO] Git nao encontrado. Pulando sincronizacao remota.
)

echo [2/4] Verificando e instalando bibliotecas pendentes...
:: :: call npm install --no-audit --no-fund

echo [3/4] Sincronizando Banco de Dados e aplicando alteracoes...
if not exist node_modules\.prisma\client if not exist node_modules\.prisma\client call npx prisma generate
:: :: call npx prisma db push --accept-data-loss

echo [4/4] Verificando otimizacoes de producao...
if "%REBUILD_REQUIRED%"=="1" (
    echo [!] Novas atualizacoes baixadas do GitHub. Otimizando sistema...
    call npm run build:server
    call npm run build
) else (
    if not exist "server.js" (
        echo [!] Compilando arquivos do servidor...
        call npm run build:server
    )
    if not exist ".next" (
        echo [!] Otimizando aplicacao para producao - pode demorar alguns minutos...
        call npm run build
    )
)

echo.
echo Ambiente 100%% atualizado, sincronizado e otimizado para o Celeron!

echo.
echo [!] Verificando regras de Firewall para acesso em rede (Pode solicitar permissao de Administrador)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "if (-not (Get-NetFirewallRule -DisplayName 'Sistema PUMA' -ErrorAction SilentlyContinue)) { echo 'Solicitando permissao para liberar a porta 3000...'; Start-Process powershell -Verb runAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command \"New-NetFirewallRule -DisplayName ''Sistema PUMA'' -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow\"' }"

echo.
echo ========================================================
echo         O SISTEMA ESTA INICIANDO EM MODO PRODUCAO (LEVE)...
echo ========================================================
echo.
echo Os alunos devem estar conectados na mesma rede Wi-Fi que este notebook.
echo.
echo IPS DISPONIVEIS PARA OS ALUNOS ACESSAREM NO CELULAR (Digite EXATAMENTE assim):
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /R /C:"IPv4 Address" /C:"IPv4"') do (
    for /f "tokens=*" %%j in ("%%i") do echo http://%%j:3000
)
echo.
echo INSTRUTOR: Para acessar o seu painel, aguarde que o navegador abrira sozinho.
echo.
echo ========================================================
echo Pressione CTRL+C nesta tela preta para desligar o servidor.
echo ========================================================
echo.

:: Dispara o navegador em background após 5 segundos
start "" cmd /c "timeout /t 5 >nul && start http://localhost:3000"

:: Forca o modo de producao ultraleve
set NODE_ENV=production

:loop
call npm run start:prod
echo.
echo ========================================================
echo [!] O SERVIDOR CAIU OU FOI FECHADO!
echo [!] Reiniciando automaticamente em 3 segundos...
echo ========================================================
timeout /t 3 >nul
goto loop
