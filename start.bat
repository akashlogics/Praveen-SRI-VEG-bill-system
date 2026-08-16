@echo off
title காய்கறி பில்லிங் v3 — Thermal Ready
color 0A
echo.
echo  ============================================
echo   காய்கறி பில்லிங் v3 தொடங்குகிறது...
echo   Vegetable Billing v3 is starting...
echo  ============================================
echo.

node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [பிழை] Node.js நிறுவப்படவில்லை!
    echo  https://nodejs.org இல் LTS version பதிவிறக்கி நிறுவவும்.
    echo.
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo  முதல் முறை: packages நிறுவுகிறது...
    npm install
    echo.
)

echo  சர்வர் இயங்குகிறது — browser தானாக திறக்கும்...
echo.
echo  [இந்த சாளரத்தை மூடவேண்டாம் / DO NOT CLOSE THIS WINDOW]
echo.

powershell -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:4500'" >nul 2>&1

node server.js
pause
