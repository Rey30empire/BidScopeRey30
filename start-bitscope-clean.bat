@echo off
setlocal

set "ROOT=%~dp0"
cd /d "%ROOT%"

echo [BitScopeRey30] Closing stale dev servers on ports 3000 and 3001...
for %%P in (3000 3001) do (
  for /f "tokens=5" %%I in ('netstat -ano ^| findstr /r /c:":%%P .*LISTENING"') do (
    taskkill /PID %%I /F >nul 2>&1
  )
)

echo [BitScopeRey30] Cleaning build residue...
if exist ".next" rmdir /s /q ".next"
if exist ".turbo" rmdir /s /q ".turbo"
if exist "dev.log" del /f /q "dev.log"
if exist "server.log" del /f /q "server.log"

echo [BitScopeRey30] Installing dependencies...
call bun install
if errorlevel 1 goto :fail

echo [BitScopeRey30] Generating Prisma client...
call bunx prisma generate
if errorlevel 1 goto :fail

echo [BitScopeRey30] Starting a fresh dev server...
start "BitScopeRey30 Dev" cmd /k "cd /d %ROOT% && bun run dev"
exit /b 0

:fail
echo [BitScopeRey30] Startup failed. Review the command output above.
exit /b 1
