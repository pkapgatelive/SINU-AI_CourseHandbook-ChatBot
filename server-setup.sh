#!/bin/bash

# =============================================================================
# Ubuntu VPS Initial Setup Script for Next.js Chatbot Deployment
# =============================================================================
# This script prepares an Ubuntu VPS for hosting the Next.js chatbot
# It installs all necessary dependencies and configures the server
# Usage: sudo ./server-setup.sh [domain] [email]
# Example: sudo ./server-setup.sh chatbot.mydomain.com admin@mydomain.com
# =============================================================================

set -e  # Exit on any error

# Configuration
NODE_VERSION="18"
DEPLOY_USER="deploy"
PROJECT_NAME="nextjs-chat-app"

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

# Function to validate inputs
validate_inputs() {
    local domain="$1"
    local email="$2"
    
    if [[ -z "$domain" ]]; then
        log_error "Domain is required."
        show_usage
        exit 1
    fi
    
    if [[ -z "$email" ]]; then
        log_error "Email is required."
        show_usage
        exit 1
    fi
    
    # Validate domain format
    if [[ ! "$domain" =~ ^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$ ]]; then
        log_error "Invalid domain format: $domain"
        exit 1
    fi
    
    # Validate email format
    if [[ ! "$email" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
        log_error "Invalid email format: $email"
        exit 1
    fi
}

# Function to update system packages
update_system() {
    log_info "Updating system packages..."
    apt update && apt upgrade -y
    log_success "System packages updated."
}

# Function to install essential packages
install_essentials() {
    log_info "Installing essential packages..."
    apt install -y \
        curl \
        wget \
        git \
        unzip \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        gnupg \
        lsb-release \
        ufw \
        fail2ban \
        htop \
        nano \
        vim
    log_success "Essential packages installed."
}

# Function to install Node.js
install_nodejs() {
    log_info "Installing Node.js $NODE_VERSION..."
    
    # Install NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    
    # Install Node.js
    apt install -y nodejs
    
    # Verify installation
    local node_version=$(node --version)
    local npm_version=$(npm --version)
    
    log_success "Node.js installed: $node_version"
    log_success "npm installed: $npm_version"
}

# Function to install PM2
install_pm2() {
    log_info "Installing PM2..."
    npm install -g pm2
    
    # Setup PM2 startup script
    pm2 startup systemd -u $DEPLOY_USER --hp /home/$DEPLOY_USER
    
    log_success "PM2 installed and configured."
}

# Function to install Nginx
install_nginx() {
    log_info "Installing Nginx..."
    apt install -y nginx
    
    # Start and enable Nginx
    systemctl start nginx
    systemctl enable nginx
    
    # Remove default site
    rm -f /etc/nginx/sites-enabled/default
    
    log_success "Nginx installed and configured."
}

# Function to create deploy user
create_deploy_user() {
    log_info "Creating deploy user..."
    
    # Create user if it doesn't exist
    if ! id "$DEPLOY_USER" &>/dev/null; then
        useradd -m -s /bin/bash "$DEPLOY_USER"
        log_success "Deploy user '$DEPLOY_USER' created."
    else
        log_info "Deploy user '$DEPLOY_USER' already exists."
    fi
    
    # Add user to sudo group
    usermod -aG sudo "$DEPLOY_USER"
    
    # Create SSH directory
    mkdir -p /home/$DEPLOY_USER/.ssh
    chmod 700 /home/$DEPLOY_USER/.ssh
    chown $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh
    
    # Create project directory
    mkdir -p /home/$DEPLOY_USER/$PROJECT_NAME
    chown $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/$PROJECT_NAME
    
    log_success "Deploy user configured."
}

# Function to configure firewall
configure_firewall() {
    log_info "Configuring firewall..."
    
    # Reset UFW to defaults
    ufw --force reset
    
    # Set default policies
    ufw default deny incoming
    ufw default allow outgoing
    
    # Allow SSH (be careful with this!)
    ufw allow ssh
    
    # Allow HTTP and HTTPS
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    # Allow webhook port (optional, can be restricted to specific IPs)
    ufw allow 3001/tcp
    
    # Enable firewall
    ufw --force enable
    
    log_success "Firewall configured."
}

# Function to configure fail2ban
configure_fail2ban() {
    log_info "Configuring fail2ban..."
    
    # Create custom jail configuration
    cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
backend = systemd

[sshd]
enabled = true
port = ssh
logpath = %(sshd_log)s
backend = %(sshd_backend)s

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log

[nginx-noscript]
enabled = true
port = http,https
filter = nginx-noscript
logpath = /var/log/nginx/access.log
maxretry = 6

[nginx-badbots]
enabled = true
port = http,https
filter = nginx-badbots
logpath = /var/log/nginx/access.log
maxretry = 2

[nginx-noproxy]
enabled = true
port = http,https
filter = nginx-noproxy
logpath = /var/log/nginx/access.log
maxretry = 2
EOF
    
    # Restart fail2ban
    systemctl restart fail2ban
    systemctl enable fail2ban
    
    log_success "fail2ban configured."
}

# Function to create log directories
create_log_directories() {
    log_info "Creating log directories..."
    
    # Create PM2 log directory
    mkdir -p /var/log/pm2
    chown $DEPLOY_USER:$DEPLOY_USER /var/log/pm2
    
    # Create application log directory
    mkdir -p /var/log/chatbot
    chown $DEPLOY_USER:$DEPLOY_USER /var/log/chatbot
    
    # Create static files directory
    mkdir -p /var/www/chatbot-public
    chown www-data:www-data /var/www/chatbot-public
    
    log_success "Log directories created."
}

# Function to configure logrotate
configure_logrotate() {
    log_info "Configuring log rotation..."
    
    cat > /etc/logrotate.d/chatbot << 'EOF'
/var/log/pm2/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 deploy deploy
    postrotate
        pm2 reloadLogs
    endscript
}

/var/log/chatbot/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 deploy deploy
}

/var/log/nginx/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data adm
    postrotate
        systemctl reload nginx
    endscript
}
EOF
    
    log_success "Log rotation configured."
}

