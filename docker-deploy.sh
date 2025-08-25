#!/bin/bash

# =============================================================================
# Docker-based Automated Deployment Script for Next.js Chatbot
# =============================================================================
# This script handles complete deployment of the chatbot to chatbot.kapgate.com
# Usage: ./docker-deploy.sh
# =============================================================================

set -e  # Exit on any error

# Configuration
DOMAIN="chatbot.kapgate.com"
EMAIL="admin@kapgate.com"
VPS_IP="72.60.40.39"
REPO_URL="https://github.com/pkapgatelive/SINU-AI_CourseHandbook-ChatBot.git"
PROJECT_DIR="/opt/nextjs-chatbot"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (use sudo)."
        exit 1
    fi
}

# Function to install Docker and Docker Compose
install_docker() {
    log_info "Installing Docker and Docker Compose..."
    
    # Update package index
    apt-get update
    
    # Install prerequisites
    apt-get install -y \
        ca-certificates \
        curl \
        gnupg \
        lsb-release
    
    # Add Docker's official GPG key
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    
    # Set up the repository
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
        $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker Engine
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Start and enable Docker
    systemctl start docker
    systemctl enable docker
    
    # Add current user to docker group
    usermod -aG docker $USER
    
    log_success "Docker and Docker Compose installed successfully."
}

# Function to check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_warning "Docker not found. Installing Docker..."
        install_docker
    else
        log_info "Docker is already installed."
    fi
    
    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose plugin not found. Please install Docker Compose."
        exit 1
    fi
}

# Function to setup firewall
setup_firewall() {
    log_info "Configuring firewall..."
    
    # Install ufw if not present
    apt-get install -y ufw
    
    # Reset UFW to defaults
    ufw --force reset
    
    # Set default policies
    ufw default deny incoming
    ufw default allow outgoing
    
    # Allow SSH, HTTP, and HTTPS
    ufw allow ssh
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    # Enable firewall
    ufw --force enable
    
    log_success "Firewall configured."
}

# Function to setup project directory
setup_project_directory() {
    log_info "Setting up project directory..."
    
    # Create project directory
    mkdir -p $PROJECT_DIR
    cd $PROJECT_DIR
    
    # Clone or update repository
    if [[ -d ".git" ]]; then
        log_info "Repository exists. Pulling latest changes..."
        git fetch origin
        git reset --hard origin/main
        git clean -fd
    else
        log_info "Cloning repository..."
        git clone $REPO_URL .
    fi
    
    log_success "Project directory setup completed."
}

# Function to create environment file
create_environment_file() {
    log_info "Creating environment configuration..."
    
    cat > .env << EOF
# Production Environment Variables
NODE_ENV=production
N8N_WEBHOOK_URL=https://n8n.srv963093.hstgr.cloud/webhook/5f1c0c82-0ff9-40c7-9e2e-b1a96ffe24cd/chat
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX_REQUESTS=10
PORT=3000

# Domain Configuration
DOMAIN=$DOMAIN
EMAIL=$EMAIL
EOF
    
    log_success "Environment file created."
}

# Function to setup SSL directories
setup_ssl_directories() {
    log_info "Setting up SSL directories..."
    
    mkdir -p ssl ssl-challenge
    chmod 755 ssl ssl-challenge
    
    log_success "SSL directories created."
}

# Function to check DNS resolution
check_dns() {
    log_info "Checking DNS resolution for $DOMAIN..."
    
    if nslookup $DOMAIN | grep -q $VPS_IP; then
        log_success "DNS is correctly configured."
        return 0
    else
        log_warning "DNS may not be configured correctly."
        log_warning "Please ensure $DOMAIN points to $VPS_IP"
        log_info "Continuing with deployment..."
        return 1
    fi
}

# Function to obtain SSL certificate
obtain_ssl_certificate() {
    log_info "Obtaining SSL certificate..."
    
    # Start nginx temporarily for certificate validation
    docker compose up -d nginx
    sleep 10
    
    # Obtain certificate
    docker compose run --rm certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email $EMAIL \
        --agree-tos \
        --no-eff-email \
        -d $DOMAIN
    
    if [[ $? -eq 0 ]]; then
        log_success "SSL certificate obtained successfully."
    else
        log_error "Failed to obtain SSL certificate. Continuing without SSL..."
        # Create a fallback nginx config without SSL
        create_fallback_nginx_config
    fi
}

