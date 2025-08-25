#!/bin/bash

# =============================================================================
# Next.js Chatbot Deployment Script
# =============================================================================
# This script handles deployment of the Next.js chatbot to Ubuntu VPS
# Supports both static export and SSR modes
# Usage: ./deploy.sh [static|ssr] [domain]
# Example: ./deploy.sh ssr chatbot.mydomain.com
# =============================================================================

set -e  # Exit on any error

# Configuration
REPO_URL="https://github.com/pkapgatelive/SINU-AI_CourseHandbook-ChatBot.git"
PROJECT_NAME="nextjs-chat-app"
DEPLOY_USER="deploy"
APP_DIR="/home/$DEPLOY_USER/$PROJECT_NAME"
STATIC_DIR="/var/www/chatbot-public"
NODE_VERSION="18"  # Adjust as needed
PM2_APP_NAME="chatbot"

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
    if [[ $EUID -eq 0 ]]; then
        log_error "This script should not be run as root for security reasons."
        log_info "Please run as the deploy user or create one first."
        exit 1
    fi
}

# Function to check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js $NODE_VERSION first."
        exit 1
    fi
    
    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed. Please install npm first."
        exit 1
    fi
    
    # Check if git is installed
    if ! command -v git &> /dev/null; then
        log_error "git is not installed. Please install git first."
        exit 1
    fi
    
    # Check if PM2 is installed (for SSR mode)
    if [[ "$DEPLOY_MODE" == "ssr" ]] && ! command -v pm2 &> /dev/null; then
        log_warning "PM2 is not installed. Installing PM2..."
        npm install -g pm2
    fi
    
    log_success "Prerequisites check completed."
}

# Function to setup environment variables
setup_environment() {
    log_info "Setting up environment variables..."
    
    # Create .env file if it doesn't exist
    if [[ ! -f "$APP_DIR/.env" ]]; then
        log_info "Creating .env file..."
        cat > "$APP_DIR/.env" << EOF
# Next.js Chat App Environment Variables
N8N_WEBHOOK_URL=https://n8n.srv963093.hstgr.cloud/webhook/5f1c0c82-0ff9-40c7-9e2e-b1a96ffe24cd/chat
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX_REQUESTS=10

# Production settings
NODE_ENV=production
PORT=3000

# Add your custom environment variables here
EOF
        log_warning "Please update the .env file with your actual values before running the app."
    else
        log_info ".env file already exists. Skipping creation."
    fi
}

# Function to clone or update repository
update_repository() {
    log_info "Updating repository..."
    
    if [[ -d "$APP_DIR" ]]; then
        log_info "Repository exists. Pulling latest changes..."
        cd "$APP_DIR"
        git fetch origin
        git reset --hard origin/main
        git clean -fd
    else
        log_info "Cloning repository..."
        git clone "$REPO_URL" "$APP_DIR"
        cd "$APP_DIR"
    fi
    
    log_success "Repository updated successfully."
}

# Function to install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    cd "$APP_DIR"
    
    # Clean install
    rm -rf node_modules package-lock.json
    npm install --production=false
    
    log_success "Dependencies installed successfully."
}

