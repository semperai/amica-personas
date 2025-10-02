# Whisper.cpp Container

OpenAI Whisper speech-to-text with OpenAI-compatible API endpoint.

## Quick Start

```bash
# Copy and customize environment file
cp .env.example .env

# Start the service
docker-compose up -d
```

## Configuration

Edit `.env` file to customize:

```bash
# Model size (tiny, base, small, medium, large)
WHISPER_MODEL=base

# Language (en, es, fr, de, ja, zh, auto)
WHISPER_LANGUAGE=auto

# CPU threads
WHISPER_THREADS=4

# Port
WHISPER_PORT=9000
```

Or set environment variables:
```bash
WHISPER_MODEL=small docker-compose up -d
```

## Configure Amica

1. Open Amica settings
2. Navigate to "Speech-to-Text Backend"
3. Select "Whisper.cpp" or "Whisper (OpenAI)"
4. Set URL: `http://localhost:9000`

## Model Sizes

| Model | RAM | Accuracy | Speed | Use Case |
|-------|-----|----------|-------|----------|
| **tiny** | ~1GB | Low | Fastest | Quick testing |
| **tiny.en** | ~1GB | Low | Fastest | English only, testing |
| **base** | ~1GB | Good | Fast | Default, balanced |
| **base.en** | ~1GB | Good | Fast | English only |
| **small** | ~2GB | Better | Medium | Higher quality |
| **small.en** | ~2GB | Better | Medium | English only |
| **medium** | ~5GB | High | Slower | Production |
| **medium.en** | ~5GB | High | Slower | English production |
| **large** | ~10GB | Best | Slowest | Maximum accuracy |

## Supported Languages

Set `ASR_LANGUAGE` for better accuracy:
- `en` - English
- `es` - Spanish
- `fr` - French
- `de` - German
- `auto` - Auto-detect (default)

## API Endpoints

This service provides OpenAI-compatible endpoints:

### Transcription (OpenAI-compatible)
```bash
curl http://localhost:9000/v1/audio/transcriptions \
  -H "Authorization: Bearer dummy-key" \
  -F "file=@audio.wav" \
  -F "model=whisper-1"
```

### ASR Endpoint (Direct)
```bash
curl -F "audio_file=@audio.wav" http://localhost:9000/asr
```

Both endpoints work with Amica!

## Performance

- CPU mode: Works but slower
- GPU mode: Much faster (requires nvidia-docker)

For GPU support, add to service:
```yaml
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: 1
          capabilities: [gpu]
```

## Resources

- RAM: 1-10GB depending on model
- First run downloads model (~200MB - 3GB)
