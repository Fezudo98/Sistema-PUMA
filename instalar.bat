@echo off
color 0B
title Instalacao do Sistema PUMA

echo ========================================================
echo     SISTEMA PUMA - PREPARACAO DE CAMPANHA (PRIMEIRO USO)
echo ========================================================
echo.

echo [1] Verificando Node.js...
node -v >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    color 0C
    echo [ERRO CRITICO] Node.js nao encontrado! 
    echo O Node.js e o motor do sistema. Instale a versao LTS para continuar.
    echo Baixe em: https://nodejs.org/
    echo.
    pause
    exit /b
) ELSE (
    echo OK - Node.js detectado!
)

echo.
echo [2] Verificando Git...
git --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    color 0E
    echo [AVISO] Git nao encontrado! 
    echo O sistema operara offline perfeitamente, mas voce nao podera 
    echo baixar novas atualizacoes do GitHub sem o Git.
) ELSE (
    echo OK - Git detectado!
)

echo.
echo [3] Verificando arquivo de seguranca (.env)...
IF NOT EXIST ".env" (
    color 0C
    echo [ERRO] Arquivo .env nao encontrado! 
    echo O sistema precisa das variaveis de ambiente e chaves da IA para ligar.
    echo Crie o arquivo .env na mesma pasta deste arquivo antes de prosseguir.
    echo.
    pause
    exit /b
) ELSE (
    echo OK - Arquivo .env detectado!
)

echo.
echo [4] Baixando suprimentos (Instalando node_modules)...
echo Por favor aguarde, este processo baixara as bibliotecas necessarias...
call npm install

echo.
echo [5] Sincronizando o Banco de Dados e Motores...
call npx prisma generate
call npx prisma db push

echo.
echo [6] Compilando e otimizando para Producao (Celeron leve)...
echo Aguarde, gerando a build otimizada. Isso deixara o sistema extremamente rapido e leve.
call npm run build:server
call npm run build

echo.
color 0A
echo ========================================================
echo        INSTALACAO CONCLUIDA COM SUCESSO!
echo ========================================================
echo.
echo O ambiente de producao foi totalmente configurado e otimizado.
echo O notebook do batalhao esta pronto para combate!
echo.
echo Agora voce pode fechar esta janela e dar um duplo clique
echo no arquivo "Iniciar sistema.bat" para ligar os servidores.
echo.
pause
