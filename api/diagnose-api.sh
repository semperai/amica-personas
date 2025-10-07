#!/bin/bash

# Diagnostic script for Amica API
# Tests all endpoints and shows network connectivity status

API_URL="${1:-https://api-01.heyamica.com}"
API_KEY="${2:-default}"

echo "================================================"
echo "Amica API Diagnostic Tool"
echo "================================================"
echo "API URL: $API_URL"
echo "Time: $(date)"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test endpoint
test_endpoint() {
    local name=$1
    local url=$2
    local method=${3:-GET}

    echo -n "Testing $name... "

    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -m 5 "$url" 2>&1)
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" -m 5 "$url" 2>&1)
    fi

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [ "$http_code" = "200" ] || [ "$http_code" = "400" ]; then
        echo -e "${GREEN}✓ OK${NC} (HTTP $http_code)"
        return 0
    elif [ -z "$http_code" ]; then
        echo -e "${RED}✗ FAILED${NC} (No response - network issue?)"
        return 1
    else
        echo -e "${YELLOW}⚠ RESPONDED${NC} (HTTP $http_code)"
        return 0
    fi
}

echo "================================================"
echo "1. Basic Connectivity Tests"
echo "================================================"
echo ""

# Test DNS resolution
echo -n "DNS resolution for api-01.heyamica.com... "
if host api-01.heyamica.com > /dev/null 2>&1; then
    echo -e "${GREEN}✓ OK${NC}"
    host api-01.heyamica.com | head -n1
else
    echo -e "${RED}✗ FAILED${NC}"
fi
echo ""

# Test basic connectivity
echo -n "TCP connectivity to $API_URL... "
if curl -s -m 5 --head "$API_URL" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${RED}✗ FAILED${NC} (Cannot connect)"
fi
echo ""

echo "================================================"
echo "2. API Endpoint Tests"
echo "================================================"
echo ""

test_endpoint "Root endpoint" "$API_URL/"
test_endpoint "Health check" "$API_URL/health-check"
test_endpoint "Liveness probe" "$API_URL/livez"
test_endpoint "Readiness probe" "$API_URL/readyz"
test_endpoint "Monitoring" "$API_URL/monitoring"

echo ""
echo "================================================"
echo "3. Detailed Health Check"
echo "================================================"
echo ""

health_response=$(curl -s "$API_URL/health-check" 2>&1)
if [ $? -eq 0 ]; then
    echo "$health_response" | jq '.' 2>/dev/null || echo "$health_response"
else
    echo -e "${RED}Failed to get health check${NC}"
fi

echo ""
echo "================================================"
echo "4. Testing Whisper/STT Endpoint (without audio)"
echo "================================================"
echo ""

echo "Sending POST to /v1/audio/transcriptions (should return 400 - no file)..."
echo ""

if [ "$API_KEY" = "default" ]; then
    curl -v "$API_URL/v1/audio/transcriptions" \
        -X POST \
        -F "model=whisper-1" \
        2>&1 | grep -E "(HTTP|< |error|text)"
else
    curl -v "$API_URL/v1/audio/transcriptions" \
        -X POST \
        -H "Authorization: Bearer $API_KEY" \
        -F "model=whisper-1" \
        2>&1 | grep -E "(HTTP|< |error|text)"
fi

echo ""
echo ""
echo "================================================"
echo "5. Testing TTS Endpoint (without input)"
echo "================================================"
echo ""

echo "Sending POST to /v1/audio/speech (should return 400 - no input)..."
echo ""

if [ "$API_KEY" = "default" ]; then
    curl -v "$API_URL/v1/audio/speech" \
        -X POST \
        -H "Content-Type: application/json" \
        2>&1 | grep -E "(HTTP|< |error|Content-Type)" | head -20
else
    curl -v "$API_URL/v1/audio/speech" \
        -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $API_KEY" \
        2>&1 | grep -E "(HTTP|< |error|Content-Type)" | head -20
fi

echo ""
echo ""
echo "================================================"
echo "Diagnostic Summary"
echo "================================================"
echo ""
echo "If Whisper/STT shows HTTP errors:"
echo "  - 400 = Good (endpoint is responding, just needs valid audio file)"
echo "  - 401/403 = Authorization issue"
echo "  - 500 = Server error (check logs)"
echo "  - 502/503/504 = Backend service down"
echo "  - Connection timeout = Network/firewall issue"
echo ""
echo "To test with actual audio file, use:"
echo "  ./test-whisper.sh <audio_file> [api_key]"
echo ""
