#!/bin/bash

# Test script for Whisper/Speech-to-Text API endpoint
# Usage: ./test-whisper.sh [audio_file] [api_key]

set -e

# API_URL="${API_URL:-https://api-01.heyamica.com}"
API_URL="http://127.0.0.1:8080"
AUDIO_FILE="${1:-}"
API_KEY="${2:-default}"

echo "================================================"
echo "Testing Speech-to-Text API"
echo "================================================"
echo "API URL: $API_URL/v1/audio/transcriptions"
echo "API Key: ${API_KEY:0:10}..."
echo ""

# Check if audio file is provided
if [ -z "$AUDIO_FILE" ]; then
    echo "No audio file provided. Looking for test audio files..."

    # Try to find common audio files in current directory
    if [ -f "test.wav" ]; then
        AUDIO_FILE="test.wav"
    elif [ -f "test.mp3" ]; then
        AUDIO_FILE="test.mp3"
    elif [ -f "test.m4a" ]; then
        AUDIO_FILE="test.m4a"
    elif [ -f "test.webm" ]; then
        AUDIO_FILE="test.webm"
    else
        echo "ERROR: No audio file found!"
        echo ""
        echo "Usage: $0 <audio_file> [api_key]"
        echo ""
        echo "Example:"
        echo "  $0 my_audio.wav"
        echo "  $0 my_audio.mp3 sk-1234567890"
        echo ""
        echo "Supported formats: .wav, .mp3, .m4a, .webm, .ogg, .flac"
        exit 1
    fi
fi

# Check if file exists
if [ ! -f "$AUDIO_FILE" ]; then
    echo "ERROR: Audio file '$AUDIO_FILE' not found!"
    exit 1
fi

echo "Audio file: $AUDIO_FILE"
echo "File size: $(du -h "$AUDIO_FILE" | cut -f1)"
echo ""

# Prepare authorization header
if [ "$API_KEY" = "default" ]; then
    AUTH_HEADER=""
    echo "Using anonymous/default authentication"
else
    AUTH_HEADER="-H \"Authorization: Bearer $API_KEY\""
    echo "Using API key authentication"
fi

echo ""
echo "================================================"
echo "Sending request..."
echo "================================================"
echo ""

# Make the request with verbose output
if [ "$API_KEY" = "default" ]; then
    curl -v -X POST "$API_URL/v1/audio/transcriptions" \
        -F "file=@$AUDIO_FILE" \
        -F "model=whisper-1" \
        -F "response_format=json" \
        -F "language=en" \
        -F "temperature=0"
else
    curl -v -X POST "$API_URL/v1/audio/transcriptions" \
        -H "Authorization: Bearer $API_KEY" \
        -F "file=@$AUDIO_FILE" \
        -F "model=whisper-1" \
        -F "response_format=json" \
        -F "language=en" \
        -F "temperature=0"
fi

echo ""
echo ""
echo "================================================"
echo "Test completed"
echo "================================================"
