# Amica Service Containers

This directory contains Docker configurations for all services that Amica supports. These containers can be used for:

- **Local development** - Test integrations without external API costs
- **Integration testing** - Automated testing of service integrations
- **Offline usage** - Run Amica completely offline
- **Self-hosting** - Deploy your own AI infrastructure

## Quick Start

### Option 1: Start All Services (from containers/)

```bash
cd containers

# Copy and customize configuration
cp .env.example .env

# Start all services
docker-compose up -d
```

This starts the core services (OpenAI mock, Ollama, Whisper, Piper, Coqui).

### Option 2: Start Specific Services

Each service has its own directory with standalone configuration:

```bash
# Start only Ollama
cd containers/ollama
cp .env.example .env  # Customize if needed
docker-compose up -d

# Start only Whisper
cd containers/whisper
cp .env.example .env  # Customize model, language, etc.
docker-compose up -d
```

### Option 3: Use Service Profiles

```bash
cd containers

# Start only LLM services
docker-compose --profile llm up -d

# Start only TTS services
docker-compose --profile tts up -d

# Start only STT services
docker-compose --profile stt up -d

# Start everything
docker-compose --profile full up -d
```

## Available Services

### LLM (Large Language Models)

| Service | Port | Description | Resource Usage |
|---------|------|-------------|----------------|
| **OpenAI Mock** | 8080 | Mock OpenAI API for testing | Low (~50MB RAM) |
| **Ollama** | 11434 | Local LLM inference | Medium-High (4-16GB RAM) |
| **llama.cpp** | 8081 | Fast GGUF model inference | Medium (4-16GB RAM) |
| **KoboldAI** | 5001 | Creative text generation | Medium (4-16GB RAM) |
| **Arbius Testnet** | 8545 | Local Arbius blockchain | Low (~1-2GB RAM) |

### Speech-to-Text (STT)

| Service | Port | Description | Resource Usage |
|---------|------|-------------|----------------|
| **Whisper** | 9000 | OpenAI Whisper ASR | Medium (1-10GB RAM) |

### Text-to-Speech (TTS)

| Service | Port | Description | Resource Usage |
|---------|------|-------------|----------------|
| **Piper** | 10200 | Fast neural TTS | Low (~500MB RAM) |
| **Coqui** | 5002 | High-quality neural TTS | Medium-High (2-4GB RAM) |
| **AllTalk** | 7851 | XTTS with voice cloning | Medium-High (4-8GB RAM) |

### Voice Conversion

| Service | Port | Description | Resource Usage |
|---------|------|-------------|----------------|
| **RVC** | 7865 | Voice conversion/cloning | Medium (2-4GB RAM) |

## Customization

All containers support customization via `.env` files:

1. **Master configuration** - `containers/.env` controls all services when using the master docker-compose.yml
2. **Individual configuration** - Each service directory has its own `.env.example`

Copy any `.env.example` to `.env` and customize settings like:
- Ports
- Model selections (Whisper, Piper, Coqui)
- Model files (llama.cpp, KoboldAI)
- Performance settings (threads, GPU layers, context size)
- Languages

## Service Documentation

Each service has its own README with detailed setup instructions:

- [openai-compatible/README.md](./openai-compatible/README.md) - Mock OpenAI server
- [ollama/README.md](./ollama/README.md) - Ollama setup and models
- [llama.cpp/README.md](./llama.cpp/README.md) - llama.cpp configuration
- [koboldai/README.md](./koboldai/README.md) - KoboldAI setup
- [whisper/README.md](./whisper/README.md) - Whisper.cpp STT setup
- [piper/README.md](./piper/README.md) - Piper TTS configuration
- [coqui/README.md](./coqui/README.md) - Coqui TTS setup
- [alltalk/README.md](./alltalk/README.md) - AllTalk/XTTS TTS setup
- [rvc/README.md](./rvc/README.md) - RVC voice conversion
- [arbius/README.md](./arbius/README.md) - Arbius local testnet

### Additional Resources
- [VISION.md](./VISION.md) - Vision API support guide

## System Requirements

