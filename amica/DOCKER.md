# Docker Deployment Guide

This guide covers deploying Amica using Docker.

## Quick Start

### Option 1: Run Amica App Only

```bash
# Build and run just the Amica web app
docker build -t amica .
docker run -p 3000:80 amica
```

Access at `http://localhost:3000`

### Option 2: Run Full Stack (App + Services)

```bash
# Start Amica with all backend services
docker-compose -f docker-compose.app.yml up -d
```

This starts:
- Amica web app (port 3000)
- OpenAI mock server (port 8083)
- Ollama LLM (port 11434)
- Whisper STT (port 9000)
- Piper TTS (port 10200)

Access at `http://localhost:3000`

### Option 3: Custom Configuration

```bash
# Create .env file
cat > .env <<EOF
AMICA_PORT=8080
OLLAMA_PORT=11434
WHISPER_PORT=9000
EOF

# Start with custom ports
docker-compose -f docker-compose.app.yml up -d
```

## Production Deployment

### 1. Build Production Image

```bash
docker build -t amica:latest .
```

### 2. Run with Production Settings

```bash
docker run -d \
  --name amica-prod \
  -p 80:80 \
  --restart unless-stopped \
  amica:latest
```

### 3. With Reverse Proxy (Nginx/Traefik)

```nginx
# nginx.conf
server {
    listen 443 ssl http2;
    server_name amica.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4. With Docker Compose (Production)

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  amica:
    image: amica:latest
    restart: unless-stopped
    ports:
      - "3000:80"
    networks:
      - web
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.amica.rule=Host(`amica.example.com`)"
      - "traefik.http.routers.amica.tls=true"

networks:
  web:
    external: true
```

## Environment Variables

### Amica App

| Variable | Default | Description |
|----------|---------|-------------|
| `AMICA_PORT` | 3000 | Port to expose Amica web app |
| `NODE_ENV` | production | Node environment |

### Service Ports

| Service | Variable | Default | Description |
|---------|----------|---------|-------------|
| OpenAI Mock | - | 8083 | Mock OpenAI API |
| Ollama | `OLLAMA_PORT` | 11434 | LLM inference |
| Whisper | `WHISPER_PORT` | 9000 | Speech-to-text |
| Piper | `PIPER_PORT` | 10200 | Text-to-speech |

## Container Services

For more detailed configuration of individual services, see:
- [containers/README.md](./containers/README.md) - Overview of all services
- Service-specific READMEs in `containers/<service>/`

## Development with Docker

### Hot Reload Development

```bash
# Run with volume mounting for development
docker run -it --rm \
  -p 3000:5173 \
  -v $(pwd):/app \
  -v /app/node_modules \
  node:20-alpine \
  sh -c "cd /app && npm install && npm run dev -- --host"
```

### Development Compose

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  amica-dev:
    image: node:20-alpine
    working_dir: /app
    command: sh -c "npm install && npm run dev -- --host"
    ports:
      - "3000:5173"
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
```

## Building Optimized Images

### Multi-Architecture Build

```bash
# Build for multiple platforms
docker buildx create --use
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t myregistry/amica:latest \
  --push \
  .
```

### Smaller Image Size

The Dockerfile uses multi-stage builds:
- Builder stage: ~1.5GB (includes build tools)
- Final image: ~50MB (only nginx + built assets)

### Cache Optimization

```bash
# Build with BuildKit cache
DOCKER_BUILDKIT=1 docker build \
  --cache-from myregistry/amica:latest \
  -t amica:latest \
  .
```

## Health Checks

### Container Health

```bash
# Check health status
docker inspect --format='{{.State.Health.Status}}' amica-app

# View health check logs
docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' amica-app
```

### Service Health

All services include health checks that run automatically.

## Troubleshooting

### Container won't start

```bash
# Check logs
docker logs amica-app

# Check if port is in use
lsof -i :3000

# Verify build
docker build --no-cache -t amica .
```

### Services can't connect

```bash
# Check network
docker network ls
docker network inspect amica-network

# Test service connectivity
docker exec amica-app wget -O- http://ollama:11434/api/tags
```

### High memory usage

```bash
# Limit memory
docker run -m 512m -p 3000:80 amica

# In docker-compose.yml:
services:
  amica:
    deploy:
      resources:
        limits:
          memory: 512M
```

## Updating

### Update Amica

```bash
# Pull latest code
git pull

# Rebuild image
docker-compose -f docker-compose.app.yml build

# Restart with new image
docker-compose -f docker-compose.app.yml up -d
```

### Update Services

```bash
# Pull latest service images
docker-compose -f docker-compose.app.yml pull

# Restart services
docker-compose -f docker-compose.app.yml up -d
```

## Backup and Restore

### Backup Data

```bash
# Backup volumes
docker run --rm \
  -v ollama-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/ollama-backup.tar.gz -C /data .
```

### Restore Data

```bash
# Restore volumes
docker run --rm \
  -v ollama-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/ollama-backup.tar.gz -C /data
```

## Security

### Best Practices

1. **Don't run as root** (nginx in container already uses non-root)
2. **Use secrets for sensitive data**
   ```yaml
   services:
     amica:
       secrets:
         - openai_key
   secrets:
     openai_key:
       file: ./secrets/openai_key.txt
   ```
3. **Limit container capabilities**
   ```yaml
   services:
     amica:
       cap_drop:
         - ALL
       cap_add:
         - NET_BIND_SERVICE
   ```
4. **Use read-only filesystem where possible**
5. **Keep images updated**

### Network Security

```yaml
# Isolate services
networks:
  frontend:
  backend:

services:
  amica:
    networks:
      - frontend
  ollama:
    networks:
      - backend
```

## Performance Tuning

### Nginx Configuration

Edit `nginx.conf` to tune:
- Worker processes
- Connection limits
- Buffer sizes
- Compression settings

### Resource Limits

```yaml
services:
  amica:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 256M
```

## Monitoring

### Container Stats

```bash
# Real-time stats
docker stats

# Specific container
docker stats amica-app
```

### Logs

```bash
# Follow logs
docker-compose -f docker-compose.app.yml logs -f

# Specific service
docker-compose -f docker-compose.app.yml logs -f amica

# With timestamps
docker logs -t amica-app
```

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [Nginx Container Guide](https://hub.docker.com/_/nginx)
