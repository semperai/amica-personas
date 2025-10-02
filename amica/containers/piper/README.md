# Piper TTS Container

Fast, local neural text-to-speech using Piper.

## Quick Start

```bash
docker-compose up -d
```

## Configure Amica

1. Open Amica settings
2. Navigate to "TTS Backend"
3. Select "Piper"
4. Set URL: `http://localhost:10200`

## Available Voices

Edit `--voice` in `docker-compose.yml`:

### English
- `en_US-lessac-medium` - Clear, neutral (default)
- `en_US-amy-medium` - Female voice
- `en_US-ryan-medium` - Male voice
- `en_GB-alan-medium` - British English

### Other Languages
- `de_DE-thorsten-medium` - German
- `es_ES-carlfm-medium` - Spanish
- `fr_FR-tom-medium` - French
- `it_IT-riccardo-medium` - Italian

[Full voice list](https://github.com/rhasspy/piper/blob/master/VOICES.md)

## Quality Levels

- `low` - Fastest, lower quality
- `medium` - Balanced (recommended)
- `high` - Best quality, slower

## API Usage

```bash
echo "Hello, this is a test" | nc localhost 10200
```

## Resources

- RAM: ~500MB - 1GB
- CPU: Lightweight, runs on most systems
- First run downloads voice model (~10-50MB)

## Advantages

- Very fast inference
- Low resource usage
- Good quality
- No GPU required
- Many language/voice options
