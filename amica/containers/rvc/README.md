# RVC (Retrieval-based Voice Conversion) Container

Voice conversion and cloning using RVC technology.

## What is RVC?

RVC allows you to convert voice from one speaker to sound like another. It's commonly used for:
- Voice cloning
- Character voice synthesis
- Voice transformation effects

## Setup

1. Create directories for models:

```bash
mkdir -p weights logs models
```

2. Download RVC models:

Download pre-trained models from [Hugging Face](https://huggingface.co/models?search=rvc) or train your own.

Place models in the `weights/` directory:
```
weights/
├── your-model-name.pth
└── your-model-name.index (optional, for better quality)
```

3. Copy and customize environment file:

```bash
cp .env.example .env
# Edit .env to set your model name
```

4. Build and start:

```bash
docker-compose build
docker-compose up -d
```

## Configuration

Edit `.env` file to customize:

```bash
# Port
RVC_PORT=7865

# Model name (filename in ./weights/ without extension)
RVC_MODEL_NAME=my-voice-model

# Index path (optional, for better quality)
RVC_INDEX_PATH=my-voice-model.index

# Pitch adjustment (-12 to 12 semitones)
RVC_F0_UPKEY=0

# Pitch extraction method
RVC_F0_METHOD=harvest  # or 'pm' for faster

# Index rate (0.0 to 1.0, default 0.66)
RVC_INDEX_RATE=0.66

# Filter radius (0 to 7, reduces breathiness)
RVC_FILTER_RADIUS=3

# Resample rate (0 = no resampling, or 16000-48000)
RVC_RESAMPLE_SR=0

# Volume envelope (0.0 to 1.0)
RVC_RMS_MIX_RATE=0.25

# Protect consonants (0.0 to 0.5)
RVC_PROTECT=0.33
```

## Configure Amica

1. Open Amica settings
2. Navigate to "RVC Settings"
3. Enable RVC
4. Set URL: `http://localhost:7865`
5. Configure model name and parameters

## Getting Models

### Pre-trained Models
- [Hugging Face RVC Models](https://huggingface.co/models?search=rvc)
- Community models for various characters and voices

### Training Your Own
You can train custom models using:
- [RVC-Project](https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI)
- Requires audio samples of the target voice (5-10 minutes recommended)

## API Endpoints

```bash
# Convert voice
curl -X POST http://localhost:7865/api/convert \
  -F "audio=@input.wav" \
  -F "model_name=your-model" \
  -F "f0_up_key=0" \
  -F "f0_method=harvest"
```

## Parameters Explained

### F0 Up Key (Pitch)
- Negative values: Lower pitch (male voice)
- Positive values: Raise pitch (female voice)
- Range: -12 to +12 semitones

### F0 Method
- **harvest**: Better quality, especially for bass, but very slow
- **pm**: Faster extraction, lower quality

### Index Rate
- Controls how much to use the index file
- Higher = more like training data
- Lower = more like original voice
- Default: 0.66

### Filter Radius
- Median filtering for pitch results
- Reduces breathiness
- Range: 0 to 7 (3 is typical)

### RMS Mix Rate
- Volume envelope scaling
- 0 = mimics original volume
- 1 = consistent loud volume
- Default: 0.25

### Protect
- Protects voiceless consonants
- Prevents artifacts in electronic music
- 0 = maximum protection
- 0.5 = disabled
- Default: 0.33

## Resources

- RAM: 2-4GB
- GPU: Recommended for real-time conversion
- Storage: ~500MB per model

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

## Troubleshooting

### Model not loading
- Check that model file exists in `weights/`
- Ensure filename matches `RVC_MODEL_NAME`
- Check logs: `docker-compose logs rvc`

### Poor quality conversion
- Try using an index file
- Adjust `RVC_INDEX_RATE`
- Use `harvest` method instead of `pm`
- Increase `RVC_FILTER_RADIUS`

### Slow processing
- Use `pm` instead of `harvest` for F0 method
- Enable GPU support
- Use a smaller/faster model
