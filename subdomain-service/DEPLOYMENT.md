# Deployment Guide

## VPS Setup with Cloudflare

### 1. DNS Configuration

In your Cloudflare dashboard for `amica.bot`:

1. Add wildcard A record:
   - **Type**: A
   - **Name**: `*` (or `*.amica` if you want `*.amica.bot`)
   - **IPv4 address**: Your VPS IP address
   - **Proxy status**: Proxied (orange cloud) ✓
   - **TTL**: Auto

2. Add root domain A record (if not exists):
   - **Type**: A
   - **Name**: `@`
   - **IPv4 address**: Your VPS IP address
   - **Proxy status**: Proxied (orange cloud) ✓
   - **TTL**: Auto

### 2. VPS Initial Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+ (using nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18

# Install PM2 for process management
npm install -g pm2

# Install Nginx
sudo apt install nginx -y

# Install Git
sudo apt install git -y
```

### 3. Clone and Setup

```bash
# Create app directory
mkdir -p /var/www
cd /var/www

# Clone repository
git clone <your-repo-url> amica-personas
cd amica-personas/subdomain-service

# Install dependencies
npm install

# Build TypeScript
npm run build

# Copy .env.example to .env and configure
cp .env.example .env
nano .env
```

Configure `.env`:
```env
GRAPHQL_ENDPOINT=https://squid.subsquid.io/amica-personas/graphql
PORT=3001
CHAIN_ID=42161
ALLOWED_ORIGINS=https://amica.bot,https://*.amica.bot
```

### 4. Build Amica Version 1

```bash
# Run the build script
./scripts/build-amica-version.sh 1

# Verify the build
ls -la builds/amica_v1/
```

### 5. Start with PM2

```bash
# Start the service
pm2 start dist/server.js --name amica-subdomain

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup systemd
# Follow the command it outputs

# View logs
pm2 logs amica-subdomain

# Monitor
pm2 monit
```

### 6. Nginx Configuration

Create Nginx config:

```bash
sudo nano /etc/nginx/sites-available/amica-subdomain
```

Add this configuration:

```nginx
# Rate limiting
limit_req_zone $binary_remote_addr zone=amica_limit:10m rate=10r/s;

server {
    listen 80;
    listen [::]:80;
    server_name amica.bot *.amica.bot;

    # Rate limiting
    limit_req zone=amica_limit burst=20 nodelay;

    # Logging
    access_log /var/log/nginx/amica-subdomain.access.log;
    error_log /var/log/nginx/amica-subdomain.error.log;

    # Proxy to Node.js
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;

        # WebSocket support (if needed in future)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';

        # Important: pass the original host
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Cache static assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://localhost:3001;
        proxy_cache_valid 200 1d;
        add_header Cache-Control "public, max-age=86400";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

Enable the site:

```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/amica-subdomain /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### 7. SSL/TLS with Cloudflare

In Cloudflare dashboard:

1. **SSL/TLS → Overview**:
   - Set encryption mode to **Full (strict)**

2. **SSL/TLS → Origin Server**:
   - Create an Origin Certificate
   - Download certificate and private key
   - Install on your server:

```bash
# Create SSL directory
sudo mkdir -p /etc/nginx/ssl

# Copy certificate (paste from Cloudflare)
sudo nano /etc/nginx/ssl/amica-bot-origin.pem

# Copy private key (paste from Cloudflare)
sudo nano /etc/nginx/ssl/amica-bot-origin.key

# Set permissions
sudo chmod 600 /etc/nginx/ssl/amica-bot-origin.key
```

Update Nginx config:

```bash
sudo nano /etc/nginx/sites-available/amica-subdomain
```

Add SSL configuration:

```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name amica.bot *.amica.bot;

    # SSL certificates from Cloudflare
    ssl_certificate /etc/nginx/ssl/amica-bot-origin.pem;
    ssl_certificate_key /etc/nginx/ssl/amica-bot-origin.key;

    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # ... rest of your config (same as HTTP above)
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name amica.bot *.amica.bot;
    return 301 https://$host$request_uri;
}
```

Reload Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 8. Cloudflare Additional Settings

1. **Speed → Optimization**:
   - Enable Auto Minify (JS, CSS, HTML)
   - Enable Brotli

2. **Caching → Configuration**:
   - Set caching level to Standard
   - Enable Always Online

3. **Security → Settings**:
   - Security Level: Medium
   - Enable Browser Integrity Check

### 9. Firewall Setup

```bash
# Install UFW
sudo apt install ufw -y

# Allow SSH (important!)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### 10. Monitoring and Maintenance

```bash
# View PM2 logs
pm2 logs amica-subdomain --lines 100

# Restart service
pm2 restart amica-subdomain

# View Nginx logs
sudo tail -f /var/log/nginx/amica-subdomain.access.log
sudo tail -f /var/log/nginx/amica-subdomain.error.log

# Check service status
pm2 status
sudo systemctl status nginx
```

### 11. Updates and Deployments

Create a deployment script:

```bash
nano /var/www/amica-personas/subdomain-service/deploy.sh
```

```bash
#!/bin/bash
set -e

cd /var/www/amica-personas/subdomain-service

# Pull latest code
git pull origin main

# Install dependencies
npm install

# Build TypeScript
npm run build

# Rebuild Amica if needed
# ./scripts/build-amica-version.sh 1

# Restart PM2
pm2 restart amica-subdomain

echo "Deployment complete!"
```

Make it executable:
```bash
chmod +x /var/www/amica-personas/subdomain-service/deploy.sh
```

### 12. Testing

Test different scenarios:

```bash
# Test root domain
curl -I https://amica.bot

# Test subdomain (replace with actual persona)
curl -I https://test-persona.amica.bot

# Test 404
curl -I https://nonexistent.amica.bot
```

### 13. Backup Strategy

```bash
# Create backup script
sudo nano /usr/local/bin/backup-amica.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/amica"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup builds directory
tar -czf $BACKUP_DIR/builds_$DATE.tar.gz /var/www/amica-personas/subdomain-service/builds/

# Keep only last 7 days
find $BACKUP_DIR -name "builds_*.tar.gz" -mtime +7 -delete
```

```bash
chmod +x /usr/local/bin/backup-amica.sh

# Add to cron (daily at 2 AM)
sudo crontab -e
# Add: 0 2 * * * /usr/local/bin/backup-amica.sh
```

## Troubleshooting

### Service won't start
```bash
pm2 logs amica-subdomain --err
# Check for port conflicts
sudo lsof -i :3001
```

### Nginx errors
```bash
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

### GraphQL connection issues
```bash
# Test GraphQL endpoint
curl -X POST https://squid.subsquid.io/amica-personas/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ personas(limit: 1) { id name } }"}'
```

### Domain not resolving
- Check Cloudflare DNS settings
- Verify DNS propagation: `dig test-persona.amica.bot`
- Check Cloudflare proxy status (should be orange)

## Performance Optimization

### Enable Nginx caching
```nginx
# Add to http block in /etc/nginx/nginx.conf
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=amica_cache:10m max_size=1g inactive=60m;
```

### PM2 Cluster Mode
```bash
pm2 start dist/server.js --name amica-subdomain -i max
```

### Node.js optimization
```bash
# Set in PM2
pm2 start dist/server.js --name amica-subdomain --node-args="--max-old-space-size=4096"
```
