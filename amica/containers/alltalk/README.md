# AllTalk TTS (LocalXTTS) Container

Local XTTS server for high-quality text-to-speech with voice cloning capabilities.

## Features

- XTTS v2 model support
- Voice cloning from audio samples
- Multi-language support
- Low VRAM mode for systems with limited GPU

## Quick Start

```bash
# Copy and customize environment file
cp .env.example .env

# Build and start
docker-compose build
docker-compose up -d
```

⚠️ **Note**: First startup may take 5-10 minutes to download models (~2GB)

## Configuration

Edit `.env` file to customize:

```bash
# Port
ALLTALK_PORT=7851

# Model
ALLTALK_MODEL=xtts_v2

# Language
ALLTALK_LANGUAGE=en

# Low VRAM mode
ALLTALK_LOW_VRAM=false
```

## Configure Amica

1. Open Amica settings
2. Navigate to "TTS Backend"
3. Select "AllTalk TTS" or "LocalXTTS"
4. Set URL: `http://localhost:7851`

## Supported Languages

- English (en)
- Spanish (es)
- French (fr)
- German (de)
- Italian (it)
- Portuguese (pt)
- Polish (pl)
- Turkish (tr)
- Russian (ru)
- Dutch (nl)
- Czech (cs)
- Arabic (ar)
- Chinese (zh-cn)
- Japanese (ja)
- Korean (ko)
- Hungarian (hu)
- Hindi (hi)

## Voice Cloning

Place reference audio files in `./voices/` directory:

```bash
mkdir -p voices
# Add your voice samples (WAV format, 6-10 seconds recommended)
```

## API Endpoints

### Generate Speech
```bash
curl -X POST http://localhost:7851/api/tts \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello, this is a test",
    "language": "en"
  }' \
  --output speech.wav
```

### Generate with Voice Cloning
```bash
curl -X POST http://localhost:7851/api/tts \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello, this is a cloned voice",
    "language": "en",
    "speaker_wav": "/app/voices/reference.wav"
  }' \
  --output speech.wav
```

## Resources

- RAM: 4-8GB
- Storage: ~2-4GB for models
- GPU: Highly recommended for real-time performance
- CPU mode: Works but slower (5-10x)

## GPU Support

For NVIDIA GPU acceleration, add to `docker-compose.yml`:

```yaml
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: 1
          capabilities: [gpu]
```

## Low VRAM Mode

If you have limited GPU memory (< 6GB), enable low VRAM mode:

```bash
ALLTALK_LOW_VRAM=true
```

This will:
- Use model offloading
- Process in smaller batches
- Trade speed for lower memory usage

## Advantages

- High-quality output
- Voice cloning without training
- Multi-language support
- Fast inference with GPU
- No API costs

## Troubleshooting

### Models not downloading
- Check internet connection
- Ensure sufficient disk space (~4GB free)
- Check logs: `docker-compose logs alltalk`

### Out of memory errors
- Enable low VRAM mode
- Reduce batch size
- Use CPU mode instead

### Slow generation
- Enable GPU support
- Check GPU is being used: `docker stats`
- Ensure CUDA drivers are installed

## Comparison with Other TTS

| Feature | AllTalk/XTTS | Piper | Coqui |
|---------|--------------|-------|-------|
| Quality | High | Medium | High |
| Speed (GPU) | Fast | Very Fast | Medium |
| Voice Cloning | Yes | No | Yes |
| GPU Required | Recommended | No | Recommended |
| Languages | 16+ | Many | Many |
| Model Size | ~2GB | ~50MB | ~500MB-2GB |

## Resources

- [AllTalk TTS GitHub](https://github.com/erew123/alltalk_tts)
- [XTTS Documentation](https://docs.coqui.ai/en/latest/models/xtts.html)