# Function to create fallback nginx config (HTTP only)
create_fallback_nginx_config() {
    log_warning "Creating fallback HTTP-only configuration..."
    
    cat > nginx/conf.d/chatbot.conf << 'EOF'
server {
    listen 80;
    server_name chatbot.kapgate.com;
    
    # Logging
    access_log /var/log/nginx/chatbot.access.log;
    error_log /var/log/nginx/chatbot.error.log;

    # Proxy settings
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;

    # Main application
    location / {
        proxy_pass http://chatbot:3000;
    }

    # Health check
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF
}

# Function to deploy application
deploy_application() {
    log_info "Deploying application..."
    
    # Stop existing containers
    docker compose down --remove-orphans
    
    # Build and start services
    docker compose up -d --build
    
    # Wait for services to be ready
    log_info "Waiting for services to start..."
    sleep 30
    
    # Check if services are running
    if docker compose ps | grep -q "Up"; then
        log_success "Application deployed successfully."
    else
        log_error "Some services failed to start. Checking logs..."
        docker compose logs
        exit 1
    fi
}

# Function to verify deployment
verify_deployment() {
    log_info "Verifying deployment..."
    
    # Check if containers are running
    if ! docker compose ps | grep -q "Up"; then
        log_error "Containers are not running properly."
        return 1
    fi
    
    # Test HTTP connection
    if curl -f -s http://localhost/health > /dev/null; then
        log_success "HTTP health check passed."
    else
        log_warning "HTTP health check failed."
    fi
    
    # Test HTTPS connection if SSL is configured
    if [[ -f "ssl/live/$DOMAIN/fullchain.pem" ]]; then
        if curl -f -s https://$DOMAIN/health > /dev/null; then
            log_success "HTTPS health check passed."
        else
            log_warning "HTTPS health check failed."
        fi
    fi
    
    log_success "Deployment verification completed."
}

# Function to setup monitoring
setup_monitoring() {
    log_info "Setting up monitoring..."
    
    # Create monitoring script
    cat > /usr/local/bin/chatbot-monitor.sh << 'EOF'
#!/bin/bash
cd /opt/nextjs-chatbot
if ! docker compose ps | grep -q "Up"; then
    echo "$(date): Restarting chatbot services" >> /var/log/chatbot-monitor.log
    docker compose up -d
fi
EOF
    
    chmod +x /usr/local/bin/chatbot-monitor.sh
    
    # Add cron job for monitoring
    (crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/chatbot-monitor.sh") | crontab -
    
    log_success "Monitoring setup completed."
}

# Function to show final status
show_final_status() {
    log_success "Deployment completed successfully!"
    echo ""
    echo "==================== DEPLOYMENT STATUS ===================="
    echo "Domain: $DOMAIN"
    echo "Project Directory: $PROJECT_DIR"
    echo "SSL Certificate: $([ -f "ssl/live/$DOMAIN/fullchain.pem" ] && echo "✅ Configured" || echo "❌ Not configured")"
    echo ""
    echo "Services Status:"
    docker compose ps
    echo ""
    echo "==================== ACCESS INFORMATION ===================="
    echo "🌐 Website: http://$DOMAIN"
    if [[ -f "ssl/live/$DOMAIN/fullchain.pem" ]]; then
        echo "🔒 Secure: https://$DOMAIN"
    fi
    echo "📊 Health: http://$DOMAIN/health"
    echo ""
    echo "==================== MANAGEMENT COMMANDS ===================="
    echo "View logs: cd $PROJECT_DIR && docker compose logs -f"
    echo "Restart: cd $PROJECT_DIR && docker compose restart"
    echo "Update: cd $PROJECT_DIR && git pull && docker compose up -d --build"
    echo "Stop: cd $PROJECT_DIR && docker compose down"
    echo "====================================================="
}

# Main deployment function
main() {
    log_info "Starting automated Docker deployment for $DOMAIN..."
    
    # Run deployment steps
    check_root
    check_docker
    setup_firewall
    setup_project_directory
    create_environment_file
    setup_ssl_directories
    check_dns
    obtain_ssl_certificate
    deploy_application
    verify_deployment
    setup_monitoring
    show_final_status
}

# Handle script interruption
trap 'log_error "Deployment interrupted. Check logs and try again."; exit 1' INT TERM

# Run main function
main "$@"