@echo off
echo ============================================
echo  QT PDF Editor - Start All Backends
echo ============================================
echo.

REM Set Python path
set PYTHON=C:\Users\KULASEKHAR\AppData\Local\Programs\Python\Python312\python.exe

REM === Start Python PDF Backend (port 8001) ===
echo [1/2] Starting Python PDF backend on port 8001...
start "PDF Backend (port 8001)" cmd /k "cd /d %~dp0backend_pdf && %PYTHON% -m uvicorn main:app --port 8001 --reload"

timeout /t 2 >nul

REM === Start Node.js Auth Backend (port 5001) ===
echo [2/2] Starting Node.js auth backend on port 5001...
start "Auth Backend (port 5001)" cmd /k "cd /d %~dp0backend && npm run dev"

echo.
echo ============================================
echo  Both backends are starting!
echo.
echo    PDF API  : http://127.0.0.1:8001
echo    Auth API : http://localhost:5001
echo    Frontend : http://localhost:3000
echo.
echo  Start frontend separately with:
echo    cd frontend
echo    npm run dev
echo ============================================
echo.
pause
