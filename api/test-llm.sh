#!/bin/bash

# Test script for LLM API endpoints (chat completions and embeddings)
# Usage: ./test-llm.sh [endpoint] [api_key]
# Set VERBOSE=1 for detailed curl output

set -e

API_URL="${API_URL:-http://127.0.0.1:8080}"
ENDPOINT="${1:-chat}"  # Options: chat, embeddings
API_KEY="${2:-default}"
VERBOSE="${VERBOSE:-0}"

echo "================================================"
echo "Testing LLM API - $ENDPOINT endpoint"
echo "================================================"
echo "API URL: $API_URL"
echo "API Key: ${API_KEY:0:10}..."
echo ""

# Prepare authorization header
if [ "$API_KEY" = "default" ]; then
    echo "Using anonymous/default authentication"
    AUTH_HEADER=""
else
    echo "Using API key authentication"
    AUTH_HEADER="-H \"Authorization: Bearer $API_KEY\""
fi

# DNS and connectivity check
echo ""
echo "================================================"
echo "Connectivity check..."
echo "================================================"
hostname=$(echo "$API_URL" | sed -E 's|https?://([^/]+).*|\1|')
echo "Resolving hostname: $hostname"

if [ "$hostname" != "127.0.0.1" ] && [ "$hostname" != "localhost" ]; then
    if host "$hostname" >/dev/null 2>&1; then
        echo "✓ DNS resolution successful"
        host "$hostname" | head -3
    else
        echo "✗ DNS resolution failed"
    fi
fi

echo ""
echo "Testing connection..."
if curl -s --max-time 5 --head "$API_URL" >/dev/null 2>&1; then
    echo "✓ Can connect to server"
else
    echo "⚠ Connection test failed (might not be critical)"
fi

echo ""
echo "================================================"
echo "Sending $ENDPOINT request..."
echo "================================================"
echo "Started at: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Build curl command
CURL_OPTS="-w \n%{http_code}\n%{time_total} --max-time 120"
if [ "$VERBOSE" = "1" ]; then
    echo "Running in VERBOSE mode..."
    CURL_OPTS="$CURL_OPTS -v -D headers.txt"
else
    CURL_OPTS="$CURL_OPTS -s -D headers.txt"
fi

start_time=$(date +%s)

# Execute request based on endpoint type
case "$ENDPOINT" in
    chat|completions)
        echo "Testing chat completions endpoint..."
        echo ""

        REQUEST_BODY='{
  "model": "gpt-3.5-turbo",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful assistant."
    },
    {
      "role": "user",
      "content": "What is the meaning of life?"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 150
}'

        if [ "$API_KEY" = "default" ]; then
            response=$(curl $CURL_OPTS \
                -X POST "$API_URL/v1/chat/completions" \
                -H "Content-Type: application/json" \
                -d "$REQUEST_BODY" 2>&1 || echo "CURL_ERROR:$?")
        else
            response=$(curl $CURL_OPTS \
                -X POST "$API_URL/v1/chat/completions" \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $API_KEY" \
                -d "$REQUEST_BODY" 2>&1 || echo "CURL_ERROR:$?")
        fi
        ;;

    embeddings|embed)
        echo "Testing embeddings endpoint..."
        echo ""

        REQUEST_BODY='{
  "model": "text-embedding-ada-002",
  "input": "The quick brown fox jumps over the lazy dog"
}'

        if [ "$API_KEY" = "default" ]; then
            response=$(curl $CURL_OPTS \
                -X POST "$API_URL/v1/embeddings" \
                -H "Content-Type: application/json" \
                -d "$REQUEST_BODY" 2>&1 || echo "CURL_ERROR:$?")
        else
            response=$(curl $CURL_OPTS \
                -X POST "$API_URL/v1/embeddings" \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $API_KEY" \
                -d "$REQUEST_BODY" 2>&1 || echo "CURL_ERROR:$?")
        fi
        ;;

    stream)
        echo "Testing streaming chat completions endpoint..."
        echo ""

        REQUEST_BODY='{
  "model": "gpt-3.5-turbo",
  "messages": [
    {
      "role": "user",
      "content": "Count from 1 to 10"
    }
  ],
  "stream": true
}'

        if [ "$API_KEY" = "default" ]; then
            response=$(curl $CURL_OPTS \
                -X POST "$API_URL/v1/chat/completions" \
                -H "Content-Type: application/json" \
                -d "$REQUEST_BODY" 2>&1 || echo "CURL_ERROR:$?")
        else
            response=$(curl $CURL_OPTS \
                -X POST "$API_URL/v1/chat/completions" \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $API_KEY" \
                -d "$REQUEST_BODY" 2>&1 || echo "CURL_ERROR:$?")
        fi
        ;;

    *)
        echo "✗ Unknown endpoint: $ENDPOINT"
        echo "Valid options: chat, embeddings, stream"
        exit 1
        ;;
