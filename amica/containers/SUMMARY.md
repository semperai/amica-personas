# Container Infrastructure Summary

Complete Docker infrastructure for Amica and all supported integrations.

## Overview

This repository now includes:
- ✅ **9 service containers** - All major Amica integrations
- ✅ **Amica app containerization** - Production-ready Docker setup
- ✅ **Full customization** - `.env` files for all services
- ✅ **Integration testing** - Ready for automated tests
- ✅ **Development & production** - Dual-use infrastructure

## Available Containers

### LLM Services (5)
1. **openai-compatible** - Mock OpenAI API for testing (Node.js)
   - Port: 8083
   - Zero cost testing
   - OpenAI-compatible endpoints

2. **ollama** - Local LLM inference
   - Port: 11434
   - Models: llama2, mistral, etc.
   - GPU support optional

3. **llama.cpp** - Fast GGUF model inference
   - Port: 8081
   - OpenAI-compatible API
   - Customizable models

4. **koboldai** - Creative text generation
   - Port: 5001
   - GGUF model support
   - Advanced sampling options

5. **arbius** - Local Arbius blockchain testnet
   - Port: 8545
   - Full smart contract deployment
   - Test accounts with 10,000 ETH
   - For testing Arbius integration

### Speech-to-Text (1)
5. **whisper** - Whisper.cpp with OpenAI-compatible API
   - Port: 9000
   - Multiple model sizes (tiny → large)
   - Configurable language
   - `/v1/audio/transcriptions` endpoint

### Text-to-Speech (3)
6. **piper** - Fast neural TTS
   - Port: 10200
   - Multiple voices/languages
   - Low resource usage
   - Very fast inference

7. **coqui** - High-quality neural TTS
   - Port: 5002
   - Many model options
   - GPU recommended
   - Good quality output

8. **alltalk** - XTTS with voice cloning
   - Port: 7851
   - Voice cloning from samples
   - 16+ languages
   - No training required

### Voice Conversion (1)
9. **rvc** - Voice conversion/cloning
   - Port: 7865
   - Custom model support
   - Real-time conversion
   - Advanced parameters

## Amica Application

### Production Deployment
```bash
# Build and run
docker build -t amica .
docker run -p 3000:80 amica

# Full stack with services
docker-compose -f docker-compose.app.yml up -d
```

### Features
- Multi-stage build (~50MB final image)
- Nginx for serving
- Health checks included
- Optimized caching
- Production ready

## Quick Start Guide

### 1. Individual Service
```bash
cd containers/ollama
cp .env.example .env
docker-compose up -d
```

### 2. All Services (Development)
```bash
cd containers
cp .env.example .env
docker-compose up -d
```

### 3. Integration Testing
```bash
docker-compose -f docker-compose.integration.yml up -d
INTEGRATION_TESTS=true npm run test:e2e -- integration-tests/
```

### 4. Full Stack (App + Services)
```bash
docker-compose -f docker-compose.app.yml up -d
```

## Customization Examples

### Whisper with Different Model
```bash
cd containers/whisper
echo "WHISPER_MODEL=medium" >> .env
echo "WHISPER_LANGUAGE=es" >> .env
docker-compose up -d
```

### Piper with Different Voice
```bash
cd containers/piper
echo "PIPER_VOICE=en_GB-alan-medium" >> .env
docker-compose up -d
```

### llama.cpp with Custom Model
```bash
cd containers/llama.cpp
mkdir -p models
# Download model.gguf to models/
echo "LLAMACPP_MODEL=mymodel.gguf" >> .env
docker-compose up -d
```

## Directory Structure

```
containers/
├── .env.example              # Master config (all services)
├── README.md                 # Complete usage guide
├── docker-compose.yml        # Orchestrates all services
├── openai-compatible/        # Mock OpenAI server
│   ├── Dockerfile
│   ├── server.js
│   └── docker-compose.yml
├── ollama/
│   ├── .env.example
│   ├── docker-compose.yml
│   └── README.md
├── llama.cpp/
│   ├── .env.example
│   ├── docker-compose.yml
│   ├── models/              # Place GGUF models here
│   └── README.md
├── koboldai/
│   ├── .env.example
│   ├── docker-compose.yml
│   ├── models/              # Place GGUF models here
│   └── README.md
├── whisper/
│   ├── .env.example
│   ├── docker-compose.yml
│   └── README.md
├── piper/
│   ├── .env.example
│   ├── docker-compose.yml
│   └── README.md
├── coqui/
│   ├── .env.example
│   ├── docker-compose.yml
│   └── README.md
├── alltalk/
│   ├── Dockerfile
│   ├── .env.example
│   ├── docker-compose.yml
│   └── README.md
└── rvc/
    ├── Dockerfile
    ├── .env.example
    ├── docker-compose.yml
    ├── weights/             # Place RVC models here
    └── README.md

# Root files for Amica app
Dockerfile                   # Amica app container
nginx.conf                   # Nginx config
.dockerignore               # Build optimization
docker-compose.app.yml      # Full stack deployment
DOCKER.md                   # Deployment guide
```

## Configuration Files

Every service has `.env.example` with customization options:
- Ports
- Model selections
- Performance tuning
- Resource limits
- Language settings

## Resource Requirements

| Setup | RAM | Storage | Notes |
|-------|-----|---------|-------|
| **Minimal** (mock + piper) | 1GB | 5GB | Testing only |
| **Light** (ollama + whisper + piper) | 8GB | 20GB | Basic functionality |
| **Standard** (+ coqui) | 12GB | 30GB | Good experience |
| **Full** (all services) | 16GB+ | 50GB+ | Complete setup |

## Common Use Cases

### 1. Cost-Free Development
```bash
# Use mock OpenAI + local TTS/STT
docker-compose up -d openai-mock whisper piper
```

### 2. High-Quality Local
```bash
# Best quality local services
docker-compose up -d ollama whisper coqui
```

### 3. Voice Cloning Demo
```bash
# XTTS + RVC for voice cloning
docker-compose up -d alltalk rvc
```

### 4. Integration Testing
```bash
# Core services for tests
docker-compose -f docker-compose.integration.yml up -d
```

## Documentation

- **containers/README.md** - Service overview & usage
- **DOCKER.md** - Amica app deployment guide
- **containers/\<service\>/README.md** - Service-specific docs
- **integration-tests/README.md** - Testing guide
- **E2E_COVERAGE_REPORT.md** - Test coverage analysis

## Next Steps

1. **Try a container**:
   ```bash
   cd containers/piper
   docker-compose up -d
   ```

2. **Configure Amica** to use the service at `http://localhost:<port>`

3. **Customize** via `.env` files

4. **Scale up** by adding more services as needed

## Troubleshooting

### Service won't start
```bash
docker-compose logs <service-name>
```

### Port already in use
Edit `.env` to change port:
```bash
echo "SERVICE_PORT=9999" >> .env
```

### Out of memory
- Use smaller models
- Start fewer services
- Enable swap

## Contributing

To add a new service container:
1. Create `containers/service-name/` directory
2. Add `Dockerfile` and/or `docker-compose.yml`
3. Add `.env.example` with configuration options
4. Write `README.md` with setup instructions
5. Update `containers/docker-compose.yml` to include it
6. Add integration tests if applicable

## Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/)
- Individual service docs in each container directory
