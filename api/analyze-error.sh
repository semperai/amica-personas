#!/bin/bash

# Detailed error analysis script for API endpoints
# Shows all headers, status codes, and response bodies

API_URL="${1:-https://api-01.heyamica.com}"
AUDIO_FILE="${2:-test_quick.mp3}"

echo "================================================"
echo "API Error Analysis"
echo "================================================"
echo "Server: $API_URL"
echo "Time: $(date)"
echo ""

# Test Whisper with detailed output
echo "================================================"
echo "1. Testing Whisper/STT Endpoint"
echo "================================================"
echo "Request: POST /v1/audio/transcriptions"
echo "File: $AUDIO_FILE"
echo ""
echo "--- Full Response Headers ---"
echo ""

if [ -f "$AUDIO_FILE" ]; then
    # Get full response with headers
    curl -i -X POST "$API_URL/v1/audio/transcriptions" \
        -F "file=@$AUDIO_FILE" \
        -F "model=whisper-1" \
        -F "response_format=json" \
        --max-time 30 \
        2>&1
else
    echo "Audio file not found: $AUDIO_FILE"
fi

echo ""
echo ""
echo "================================================"
echo "2. Testing TTS Endpoint"
echo "================================================"
echo "Request: POST /v1/audio/speech"
echo ""
echo "--- Response Headers ---"
echo ""

curl -i -X POST "$API_URL/v1/audio/speech" \
    -H "Content-Type: application/json" \
    -d '{"input":"test"}' \
    --max-time 30 \
    2>&1 | head -30

echo ""
echo ""
echo "================================================"
echo "3. Health Check Endpoint"
echo "================================================"
echo ""

curl -i "$API_URL/health-check" 2>&1

echo ""
echo ""
echo "================================================"
echo "4. Testing Chat Endpoint"
echo "================================================"
echo "Request: POST /v1/chat/completions"
echo ""

curl -i -X POST "$API_URL/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -d '{"messages":[{"role":"user","content":"test"}]}' \
    --max-time 10 \
    2>&1 | head -50

echo ""
echo ""
echo "================================================"
echo "Summary"
echo "================================================"
echo ""
echo "Status codes observed:"
echo "  200 = OK"
echo "  400 = Bad Request (missing parameters)"
echo "  401 = Unauthorized (invalid API key)"
echo "  403 = Forbidden"
echo "  500 = Internal Server Error (backend issue)"
echo "  502 = Bad Gateway (backend down)"
echo "  503 = Service Unavailable"
echo "  504 = Gateway Timeout (backend slow/stuck)"
echo ""