### Minimum (Testing/Development)
- **RAM**: 8GB
- **Storage**: 20GB free
- **CPU**: 4 cores

### Recommended (Full Stack)
- **RAM**: 16GB+
- **Storage**: 50GB+ free
- **CPU**: 8+ cores
- **GPU**: Optional but recommended for better performance

## Common Use Cases

### 1. Development Setup

Start just what you need for development:

```bash
# LLM + TTS for basic chat
docker-compose up -d openai-mock piper

# Full voice chat (LLM + STT + TTS)
docker-compose up -d ollama whisper piper
```

### 2. Integration Testing

See [../integration-tests/README.md](../integration-tests/README.md)

```bash
# From project root
docker-compose -f docker-compose.integration.yml up -d
INTEGRATION_TESTS=true npm run test:e2e -- integration-tests/
```

### 3. Offline Demo

```bash
# Start all local services
cd containers
docker-compose --profile full up -d

# Pull required models
docker exec -it amica-ollama ollama pull llama2
```

### 4. Production Self-Hosting

For production deployment, consider:
- Using proper secrets management
- Setting up reverse proxy (nginx/traefik)
- Implementing authentication
- Monitoring and logging
- Backup strategies

## Model Management

### Ollama Models

```bash
# Pull a model
docker exec -it amica-ollama ollama pull llama2

# List models
docker exec -it amica-ollama ollama list

# Remove a model
docker exec -it amica-ollama ollama rm llama2
```

### llama.cpp / KoboldAI Models

1. Download GGUF files from [Hugging Face](https://huggingface.co/models?search=gguf)
2. Place in `containers/llama.cpp/models/` or `containers/koboldai/models/`
3. Update the model path in `docker-compose.yml`

### Whisper Models

Models auto-download on first use. Configure model size in `docker-compose.yml`:
- `tiny` - Fastest
- `base` - Balanced (default)
- `small` / `medium` / `large` - Better quality, slower

## Troubleshooting

### Services won't start

```bash
# Check logs
docker-compose logs <service-name>

# Check if ports are available
lsof -i :11434  # Example: check Ollama port

# Restart specific service
docker-compose restart <service-name>
```

### Out of memory

```bash
# Stop unused services
docker-compose stop <service-name>

# Use smaller models
# Edit docker-compose.yml to use smaller model sizes
```

### Service not responding

```bash
# Check service health
docker-compose ps

# Restart with fresh state
docker-compose down
docker-compose up -d
```

## Performance Optimization

### CPU-Only Systems

- Use smaller models (7B or less)
- Reduce context size
- Use quantized models (Q4_K_M or Q5_K_M)

### GPU Systems

For NVIDIA GPU support, add to services:

```yaml
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: 1
          capabilities: [gpu]
```

Install nvidia-docker first:
```bash
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list
sudo apt-get update && sudo apt-get install -y nvidia-docker2
sudo systemctl restart docker
```

## Network Configuration

All services are on the `amica-services` network. To access from Amica:

```
http://localhost:<port>
```

If running Amica in Docker, use service names:
```
http://ollama:11434
http://whisper:9000
```

## Security Notes

⚠️ **These configurations are for development/testing only**

For production:
- Enable authentication on all services
- Use HTTPS/TLS
- Don't expose ports publicly without firewall rules
- Use environment variables for secrets
- Implement rate limiting
- Monitor for abuse

## Cleanup

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (deletes models/data)
docker-compose down -v

# Remove service images
docker-compose down --rmi all
```

## Contributing

To add a new service:

1. Create directory: `containers/service-name/`
2. Add `docker-compose.yml` with service definition
3. Add `README.md` with usage instructions
4. Update this README with service details
5. Add to main `containers/docker-compose.yml`
6. Add integration test in `integration-tests/`

## Resources

- [Ollama](https://ollama.ai/)
- [llama.cpp](https://github.com/ggerganov/llama.cpp)
- [Whisper](https://github.com/openai/whisper)
- [Piper TTS](https://github.com/rhasspy/piper)
- [Coqui TTS](https://github.com/coqui-ai/TTS)
- [KoboldAI](https://github.com/LostRuins/koboldcpp)
