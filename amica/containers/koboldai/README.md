# KoboldAI Container

KoboldCpp for text generation with Amica.

## Setup

1. Download GGUF models to `models/` directory:

```bash
mkdir -p models
# Download your preferred GGUF model from Hugging Face
```

2. Copy and customize environment file:

```bash
cp .env.example .env
# Edit .env to set your model filename and preferences
```

3. Start the service:

```bash
docker-compose up -d
```

## Configuration

Edit `.env` file to customize:

```bash
# Port
KOBOLDAI_PORT=5001

# Model file (must exist in ./models/)
KOBOLDAI_MODEL=mistral-7b-instruct.gguf

# Context size
KOBOLDAI_CONTEXT=2048

# CPU threads
KOBOLDAI_THREADS=4

# GPU layers (0 = CPU only)
KOBOLDAI_GPU_LAYERS=0
```

Or use environment variables:
```bash
KOBOLDAI_MODEL=mymodel.gguf docker-compose up -d
```

## Configure Amica

1. Open Amica settings
2. Navigate to "Chatbot Backend"
3. Select "KoboldAI"
4. Set URL: `http://localhost:5001`

## Model Sources

Same as llama.cpp - any GGUF format model:
- [TheBloke on Hugging Face](https://huggingface.co/TheBloke)

## API Endpoints

- Model info: `http://localhost:5001/api/v1/model`
- Generate: `http://localhost:5001/api/v1/generate`
- Extra: `http://localhost:5001/api/extra/generate/stream`

## Command Line Options

Edit in `docker-compose.yml`:
- `--contextsize 2048` - Context window size
- `--threads 4` - CPU threads to use
- `--usecublas` - Enable GPU acceleration (requires CUDA)
- `--gpulayers 32` - Number of layers on GPU

## Resources

- RAM: 4-16GB depending on model
- CPU: Multi-core recommended
- GPU: Optional but improves performance

## Advantages

- Great for roleplay and creative writing
- Advanced sampling options
- Good UI for testing
- OpenAI-compatible API
