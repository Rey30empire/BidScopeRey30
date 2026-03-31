@echo off
setlocal EnableExtensions EnableDelayedExpansion
title BitScopeRey30 Clean Start

set "APP_NAME=BitScopeRey30"
for %%I in ("%~dp0.") do set "ROOT=%%~fI"
set "LOG_DIR=%ROOT%\.zscripts"
set "STARTUP_LOG=%LOG_DIR%\startup.log"
set "MAX_WAIT=60"

cd /d "%ROOT%" || goto :fail

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" >nul 2>&1
if exist "%STARTUP_LOG%" del /f /q "%STARTUP_LOG%" >nul 2>&1

call :log "Workspace: %ROOT%"
call :log "Safe cleanup mode enabled. Preserving db/, upload/, download/, and BitScopeRey30+Datos/."

where bun >nul 2>&1
if errorlevel 1 (
  call :log "ERROR: bun is not installed or is not available in PATH."
  goto :fail
)

where node >nul 2>&1
if errorlevel 1 (
  call :log "ERROR: node is not installed or is not available in PATH."
  goto :fail
)

call :log "Stopping stale local processes..."
call :killPort 3000
call :killPort 3001

call :log "Cleaning transient build residue..."
call :cleanPath ".next"
call :cleanPath ".turbo"
call :cleanFile "dev.log"
call :cleanFile "server.log"
call :cleanFile ".zscripts\dev.out.log"
for %%F in ("%LOG_DIR%\mini-service-*.log") do (
  if exist "%%~fF" del /f /q "%%~fF" >nul 2>&1
)

call :log "Installing dependencies..."
call bun install
if errorlevel 1 goto :fail

call :log "Generating Prisma client..."
call bunx prisma generate
if errorlevel 1 goto :fail

call :log "Applying local Prisma schema..."
call bunx prisma db push
if errorlevel 1 goto :fail

call :log "Building a fresh production bundle..."
call bun run build
if errorlevel 1 goto :fail

call :log "Launching stable app server in a dedicated window..."
start "BitScopeRey30 Server - Do Not Close" /D "%ROOT%" cmd /k "title BitScopeRey30 Server - Do Not Close && set PORT=3000 && node .next\standalone\server.js"
timeout /t 2 /nobreak >nul

call :log "Waiting for http://localhost:3000 to become ready..."
set /a ATTEMPT=0
:wait_loop
set /a ATTEMPT+=1
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing 'http://localhost:3000' -TimeoutSec 2; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 goto :ready

if !ATTEMPT! GEQ %MAX_WAIT% (
  call :log "ERROR: localhost:3000 did not become ready within %MAX_WAIT% seconds."
  echo.
  echo [%APP_NAME%] The server window is open, but the app did not answer in time.
  echo [%APP_NAME%] Check that window for errors, then review:
  echo [%APP_NAME%] %STARTUP_LOG%
  echo.
  goto :fail
)

echo [%APP_NAME%] Waiting for server... !ATTEMPT!/%MAX_WAIT%
timeout /t 1 /nobreak >nul
goto :wait_loop

:ready
call :log "Server is ready. Opening browser..."
start "" http://localhost:3000
echo.
echo [%APP_NAME%] BitScopeRey30 is ready at http://localhost:3000
echo [%APP_NAME%] You can close this bootstrap window. Leave the BitScopeRey30 Server window open while using the app.
echo.
exit /b 0

:killPort
set "TARGET_PORT=%~1"
for /f "tokens=5" %%I in ('netstat -ano ^| findstr /r /c:":%TARGET_PORT% .*LISTENING"') do (
  call :log "Releasing port %TARGET_PORT% from PID %%I"
  taskkill /PID %%I /F >nul 2>&1
)
exit /b 0

:cleanPath
if exist "%~1" (
  call :log "Removing folder %~1"
  rmdir /s /q "%~1" >nul 2>&1
)
exit /b 0

:cleanFile
if exist "%~1" del /f /q "%~1" >nul 2>&1
exit /b 0

:log
echo [%APP_NAME%] %~1
>>"%STARTUP_LOG%" echo [%date% %time%] %~1
exit /b 0

:fail
call :log "Startup failed. Review the output above."
echo.
pause
exit /b 1