# Function to optimize system settings
optimize_system() {
    log_info "Optimizing system settings..."
    
    # Increase file descriptor limits
    cat >> /etc/security/limits.conf << 'EOF'
# Increase limits for web applications
* soft nofile 65536
* hard nofile 65536
deploy soft nofile 65536
deploy hard nofile 65536
EOF
    
    # Configure sysctl for better network performance
    cat >> /etc/sysctl.conf << 'EOF'
# Network optimizations for web server
net.core.somaxconn = 65536
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_max_syn_backlog = 65536
net.ipv4.tcp_keepalive_time = 600
net.ipv4.tcp_keepalive_intvl = 60
net.ipv4.tcp_keepalive_probes = 10
EOF
    
    # Apply sysctl settings
    sysctl -p
    
    log_success "System optimizations applied."
}

# Function to setup SSH key authentication
setup_ssh_keys() {
    log_info "Setting up SSH key authentication..."
    
    log_warning "Please add your SSH public key to /home/$DEPLOY_USER/.ssh/authorized_keys"
    log_warning "You can do this by running:"
    log_warning "echo 'your-public-key-here' >> /home/$DEPLOY_USER/.ssh/authorized_keys"
    log_warning "chmod 600 /home/$DEPLOY_USER/.ssh/authorized_keys"
    log_warning "chown $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh/authorized_keys"
    
    # Create placeholder authorized_keys file
    touch /home/$DEPLOY_USER/.ssh/authorized_keys
    chmod 600 /home/$DEPLOY_USER/.ssh/authorized_keys
    chown $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh/authorized_keys
    
    log_success "SSH key authentication prepared."
}

# Function to show final instructions
show_final_instructions() {
    local domain="$1"
    local email="$2"
    
    log_success "Server setup completed successfully!"
    echo ""
    echo "==================== NEXT STEPS ===================="
    echo ""
    echo "1. Add your SSH public key:"
    echo "   echo 'your-public-key-here' >> /home/$DEPLOY_USER/.ssh/authorized_keys"
    echo ""
    echo "2. Test SSH connection:"
    echo "   ssh $DEPLOY_USER@your-server-ip"
    echo ""
    echo "3. Point your domain to this server:"
    echo "   Create an A record: $domain -> $(curl -s ifconfig.me)"
    echo ""
    echo "4. Run SSL setup (as deploy user):"
    echo "   sudo ./ssl-setup.sh $domain $email ssr"
    echo ""
    echo "5. Deploy your application:"
    echo "   ./deploy.sh ssr $domain"
    echo ""
    echo "6. (Optional) Setup GitHub webhook:"
    echo "   - Start webhook server: pm2 start ecosystem.config.js --only webhook-deploy"
    echo "   - Add webhook URL: http://your-server-ip:3001/webhook"
    echo ""
    echo "==================== SERVER INFO ===================="
    echo "Deploy User: $DEPLOY_USER"
    echo "Project Directory: /home/$DEPLOY_USER/$PROJECT_NAME"
    echo "Static Files: /var/www/chatbot-public"
    echo "Logs: /var/log/pm2/ and /var/log/chatbot/"
    echo "Node.js Version: $(node --version)"
    echo "npm Version: $(npm --version)"
    echo "PM2 Status: $(pm2 --version)"
    echo "Nginx Status: $(systemctl is-active nginx)"
    echo "Firewall Status: $(ufw status | head -1)"
    echo "====================================================="
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [domain] [email]"
    echo ""
    echo "Arguments:"
    echo "  domain    Your domain name (required)"
    echo "  email     Your email address for SSL certificates (required)"
    echo ""
    echo "Examples:"
    echo "  $0 chatbot.mydomain.com admin@mydomain.com"
    echo ""
    echo "This script will:"
    echo "1. Update system packages"
    echo "2. Install Node.js, PM2, and Nginx"
    echo "3. Create deploy user and configure security"
    echo "4. Setup firewall and fail2ban"
    echo "5. Configure logging and system optimizations"
}

# Main function
main() {
    # Check arguments
    if [[ $# -lt 2 ]]; then
        show_usage
        exit 1
    fi
    
    local domain="$1"
    local email="$2"
    
    log_info "Starting Ubuntu VPS setup for Next.js chatbot deployment..."
    log_info "Domain: $domain"
    log_info "Email: $email"
    
    # Run setup steps
    check_root
    validate_inputs "$domain" "$email"
    update_system
    install_essentials
    install_nodejs
    install_pm2
    install_nginx
    create_deploy_user
    configure_firewall
    configure_fail2ban
    create_log_directories
    configure_logrotate
    optimize_system
    setup_ssh_keys
    show_final_instructions "$domain" "$email"
}

# Handle script interruption
trap 'log_error "Setup interrupted. Please check the logs and try again."; exit 1' INT TERM

# Run main function
main "$@"