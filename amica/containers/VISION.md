# Vision API Support

Vision capabilities are already available through existing containers.

## Ollama Vision

The Ollama container supports vision-capable models.

### Setup

1. Pull a vision model:
```bash
docker exec -it amica-ollama ollama pull llama3.2-vision
docker exec -it amica-ollama ollama pull llava
docker exec -it amica-ollama ollama pull bakllava
```

2. Configure Amica:
   - Settings → Vision Backend → Ollama
   - Vision URL: `http://localhost:11434`
   - Vision Model: `llama3.2-vision`

### Available Vision Models
- **llama3.2-vision** - Meta's latest (11B/90B)
- **llava** - General purpose vision-language
- **llava-phi3** - Smaller, faster (3.8B)
- **bakllava** - Improved LLaVA variant
- **moondream** - Lightweight vision model (1.8B)

## llama.cpp Vision

The llama.cpp container can run vision-capable GGUF models.

### Setup

1. Download a vision-capable GGUF model:
```bash
cd containers/llama.cpp/models

# Example: LLaVA model
wget https://huggingface.co/mys/ggml_llava-v1.5-7b/resolve/main/ggml-model-q4_k.gguf
wget https://huggingface.co/mys/ggml_llava-v1.5-7b/resolve/main/mmproj-model-f16.gguf
```

2. Update `.env`:
```bash
LLAMACPP_MODEL=ggml-model-q4_k.gguf
```

3. Configure Amica:
   - Settings → Vision Backend → llama.cpp
   - Vision URL: `http://localhost:8081`

### Vision-Capable GGUF Models
- LLaVA variants (7B, 13B, 34B)
- BakLLaVA
- Obsidian
- Any CLIP + LLM combined model

## OpenAI Vision

OpenAI Vision is a cloud service and requires an API key.

### Setup

Configure Amica:
- Settings → Vision Backend → OpenAI
- Vision URL: `https://api.openai.com`
- API Key: Your OpenAI API key
- Vision Model: `gpt-4-vision-preview` or `gpt-4o`

### Mock for Testing

The `openai-compatible` container doesn't support vision endpoints yet, but you can extend it:

```javascript
// Add to containers/openai-compatible/server.js

// Vision endpoint
if (req.url === '/v1/chat/completions' && req.method === 'POST') {
  // Check if message contains images
  const hasImages = messages.some(m =>
    Array.isArray(m.content) &&
    m.content.some(c => c.type === 'image_url')
  );

  if (hasImages) {
    // Return mock vision response
    return 'This is a mock description of the image.';
  }
}
```

## Image Input

All vision backends support:
- Webcam capture
- File upload
- Image URLs

Amica will:
1. Capture/load image
2. Send to vision backend
3. Get description/analysis
4. Use in chat context

## Performance

### Ollama Vision
- **RAM**: 8-16GB depending on model
- **VRAM**: 6-24GB for GPU acceleration
- **Speed**: 2-5 seconds per image (GPU)
- **Quality**: Excellent with llama3.2-vision

### llama.cpp Vision
- **RAM**: 4-12GB depending on model
- **VRAM**: Optional but recommended
- **Speed**: 3-10 seconds per image
- **Quality**: Good with LLaVA models

### OpenAI Vision
- **Cost**: $0.01-0.03 per image
- **Speed**: 1-3 seconds
- **Quality**: Excellent

## Example Usage

### 1. Webcam Mode
Enable webcam in Amica settings, vision backend will automatically analyze frames.

### 2. Image Upload
Upload an image, ask questions about it.

### 3. Vision + Chat
```
User: *uploads image of a diagram*
User: Explain this diagram
Assistant: *analyzes image and provides explanation*
```

## Troubleshooting

### Ollama vision not working
```bash
# Check model is installed
docker exec -it amica-ollama ollama list

# Pull vision model
docker exec -it amica-ollama ollama pull llama3.2-vision

# Check logs
docker logs amica-ollama
```

### llama.cpp vision not working
- Ensure you have both model and mmproj files
- Check model path in docker-compose.yml
- Verify model is vision-capable

### Out of memory
- Use smaller vision models (llava-phi3, moondream)
- Enable low VRAM mode if available
- Use CPU mode (slower but works)

## Recommended Configurations

### Best Quality (High-End System)
- Ollama with llama3.2-vision:90b
- 24GB+ VRAM
- ~30GB RAM

### Balanced (Mid-Range System)
- Ollama with llama3.2-vision:11b
- 8GB VRAM
- 16GB RAM

### Lightweight (Low-End System)
- Ollama with moondream
- 4GB VRAM
- 8GB RAM

### Cloud (No Local Resources)
- OpenAI Vision (gpt-4o)
- Pay per use
- Very fast

## Resources

- [Ollama Vision Models](https://ollama.ai/library?q=vision)
- [LLaVA Model Card](https://huggingface.co/liuhaotian/llava-v1.5-7b)
- [llama.cpp Vision Support](https://github.com/ggerganov/llama.cpp/tree/master/examples/llava)
