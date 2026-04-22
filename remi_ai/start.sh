#!/bin/bash

# reminiscence.ai - Start All Services
# This script starts MongoDB, Node.js backend, Python face service, and React frontend

set -e

echo "======================================"
echo "Starting reminiscence.ai"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}✗ Python 3 is not installed${NC}"
    exit 1
fi

# Check Python version
PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
PYTHON_MAJOR=$(python3 -c 'import sys; print(sys.version_info[0])')
PYTHON_MINOR=$(python3 -c 'import sys; print(sys.version_info[1])')

echo -e "${YELLOW}Detected Python ${PYTHON_VERSION}${NC}"

if [ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -ge 12 ]; then
    echo -e "${YELLOW}⚠ Warning: Python 3.12+ detected. Some dependencies may need newer versions.${NC}"
    echo -e "${YELLOW}  If installation fails, consider using Python 3.9-3.11 for best compatibility.${NC}"
elif [ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 8 ]; then
    echo -e "${RED}✗ Python 3.8+ is required (you have ${PYTHON_VERSION})${NC}"
    exit 1
fi
echo ""

# Check if MongoDB is running
echo -e "${YELLOW}Checking MongoDB...${NC}"
if ! pgrep -x "mongod" > /dev/null; then
    echo -e "${RED}✗ MongoDB is not running${NC}"
    echo "  Start MongoDB with: brew services start mongodb-community"
    exit 1
fi
echo -e "${GREEN}✓ MongoDB is running${NC}"
echo ""

# Install Python dependencies if needed
echo -e "${YELLOW}Setting up Python face recognition service...${NC}"
if [ ! -d "server/python_service/venv" ]; then
    echo "Creating Python virtual environment..."
    cd server/python_service
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    echo "Installing Python dependencies (this may take a few minutes)..."
    pip install -r requirements.txt
    cd ../..
    echo -e "${GREEN}✓ Python dependencies installed${NC}"
else
    echo -e "${GREEN}✓ Python environment already set up${NC}"
    echo "  To reinstall dependencies: rm -rf server/python_service/venv && ./start.sh"
fi
echo ""

# Seed demo data
echo -e "${YELLOW}Seeding database with demo data...${NC}"
npm run seed
echo ""

# Start Python service in background
echo -e "${YELLOW}Starting Python face recognition service (port 5002)...${NC}"
cd server/python_service
source venv/bin/activate
PYTHON_SERVICE_PORT=5002 python app.py &
PYTHON_PID=$!
cd ../..
sleep 3
echo -e "${GREEN}✓ Python service started (PID: $PYTHON_PID)${NC}"
echo ""

# Start Node.js backend and React frontend
echo -e "${YELLOW}Starting Node.js backend (port 5001) and React frontend (port 5173)...${NC}"
npm run dev &
NODE_PID=$!
echo -e "${GREEN}✓ Services started (PID: $NODE_PID)${NC}"
echo ""

echo "======================================"
echo -e "${GREEN}✓ All services started successfully!${NC}"
echo "======================================"
echo ""
echo "Services running:"
echo "  📊 MongoDB:        mongodb://127.0.0.1:27017/reminiscence"
echo "  🔧 Backend API:    http://localhost:5001"
echo "  🤖 Python Face:    http://localhost:5002"
echo "  🌐 Frontend:       http://localhost:5173"
echo ""
echo "Demo credentials:"
echo "  Caregiver: caregiver@test.com / password123"
echo "  Patient:   patient@test.com / password123"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Trap SIGINT and clean up
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down services...${NC}"
    kill $PYTHON_PID 2>/dev/null || true
    kill $NODE_PID 2>/dev/null || true
    echo -e "${GREEN}✓ All services stopped${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for user to stop
wait
