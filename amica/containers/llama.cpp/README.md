# llama.cpp Server Container

Fast LLM inference using llama.cpp with OpenAI-compatible API.

## Setup

1. Download GGUF models to the `models/` directory:

```bash
mkdir -p models

# Download from Hugging Face (example)
wget https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF/resolve/main/mistral-7b-instruct-v0.2.Q4_K_M.gguf \
  -O models/mistral-7b-instruct-v0.2.Q4_K_M.gguf
```

2. Copy and customize environment file:

```bash
cp .env.example .env
# Edit .env to set your model filename and preferences
```

3. Start the server:

```bash
docker-compose up -d
```

## Configuration

Edit `.env` file to customize:

```bash
# Port
LLAMACPP_PORT=8081

# Model file (must exist in ./models/)
LLAMACPP_MODEL=mistral-7b-instruct-v0.2.Q4_K_M.gguf

# Context size
LLAMACPP_CONTEXT=2048

# CPU threads
LLAMACPP_THREADS=4

# GPU layers (0 = CPU only)
LLAMACPP_GPU_LAYERS=0

# Batch size
LLAMACPP_BATCH=512
```

Or use environment variables:
```bash
LLAMACPP_MODEL=mymodel.gguf LLAMACPP_CONTEXT=4096 docker-compose up -d
```

## Configure Amica

1. Open Amica settings
2. Navigate to "Chatbot Backend"
3. Select "llama.cpp"
4. Set URL: `http://localhost:8081`
5. Model: (model name from file)

## Model Sources

- [TheBloke on Hugging Face](https://huggingface.co/TheBloke) - Quantized GGUF models
- [Ollama Library](https://ollama.ai/library) - Some models available in GGUF

## Popular Models

- **Mistral 7B** - Great quality/performance ratio
- **Llama 3 8B** - Latest Meta model
- **Phi-3** - Small but capable (3.8B)
- **TinyLlama** - Very fast (1.1B)

## Quantization Levels

- **Q4_K_M** - Good balance (recommended)
- **Q5_K_M** - Better quality, slower
- **Q2_K** - Faster but lower quality

## API Endpoints

- Health: `http://localhost:8081/health`
- Completions: `http://localhost:8081/v1/chat/completions`
- Models: `http://localhost:8081/v1/models`

## Performance Tuning

Adjust in `docker-compose.yml`:
- `-c 2048` - Context size
- `-ngl 32` - GPU layers (if using GPU)
- `-t 4` - Number of threads

## Resources

- RAM: 4-16GB depending on model size
- CPU: Multi-core recommended
