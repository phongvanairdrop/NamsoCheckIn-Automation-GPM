@echo off
chcp 65001 >nul
cls
echo ================================================
echo    NAMSO CHECK-IN AUTOMATION - SETUP
echo ================================================
echo.

REM Kiem tra Node.js
echo [1/5] Kiem tra Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo    [!] LOI: Node.js chua duoc cai dat!
    echo.
    echo    Vui long cai dat Node.js 18+ tu:
    echo    https://nodejs.org/
    echo.
    pause
    exit /b 1
)
echo    [*] Node.js da duoc cai dat:
node --version
echo.

REM Cai dat dependencies
echo [2/5] Dang cai cac thu vien npm...
echo    (Vui long doi, qua trinh nay co the mat vai phut...)
echo.
call npm install
if errorlevel 1 (
    echo.
    echo    [!] LOI: npm install that bai!
    pause
    exit /b 1
)
echo    [*] Cai dat thanh cong!
echo.

REM Tao thu muc
echo [3/5] Dang tao cau truc thu muc...
if not exist "config" mkdir config
if not exist "logs" mkdir logs
echo    [*] Da tao: config/
echo    [*] Da tao: logs/

REM Copy .env.example sang .env
echo.
echo [4/5] Dang tao file cau hinh .env...
if not exist ".env" (
    copy .env.example .env >nul
    echo    [*] Da tao .env tu .env.example
) else (
    echo    [!] File .env da ton tai - giu nguyen
)

REM Tao template credentials.xlsx
echo.
echo [5/5] Kiem tra file credentials...
if not exist "config\credentials.xlsx" (
    echo    [!] Can tao file config\credentials.xlsx
    echo.
    echo    FORMAT FILE CREDENTIALS.XLSX:
    echo.
    echo    +--------------+--------------+--------------+--------------+
    echo    ^| ProfileName  ^| ProfileID    ^| Namso        ^| Password     ^|
    echo    +--------------+--------------+--------------+--------------+
    echo    ^| Profile001   ^| xxx-xxx-xxx  ^| email@gmail  ^| pass123      ^|
    echo    +--------------+--------------+--------------+--------------+
    echo.
    echo    - ProfileName: Ten profile (phai khop voi GPM)
    echo    - ProfileID: ID cua profile trong GPM
    echo    - Namso: Email dang nhap (hoac "No" de bo qua)
    echo    - Password: Mat khau tai khoan
    echo.
) else (
    echo    [*] File credentials.xlsx da co
)

echo.
echo ================================================
echo    SETUP HOAN TAT!
echo ================================================
echo.
echo    BUOC TIEP THEO:
echo.
echo    1. Cai GPM-Login (https://github.com/GPM-Login)
echo       - Khoi dong GPM application
echo.
echo    2. Tao file config\credentials.xlsx
echo       - Copy dinh dang o tren
echo       - Dien thong tin profiles cua ban
echo.
echo    3. Chinh sua .env (neu can)
echo       - Doi SCREEN_WIDTH, SCREEN_HEIGHT theo man hinh
echo       - Doi CONCURRENCY neu muon chay nhieu luong hon
echo.
echo    4. CHAY TOOL:
echo       npm test
echo.
echo ================================================
pause
