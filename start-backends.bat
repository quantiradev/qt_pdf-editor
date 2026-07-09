@echo off
echo ============================================
echo  QT PDF Editor - Start Backend
echo ============================================
echo.

REM Set Python path
set PYTHON=C:\Users\KULASEKHAR\AppData\Local\Programs\Python\Python312\python.exe

REM === Start Unified Python Backend (port 8001) ===
echo Starting unified Python backend on port 8001...
start "Python Backend (port 8001)" cmd /k "cd /d %~dp0backend && %PYTHON% -m uvicorn main:app --port 8001 --reload"

echo.
echo ============================================
echo  Backend is starting!
echo.
echo    Backend API : http://127.0.0.1:8001
echo    Frontend    : http://localhost:3000
echo.
echo  Start frontend separately with:
echo    cd frontend
echo    npm run dev
echo ============================================
echo.
pause