esac

end_time=$(date +%s)
duration=$((end_time - start_time))

echo "Completed at: $(date '+%Y-%m-%d %H:%M:%S')"
echo "Request duration: ${duration}s"
echo ""

# Check for curl errors
if [[ "$response" == *"CURL_ERROR:"* ]]; then
    error_code=$(echo "$response" | grep -o "CURL_ERROR:[0-9]*" | cut -d: -f2)
    echo "✗ Curl failed with exit code: $error_code"
    case $error_code in
        6) echo "  Could not resolve host" ;;
        7) echo "  Failed to connect to host" ;;
        28) echo "  Operation timeout" ;;
        35) echo "  SSL connect error" ;;
        52) echo "  Empty reply from server" ;;
        56) echo "  Failure in receiving network data" ;;
        *) echo "  See: curl exit code $error_code" ;;
    esac
    exit 1
fi

# Extract HTTP code and time
http_code=$(echo "$response" | tail -n2 | head -n1)
time_total=$(echo "$response" | tail -n1)

echo "HTTP Status Code: $http_code"
echo "Total time: ${time_total}s"
echo ""

# Parse and display response
response_body=$(echo "$response" | head -n -2)

if [ "$http_code" = "200" ]; then
    echo "✓ Success!"
    echo ""
    echo "Response:"
    echo "================================================"

    # Pretty print JSON if jq is available
    if command -v jq &> /dev/null; then
        echo "$response_body" | jq '.'
    else
        echo "$response_body"
    fi

    echo "================================================"
    echo ""

    # Extract specific info based on endpoint
    case "$ENDPOINT" in
        chat|completions|stream)
            if command -v jq &> /dev/null; then
                content=$(echo "$response_body" | jq -r '.choices[0].message.content // .choices[0].delta.content // "N/A"' 2>/dev/null)
                model=$(echo "$response_body" | jq -r '.model // "N/A"' 2>/dev/null)
                usage=$(echo "$response_body" | jq -r '.usage // "N/A"' 2>/dev/null)

                echo "Model: $model"
                echo ""
                echo "Assistant response:"
                echo "$content"
                echo ""
                if [ "$usage" != "N/A" ]; then
                    echo "Token usage:"
                    echo "$usage" | jq '.' 2>/dev/null || echo "$usage"
                fi
            fi
            ;;

        embeddings|embed)
            if command -v jq &> /dev/null; then
                embedding_length=$(echo "$response_body" | jq -r '.data[0].embedding | length' 2>/dev/null)
                model=$(echo "$response_body" | jq -r '.model // "N/A"' 2>/dev/null)
                usage=$(echo "$response_body" | jq -r '.usage // "N/A"' 2>/dev/null)

                echo "Model: $model"
                echo "Embedding dimensions: $embedding_length"
                echo ""
                if [ "$usage" != "N/A" ]; then
                    echo "Token usage:"
                    echo "$usage" | jq '.' 2>/dev/null || echo "$usage"
                fi
            fi
            ;;
    esac

else
    echo "✗ Request failed with status $http_code"
    echo ""
    echo "Response body:"

    if command -v jq &> /dev/null; then
        echo "$response_body" | jq '.' 2>/dev/null || echo "$response_body"
    else
        echo "$response_body"
    fi
    echo ""
fi

echo ""
echo "================================================"
echo "Test completed"
echo "================================================"

if [ "$http_code" != "200" ]; then
    echo ""
    echo "Troubleshooting tips:"
    echo "  • Verify the API server is running"
    echo "  • Check API key is valid (if using authentication)"
    echo "  • Ensure the endpoint is properly configured"
    echo "  • Try with VERBOSE=1 ./test-llm.sh for detailed curl output"
    echo "  • Check server logs for errors"
    echo ""
    echo "Usage examples:"
    echo "  ./test-llm.sh chat              # Test chat completions"
    echo "  ./test-llm.sh embeddings        # Test embeddings"
    echo "  ./test-llm.sh stream            # Test streaming"
    echo "  ./test-llm.sh chat your-api-key # With API key"
fi
