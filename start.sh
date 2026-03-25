#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 AI Stock Predictor - Setup & Start${NC}"
echo ""

# Check if backend dependencies are installed
if [ ! -d "backend/node_modules" ]; then
    echo -e "${YELLOW}Installing backend dependencies...${NC}"
    cd backend
    npm install
    cd ..
fi

# Check if frontend dependencies are installed
if [ ! -d "frontend/node_modules" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    cd frontend
    npm install
    cd ..
fi

# Check if backend .env exists
if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}Creating backend .env file...${NC}"
    cp backend/.env.example backend/.env
    echo -e "${RED}⚠️  Please edit backend/.env with your API keys before continuing${NC}"
    echo "   - NEWS_API_KEY from https://newsapi.org"
fi

# Check if frontend .env exists
if [ ! -f "frontend/.env" ]; then
    echo -e "${YELLOW}Creating frontend .env file...${NC}"
    cp frontend/.env.example frontend/.env
fi

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "Starting services..."
echo ""
echo -e "${YELLOW}Backend:  http://localhost:5000${NC}"
echo -e "${YELLOW}Frontend: http://localhost:3000${NC}"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Start both services
cd backend
npm run dev &
BACKEND_PID=$!

cd ../frontend
npm start &
FRONTEND_PID=$!

# Handle cleanup
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT

wait
