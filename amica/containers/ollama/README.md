# Ollama Container

Run Ollama locally for LLM inference with Amica.

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
# Port
OLLAMA_PORT=11434

# Host binding
OLLAMA_HOST=0.0.0.0
```

Or use environment variables:
```bash
OLLAMA_PORT=8080 docker-compose up -d
```

## Pull Models

```bash
# Pull a model
docker exec -it amica-ollama ollama pull llama2
docker exec -it amica-ollama ollama pull mistral
docker exec -it amica-ollama ollama pull llama3.2-vision

# List installed models
docker exec -it amica-ollama ollama list
```

## Configure Amica

1. Open Amica settings
2. Navigate to "Chatbot Backend"
3. Select "Ollama"
4. Set URL: `http://localhost:11434`
5. Model: `llama2` (or any pulled model)

## Recommended Models

- **llama2** (7B) - Good general purpose, fast
- **mistral** (7B) - High quality responses
- **llama3.2-vision** - For vision/image analysis
- **codellama** - For code-related tasks

## API Endpoints

- List models: `http://localhost:11434/api/tags`
- Chat: `http://localhost:11434/api/chat`
- Generate: `http://localhost:11434/api/generate`

## Resources

- RAM: 8GB minimum (16GB recommended for larger models)
- Storage: ~4-8GB per model

## Documentation

https://ollama.ai/