# Function to build application
build_application() {
    log_info "Building application for $DEPLOY_MODE mode..."
    cd "$APP_DIR"
    
    if [[ "$DEPLOY_MODE" == "static" ]]; then
        # Add static export configuration
        log_info "Configuring for static export..."
        
        # Create a temporary next.config.js for static export
        cp next.config.ts next.config.ts.backup
        cat > next.config.js << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  env: {
    NEXT_PUBLIC_CHAT_API_ENDPOINT: process.env.NEXT_PUBLIC_CHAT_API_ENDPOINT || '/api/chat',
    NEXT_PUBLIC_CHAT_TIMEOUT: process.env.NEXT_PUBLIC_CHAT_TIMEOUT || '30000',
    NEXT_PUBLIC_CHAT_MAX_RETRIES: process.env.NEXT_PUBLIC_CHAT_MAX_RETRIES || '3',
    NEXT_PUBLIC_CHAT_RETRY_DELAY: process.env.NEXT_PUBLIC_CHAT_RETRY_DELAY || '1000',
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Chat-Config-Injected',
            value: 'true',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
EOF
        
        npm run build
        
        # Restore original config
        mv next.config.ts.backup next.config.ts
        rm next.config.js
        
    else
        # SSR build
        npm run build
    fi
    
    log_success "Application built successfully."
}

# Function to deploy static files
deploy_static() {
    log_info "Deploying static files..."
    cd "$APP_DIR"
    
    # Create static directory if it doesn't exist
    sudo mkdir -p "$STATIC_DIR"
    
    # Copy built files to static directory
    sudo rm -rf "$STATIC_DIR"/*
    sudo cp -r out/* "$STATIC_DIR"/
    
    # Set proper permissions
    sudo chown -R www-data:www-data "$STATIC_DIR"
    sudo chmod -R 755 "$STATIC_DIR"
    
    log_success "Static files deployed to $STATIC_DIR"
}

# Function to deploy SSR application
deploy_ssr() {
    log_info "Deploying SSR application..."
    cd "$APP_DIR"
    
    # Stop existing PM2 process if running
    if pm2 list | grep -q "$PM2_APP_NAME"; then
        log_info "Stopping existing PM2 process..."
        pm2 stop "$PM2_APP_NAME"
        pm2 delete "$PM2_APP_NAME"
    fi
    
    # Start application with PM2
    log_info "Starting application with PM2..."
    pm2 start npm --name "$PM2_APP_NAME" -- start
    pm2 save
    
    # Enable PM2 startup
    pm2 startup
    
    log_success "SSR application deployed and running on port 3000"
}

# Function to restart nginx
restart_nginx() {
    log_info "Testing and restarting Nginx..."
    
    if sudo nginx -t; then
        sudo systemctl reload nginx
        log_success "Nginx reloaded successfully."
    else
        log_error "Nginx configuration test failed. Please check the configuration."
        exit 1
    fi
}

# Function to show deployment status
show_status() {
    log_info "Deployment Status:"
    echo "===================="
    echo "Mode: $DEPLOY_MODE"
    echo "Domain: $DOMAIN"
    echo "App Directory: $APP_DIR"
    
    if [[ "$DEPLOY_MODE" == "static" ]]; then
        echo "Static Files: $STATIC_DIR"
        echo "Nginx Status: $(sudo systemctl is-active nginx)"
    else
        echo "PM2 Status:"
        pm2 list
        echo "Port: 3000"
        echo "Nginx Status: $(sudo systemctl is-active nginx)"
    fi
    
    echo "===================="
    log_success "Deployment completed successfully!"
    log_info "Your chatbot should be accessible at: https://$DOMAIN"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [static|ssr] [domain]"
    echo ""
    echo "Arguments:"
    echo "  static|ssr    Deployment mode (required)"
    echo "  domain        Your domain name (required)"
    echo ""
    echo "Examples:"
    echo "  $0 static chatbot.mydomain.com"
    echo "  $0 ssr chatbot.mydomain.com"
    echo ""
    echo "Before running this script:"
    echo "1. Update REPO_URL variable in this script"
    echo "2. Ensure your domain points to this server"
    echo "3. Run the initial server setup script first"
}

# Main deployment function
main() {
    # Check arguments
    if [[ $# -lt 2 ]]; then
        show_usage
        exit 1
    fi
    
    DEPLOY_MODE="$1"
    DOMAIN="$2"
    
    # Validate deployment mode
    if [[ "$DEPLOY_MODE" != "static" && "$DEPLOY_MODE" != "ssr" ]]; then
        log_error "Invalid deployment mode. Use 'static' or 'ssr'."
        show_usage
        exit 1
    fi
    
    # Validate domain
    if [[ ! "$DOMAIN" =~ ^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$ ]]; then
        log_error "Invalid domain format."
        exit 1
    fi
    
    log_info "Starting deployment in $DEPLOY_MODE mode for domain: $DOMAIN"
    
    # Run deployment steps
    check_root
    check_prerequisites
    update_repository
    setup_environment
    install_dependencies
    build_application
    
    if [[ "$DEPLOY_MODE" == "static" ]]; then
        deploy_static
    else
        deploy_ssr
    fi
    
    restart_nginx
    show_status
}

# Handle script interruption
trap 'log_error "Deployment interrupted. Please check the logs and try again."; exit 1' INT TERM

# Run main function
main "$@"