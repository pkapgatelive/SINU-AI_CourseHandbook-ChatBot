#!/bin/bash

# =============================================================================
# VPS Direct Deployment Script for Next.js Chatbot
# =============================================================================
# Copy this entire script to your VPS and run it
# This script creates all files and deploys the chatbot on ports 8080/8443
# =============================================================================

set -e

# Configuration
DOMAIN="chatbot.kapgate.com"
EMAIL="admin@kapgate.com"
VPS_IP="72.60.40.39"
REPO_URL="https://github.com/pkapgatelive/SINU-AI_CourseHandbook-ChatBot.git"
PROJECT_DIR="/opt/nextjs-chatbot"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check root
if [[ $EUID -ne 0 ]]; then
    log_error "This script must be run as root (use sudo)."
    exit 1
fi

log_info "Starting Docker deployment for $DOMAIN on ports 8080/8443..."

# Install Docker if needed
if ! command -v docker &> /dev/null; then
    log_info "Installing Docker..."
    apt-get update
    apt-get install -y ca-certificates curl gnupg lsb-release git
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl start docker
    systemctl enable docker
    log_success "Docker installed."
fi

# Setup firewall
log_info "Configuring firewall..."
apt-get install -y ufw
ufw allow ssh
ufw allow 8080/tcp
ufw allow 8443/tcp
ufw --force enable
log_success "Firewall configured for ports 8080/8443."

# Create project directory
log_info "Setting up project..."
mkdir -p $PROJECT_DIR
cd $PROJECT_DIR

# Clone repository
if [[ -d ".git" ]]; then
    git fetch origin && git reset --hard origin/main && git clean -fd
else
    git clone $REPO_URL .
fi

# Create Dockerfile
log_info "Creating Docker configuration..."
cat > Dockerfile << 'EOF'
FROM node:18-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --only=production

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
RUN mkdir .next
RUN chown nextjs:nodejs .next
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"
CMD ["node", "server.js"]
EOF

# Update next.config.ts for standalone
if [[ -f "next.config.ts" ]]; then
    if ! grep -q "output.*standalone" next.config.ts; then
        sed -i '/const nextConfig: NextConfig = {/a\  output: '\''standalone'\'',' next.config.ts
        log_info "Updated Next.js config for standalone output."
    fi
fi

# Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  chatbot:
    build: .
    container_name: nextjs-chatbot
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - N8N_WEBHOOK_URL=https://n8n.srv963093.hstgr.cloud/webhook/5f1c0c82-0ff9-40c7-9e2e-b1a96ffe24cd/chat
      - RATE_LIMIT_WINDOW=900000
      - RATE_LIMIT_MAX_REQUESTS=10
      - PORT=3000
    networks:
      - chatbot-network

  nginx:
    image: nginx:alpine
    container_name: nginx-proxy
    restart: unless-stopped
    ports:
      - "8080:80"
      - "8443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./ssl:/etc/nginx/ssl:ro
      - /var/log/nginx:/var/log/nginx
    networks:
      - chatbot-network
    depends_on:
      - chatbot

networks:
  chatbot-network:
    driver: bridge
EOF

# Create nginx configuration
mkdir -p nginx/conf.d

cat > nginx/nginx.conf << 'EOF'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 20M;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    include /etc/nginx/conf.d/*.conf;
}
EOF

cat > nginx/conf.d/chatbot.conf << 'EOF'
server {
    listen 80;
    server_name chatbot.kapgate.com;
    
    # Logging
    access_log /var/log/nginx/chatbot.access.log;
    error_log /var/log/nginx/chatbot.error.log;

    # Security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Proxy settings
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    proxy_read_timeout 86400;

    # Main application
    location / {
        proxy_pass http://chatbot:3000;
    }

    # API routes
    location /api/ {
        proxy_pass http://chatbot:3000;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Host $host;
    }

    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://chatbot:3000;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Health check
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

# Create environment file
cat > .env << EOF
NODE_ENV=production
N8N_WEBHOOK_URL=https://n8n.srv963093.hstgr.cloud/webhook/5f1c0c82-0ff9-40c7-9e2e-b1a96ffe24cd/chat
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX_REQUESTS=10
PORT=3000
DOMAIN=$DOMAIN
EMAIL=$EMAIL
EOF

# Deploy application
log_info "Building and deploying application..."
docker compose down --remove-orphans 2>/dev/null || true
docker compose up -d --build

# Wait for services
log_info "Waiting for services to start..."
sleep 30

# Verify deployment
log_info "Verifying deployment..."
if docker compose ps | grep -q "Up"; then
    log_success "✅ Containers are running"
else
    log_error "❌ Some containers failed to start"
    docker compose logs
    exit 1
fi

# Test health endpoint
if curl -f -s http://localhost:8080/health > /dev/null; then
    log_success "✅ Health check passed"
else
    log_warning "⚠️  Health check failed, but continuing..."
fi

# Create management script
cat > /usr/local/bin/chatbot << 'EOF'
#!/bin/bash
PROJECT_DIR="/opt/nextjs-chatbot"
cd $PROJECT_DIR

case "$1" in
    status)
        echo "=== Container Status ==="
        docker compose ps
        echo "=== Resource Usage ==="
        docker stats --no-stream
        ;;
    logs)
        docker compose logs --tail=50
        ;;
    restart)
        docker compose restart
        echo "Services restarted"
        ;;
    update)
        git pull origin main
        docker compose up -d --build
        echo "Application updated"
        ;;
    stop)
        docker compose down
        echo "Services stopped"
        ;;
    start)
        docker compose up -d
        echo "Services started"
        ;;
    health)
        if curl -f -s http://localhost:8080/health > /dev/null; then
            echo "✅ Application is healthy"
        else
            echo "❌ Application health check failed"
        fi
        ;;
    *)
        echo "Usage: chatbot {status|logs|restart|update|stop|start|health}"
        ;;
esac
EOF

chmod +x /usr/local/bin/chatbot

# Final status
log_success "🎉 Deployment completed successfully!"
echo ""
echo "==================== DEPLOYMENT STATUS ===================="
echo "Domain: $DOMAIN"
echo "HTTP Port: 8080"
echo "HTTPS Port: 8443 (if SSL configured)"
echo "Project Directory: $PROJECT_DIR"
echo ""
echo "Services Status:"
docker compose ps
echo ""
echo "==================== ACCESS INFORMATION ===================="
echo "🌐 Website: http://$DOMAIN:8080"
echo "🌐 Direct IP: http://$VPS_IP:8080"
echo "📊 Health: http://$DOMAIN:8080/health"
echo ""
echo "==================== MANAGEMENT COMMANDS ===================="
echo "chatbot status    # Show service status"
echo "chatbot logs      # Show logs"
echo "chatbot restart   # Restart services"
echo "chatbot update    # Update application"
echo "chatbot health    # Check health"
echo "====================================================="
echo ""
log_info "Your chatbot is now running on port 8080!"
log_info "Access it at: http://$DOMAIN:8080 or http://$VPS_IP:8080"