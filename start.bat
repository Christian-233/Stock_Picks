@echo off
REM AI Stock Predictor - Setup & Start (Windows)

echo.
echo ========================================
echo   AI Stock Predictor - Setup ^& Start
echo ========================================
echo.

REM Check if backend dependencies are installed
if not exist "backend\node_modules" (
    echo Installing backend dependencies...
    cd backend
    call npm install
    cd ..
)

REM Check if frontend dependencies are installed
if not exist "frontend\node_modules" (
    echo Installing frontend dependencies...
    cd frontend
    call npm install
    cd ..
)

REM Check if backend .env exists
if not exist "backend\.env" (
    echo Creating backend .env file...
    copy backend\.env.example backend\.env
    echo.
    echo WARNING: Please edit backend\.env with your API keys!
    echo   - NEWS_API_KEY from https://newsapi.org
    echo.
)

REM Check if frontend .env exists
if not exist "frontend\.env" (
    echo Creating frontend .env file...
    copy frontend\.env.example frontend\.env
)

echo.
echo Setup complete!
echo.
echo Starting services...
echo.
echo Backend:  http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo Press Ctrl+C to stop
echo.

REM Start backend in new window
start cmd /k "cd backend && npm run dev"

REM Start frontend in new window
start cmd /k "cd frontend && npm start"

echo Services are starting in new windows...
