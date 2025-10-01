#!/bin/bash

# Local testing script for Amica Subsquid Indexer
# This script sets up and tests the indexer locally

set -e

echo "==================================="
echo "Amica Subsquid Local Test Setup"
echo "==================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}No .env file found. Creating from .env.test${NC}"
    cp .env.test .env
fi

# Function to wait for database
wait_for_db() {
    echo -e "${YELLOW}Waiting for database to be ready...${NC}"
    timeout 30 bash -c 'until docker compose exec db pg_isready -U postgres; do sleep 1; done' || {
        echo -e "${RED}Database failed to start${NC}"
        exit 1
    }
    echo -e "${GREEN}Database is ready${NC}"
}

# Function to check if processor is running
check_processor() {
    if [ -f "lib/main.js" ]; then
        echo -e "${GREEN}Processor is built${NC}"
        return 0
    else
        echo -e "${RED}Processor is not built. Run 'npm run build' first${NC}"
        return 1
    fi
}

# Parse command line arguments
case "${1:-}" in
    start)
        echo -e "${YELLOW}Starting database...${NC}"
        docker compose up -d db
        wait_for_db

        echo -e "${YELLOW}Running migrations...${NC}"
        npm run db:migrate

        echo -e "${GREEN}Database is ready. You can now:${NC}"
        echo "  - Run processor: npm run processor:start"
        echo "  - Start GraphQL server: npm run serve"
        echo "  - Or run both with: docker compose --profile full up"
        ;;

    stop)
        echo -e "${YELLOW}Stopping all services...${NC}"
        docker compose --profile full down
        echo -e "${GREEN}Services stopped${NC}"
        ;;

    reset)
        echo -e "${YELLOW}Resetting database...${NC}"
        npm run db:reset
        echo -e "${GREEN}Database reset complete${NC}"
        ;;

    test)
        echo -e "${YELLOW}Running full stack test...${NC}"

        # Start database
        docker compose up -d db
        wait_for_db

        # Run migrations
        echo -e "${YELLOW}Running migrations...${NC}"
        npm run db:migrate

        # Build if needed
        if ! check_processor; then
            echo -e "${YELLOW}Building processor...${NC}"
            npm run build
        fi

        # Start processor in background
        echo -e "${YELLOW}Starting processor...${NC}"
        npm run processor:start &
        PROCESSOR_PID=$!

        # Wait a bit for processor to start
        sleep 5

        # Check if processor is still running
        if kill -0 $PROCESSOR_PID 2>/dev/null; then
            echo -e "${GREEN}Processor started successfully (PID: $PROCESSOR_PID)${NC}"
            echo -e "${YELLOW}Processor is indexing blocks. Press Ctrl+C to stop.${NC}"
            wait $PROCESSOR_PID
        else
            echo -e "${RED}Processor failed to start${NC}"
            exit 1
        fi
        ;;

    full)
        echo -e "${YELLOW}Starting full stack with docker compose...${NC}"
        npm run build
        docker compose --profile full up --build
        ;;

    logs)
        docker compose --profile full logs -f
        ;;

    query)
        echo -e "${YELLOW}Testing GraphQL queries...${NC}"

        # Check if GraphQL server is running
        if ! curl -s http://localhost:4000/graphql > /dev/null; then
            echo -e "${RED}GraphQL server is not running on port 4000${NC}"
            echo "Start it with: npm run serve"
            exit 1
        fi

        # Test query: Get total personas
        echo -e "\n${YELLOW}Querying total personas...${NC}"
        curl -X POST http://localhost:4000/graphql \
            -H "Content-Type: application/json" \
            -d '{"query":"{ globalStats { totalPersonas totalTrades totalVolume } }"}' \
            | jq '.'

        # Test query: Get recent personas
        echo -e "\n${YELLOW}Querying recent personas...${NC}"
        curl -X POST http://localhost:4000/graphql \
            -H "Content-Type: application/json" \
            -d '{"query":"{ personas(limit: 5, orderBy: createdAt_DESC) { id tokenId name symbol creator owner pairCreated } }"}' \
            | jq '.'
        ;;

    *)
        echo "Usage: $0 {start|stop|reset|test|full|logs|query}"
        echo ""
        echo "Commands:"
        echo "  start  - Start database and prepare for indexing"
        echo "  stop   - Stop all services"
        echo "  reset  - Reset database (WARNING: deletes all data)"
        echo "  test   - Run processor in test mode"
        echo "  full   - Start full stack (db + processor + graphql) with docker"
        echo "  logs   - Show logs from all services"
        echo "  query  - Test GraphQL queries"
        echo ""
        echo "Example workflow:"
        echo "  1. ./test-local.sh start    # Start database"
        echo "  2. npm run processor:start  # Start processor (in another terminal)"
        echo "  3. npm run serve            # Start GraphQL server (in another terminal)"
        echo "  4. ./test-local.sh query    # Test queries"
        exit 1
        ;;
esac
