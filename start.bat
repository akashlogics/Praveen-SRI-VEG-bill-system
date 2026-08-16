@echo off
title Veggie Billing v4
color 0A
echo.
echo  ============================================
echo   Veggie Billing v4 - Starting...
echo  ============================================
echo.
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not installed!
    echo Download from: https://nodejs.org (LTS version)
    pause & exit /b 1
)
if not exist "node_modules\" (
    echo Installing packages (first time only)...
    npm install
)
echo Server running! Opening browser...
echo [DO NOT CLOSE THIS WINDOW]
echo.
powershell -Command "Start-Sleep 2; Start-Process 'http://localhost:4500'" >nul 2>&1
node server.js
pause
