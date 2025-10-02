# Coqui TTS Container

High-quality neural text-to-speech using Coqui TTS.

## Quick Start

```bash
docker-compose up -d
```

⚠️ **Note**: First startup may take 1-2 minutes to download models

## Configure Amica

1. Open Amica settings
2. Navigate to "TTS Backend"
3. Select "Coqui Local"
4. Set URL: `http://localhost:5002`

## Available Models

Edit `--model_name` in `docker-compose.yml`:

### English Models
- `tts_models/en/ljspeech/tacotron2-DDC` - Default, good quality
- `tts_models/en/ljspeech/fast_pitch`
- `tts_models/en/vctk/vits` - Multi-speaker
- `tts_models/en/jenny/jenny`

### Multi-language Models
- `tts_models/multilingual/multi-dataset/your_tts` - 16 languages
- `tts_models/multilingual/multi-dataset/xtts_v2` - Voice cloning

[Full model list](https://github.com/coqui-ai/TTS#released-models)

## API Endpoint

```bash
curl "http://localhost:5002/api/tts?text=Hello%20world" --output speech.wav
```

## Resources

- RAM: 2-4GB
- Storage: ~500MB - 2GB for models
- CPU: Works but slower
- GPU: Recommended for real-time performance

## GPU Support

Add to service in `docker-compose.yml`:
```yaml
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: 1
          capabilities: [gpu]
```

## Voice Cloning

For XTTS model with voice cloning:
```bash
curl -X POST "http://localhost:5002/api/tts" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello, this is a cloned voice",
    "speaker_wav": "path/to/reference.wav",
    "language": "en"
  }'
```
