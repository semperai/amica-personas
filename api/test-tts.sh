#!/bin/bash

# Test script for Text-to-Speech API endpoint
# Usage: ./test-tts.sh [text] [api_key] [output_file]
# Set VERBOSE=1 for detailed curl output

set -e

# API_URL="${API_URL:-https://api-01.heyamica.com}"
API_URL="http://127.0.0.1:8080"
TEXT="${1:-What do you think you want to think about? Are you thinking about eating pancakes and strawberries? Where are you?}"
API_KEY="${2:-default}"
OUTPUT_FILE="${3:-output_tts.mp3}"
VERBOSE="${VERBOSE:-0}"

echo "================================================"
echo "Testing Text-to-Speech API"
echo "================================================"
echo "API URL: $API_URL/v1/audio/speech"
echo "API Key: ${API_KEY:0:10}..."
echo "Text: $TEXT"
echo "Output: $OUTPUT_FILE"
echo ""

# Prepare authorization header
if [ "$API_KEY" = "default" ]; then
    echo "Using anonymous/default authentication"
else
    echo "Using API key authentication"
fi

# DNS and connectivity check
echo ""
echo "================================================"
echo "Connectivity check..."
echo "================================================"
hostname=$(echo "$API_URL" | sed -E 's|https?://([^/]+).*|\1|')
echo "Resolving hostname: $hostname"
if host "$hostname" >/dev/null 2>&1; then
    echo "✓ DNS resolution successful"
    host "$hostname" | head -3
else
    echo "✗ DNS resolution failed"
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
echo "Sending TTS request..."
echo "================================================"
echo "Started at: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Build curl command
CURL_OPTS="-w \n%{http_code}\n%{size_download}\n%{size_header} --max-time 30"
if [ "$VERBOSE" = "1" ]; then
    echo "Running in VERBOSE mode..."
    CURL_OPTS="$CURL_OPTS -v -D headers.txt"
else
    CURL_OPTS="$CURL_OPTS -s -D headers.txt"
fi

# Make the request
echo "Executing curl command..."
if [ "$VERBOSE" = "1" ]; then
    echo "curl $CURL_OPTS -X POST \"$API_URL/v1/audio/speech\" -H \"Content-Type: application/json\" -d '{\"input\":\"...\",\"voice\":\"alloy\",\"model\":\"tts-1\"}' --output \"$OUTPUT_FILE\""
fi

start_time=$(date +%s)

if [ "$API_KEY" = "default" ]; then
    response=$(curl $CURL_OPTS \
        -X POST "$API_URL/v1/audio/speech" \
        -H "Content-Type: application/json" \
        -d "{\"input\":\"$TEXT\",\"voice\":\"alloy\",\"model\":\"tts-1\"}" \
        --output "$OUTPUT_FILE" 2>&1 || echo "CURL_ERROR:$?")
else
    response=$(curl $CURL_OPTS \
        -X POST "$API_URL/v1/audio/speech" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $API_KEY" \
        -d "{\"input\":\"$TEXT\",\"voice\":\"alloy\",\"model\":\"tts-1\"}" \
        --output "$OUTPUT_FILE" 2>&1 || echo "CURL_ERROR:$?")
fi

end_time=$(date +%s)
duration=$((end_time - start_time))

echo "Completed at: $(date '+%Y-%m-%d %H:%M:%S')"
echo "Request duration: ${duration}s"
echo ""

# Extract download stats
size_download=$(echo "$response" | tail -n2 | head -n1)
size_header=$(echo "$response" | tail -n1)

# Check headers
if [ -f "headers.txt" ]; then
    content_length=$(grep -i "^Content-Length:" headers.txt | awk '{print $2}' | tr -d '\r')
    transfer_encoding=$(grep -i "^Transfer-Encoding:" headers.txt | awk '{print $2}' | tr -d '\r')

    if [ -n "$content_length" ]; then
        echo "Content-Length header: $content_length bytes"
        echo "Actually downloaded: $size_download bytes"
        if [ "$content_length" != "$size_download" ]; then
            missing=$((content_length - size_download))
            echo "⚠ Missing: $missing bytes ($(awk "BEGIN {printf \"%.1f\", ($missing/$content_length)*100}")% incomplete)"
        fi
    fi

    if [ -n "$transfer_encoding" ]; then
        echo "Transfer-Encoding: $transfer_encoding"
    fi
    echo ""
fi

# Check for curl errors
if [[ "$response" == *"CURL_ERROR:"* ]]; then
    error_code=$(echo "$response" | grep -o "CURL_ERROR:[0-9]*" | cut -d: -f2)
    echo "✗ Curl failed with exit code: $error_code"
    case $error_code in
        6) echo "  Could not resolve host" ;;
        7) echo "  Failed to connect to host" ;;
        18) echo "  Partial file - Server sent incomplete response" ;;
        28) echo "  Operation timeout" ;;
        35) echo "  SSL connect error" ;;
        52) echo "  Empty reply from server" ;;
        56) echo "  Failure in receiving network data" ;;
        *) echo "  See: curl exit code $error_code" ;;
    esac

    # Show what was received for error 18 (partial file)
    if [ "$error_code" = "18" ] && [ -f "$OUTPUT_FILE" ]; then
        echo ""
        echo "Partial response received:"
        file_size=$(stat -f%z "$OUTPUT_FILE" 2>/dev/null || stat -c%s "$OUTPUT_FILE" 2>/dev/null)
        echo "File size: $file_size bytes"
        echo ""
        echo "Content preview:"
        if [ "$file_size" -gt 0 ]; then
            head -c 1000 "$OUTPUT_FILE"
            echo ""
            echo ""
            echo "Raw hex (first 100 bytes):"
            hexdump -C "$OUTPUT_FILE" | head -10
        else
            echo "(empty file)"
        fi
    fi

    exit 1
fi

http_code=$(echo "$response" | tail -n3 | head -n1)

echo "HTTP Status Code: $http_code"
echo ""

# Check for Cloudflare-specific issues
if [ -f "$OUTPUT_FILE" ]; then
    file_content=$(head -c 500 "$OUTPUT_FILE" 2>/dev/null || echo "")
    if [[ "$file_content" == *"cloudflare"* ]] || [[ "$file_content" == *"Cloudflare"* ]]; then
        echo "⚠ Warning: Response contains Cloudflare content - might be blocked/challenged"
    fi
fi

if [ "$http_code" = "200" ]; then
    echo "✓ Success! Audio saved to: $OUTPUT_FILE"

    # Check if file exists and has content
    if [ -f "$OUTPUT_FILE" ]; then
        file_size=$(stat -f%z "$OUTPUT_FILE" 2>/dev/null || stat -c%s "$OUTPUT_FILE" 2>/dev/null)
        echo "File size: $file_size bytes"

        if [ "$file_size" -gt 0 ]; then
            # Try to get file type
            file_type=$(file -b "$OUTPUT_FILE" 2>/dev/null || echo "Unknown")
            echo "File type: $file_type"

            # Check if it's actually audio
            if [[ "$file_type" == *"Audio"* ]] || [[ "$file_type" == *"MPEG"* ]] || [[ "$file_type" == *"MP3"* ]] || [[ "$file_type" == *"WAVE"* ]] || [[ "$file_type" == *"WAV"* ]]; then
                echo ""
                echo "✓ Valid audio file created!"
                echo ""
                echo "You can play it with:"
                echo "  afplay $OUTPUT_FILE    (macOS)"
                echo "  mpg123 $OUTPUT_FILE    (Linux)"
                echo "  vlc $OUTPUT_FILE       (any platform)"
            else
                echo ""
                echo "⚠ Warning: File doesn't appear to be audio. Content:"
                head -c 200 "$OUTPUT_FILE"
                echo ""
            fi
        else
            echo "⚠ Warning: File is empty"
        fi
    else
        echo "✗ Error: Output file not created"
    fi
else
    echo "✗ Request failed with status $http_code"

    if [ -f "$OUTPUT_FILE" ]; then
        echo ""
        echo "Response body:"
        cat "$OUTPUT_FILE"
        echo ""
    fi
fi

echo ""
echo "================================================"
echo "Test completed"
echo "================================================"

# Cloudflare troubleshooting tips
if [ "$http_code" != "200" ] || [ ! -f "$OUTPUT_FILE" ] || [ ! -s "$OUTPUT_FILE" ]; then
    echo ""
    echo "Troubleshooting tips for Cloudflare-hosted APIs:"
    echo "  • Check if your IP is rate-limited or blocked"
    echo "  • Verify API endpoint is correctly configured in Cloudflare"
    echo "  • Check Cloudflare firewall rules and security settings"
    echo "  • Try with VERBOSE=1 ./test-tts.sh for detailed curl output"
    echo "  • Check Cloudflare Workers logs for errors"
    echo "  • Ensure CORS and API routes are properly configured"
    echo ""
    echo "For partial response (error 18) issues:"
    echo "  • Cloudflare Workers have CPU time limits (30s max, 10s on free tier)"
    echo "  • Check if streaming response is properly implemented"
    echo "  • Verify upstream API connection doesn't timeout mid-stream"
    echo "  • Consider using Response.body ReadableStream for large responses"
    echo "  • Check Worker memory limits (128MB)"
    echo "  • Review Worker logs in Cloudflare dashboard for exceptions"
fi
