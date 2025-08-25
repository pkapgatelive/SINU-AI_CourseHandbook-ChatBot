#!/bin/bash

# =============================================================================
# SSL Setup Script with Certbot for Next.js Chatbot
# =============================================================================
# This script sets up SSL certificates using Let's Encrypt Certbot
# Usage: ./ssl-setup.sh [domain] [email]
# Example: ./ssl-setup.sh chatbot.mydomain.com admin@mydomain.com
# =============================================================================

set -e  # Exit on any error

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

# Function to validate email format
validate_email() {
    local email="$1"
    if [[ ! "$email" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
        log_error "Invalid email format: $email"
        exit 1
    fi
}

# Function to validate domain format
validate_domain() {
    local domain="$1"
    if [[ ! "$domain" =~ ^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$ ]]; then
        log_error "Invalid domain format: $domain"
        exit 1
    fi
}

# Function to check if domain resolves to this server
check_domain_resolution() {
    local domain="$1"
    log_info "Checking if domain $domain resolves to this server..."
    
    # Get server's public IP
    local server_ip
    server_ip=$(curl -s ifconfig.me || curl -s ipinfo.io/ip || curl -s icanhazip.com)
    
    if [[ -z "$server_ip" ]]; then
        log_warning "Could not determine server's public IP. Skipping domain resolution check."
        return 0
    fi
    
    # Get domain's resolved IP
    local domain_ip
    domain_ip=$(dig +short "$domain" | tail -n1)
    
    if [[ -z "$domain_ip" ]]; then
        log_error "Domain $domain does not resolve to any IP address."
        log_info "Please ensure your domain's A record points to: $server_ip"
        exit 1
    fi
    
    if [[ "$server_ip" != "$domain_ip" ]]; then
        log_error "Domain $domain resolves to $domain_ip, but this server's IP is $server_ip"
        log_info "Please update your domain's A record to point to: $server_ip"
        exit 1
    fi
    
    log_success "Domain resolution check passed."
}

# Function to install Certbot
install_certbot() {
    log_info "Installing Certbot..."
    
    # Update package list
    apt update
    
    # Install snapd if not already installed
    if ! command -v snap &> /dev/null; then
        log_info "Installing snapd..."
        apt install -y snapd
        systemctl enable snapd
        systemctl start snapd
    fi
    
    # Install certbot via snap
    if ! command -v certbot &> /dev/null; then
        log_info "Installing Certbot via snap..."
        snap install core; snap refresh core
        snap install --classic certbot
        
        # Create symlink
        ln -sf /snap/bin/certbot /usr/bin/certbot
    else
        log_info "Certbot is already installed."
    fi
    
    log_success "Certbot installation completed."
}

# Function to setup nginx for initial certificate request
setup_initial_nginx() {
    local domain="$1"
    log_info "Setting up initial Nginx configuration for certificate request..."
    
    # Create a temporary nginx config for certificate validation
    cat > "/etc/nginx/sites-available/temp-$domain" << EOF
server {
    listen 80;
    listen [::]:80;
    server_name $domain www.$domain;
    
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    location / {
        return 200 'Server is ready for SSL setup';
        add_header Content-Type text/plain;
    }
}
EOF
    
    # Enable the temporary site
    ln -sf "/etc/nginx/sites-available/temp-$domain" "/etc/nginx/sites-enabled/temp-$domain"
    
    # Remove default nginx site if it exists
    if [[ -f "/etc/nginx/sites-enabled/default" ]]; then
        rm -f "/etc/nginx/sites-enabled/default"
    fi
    
    # Test and reload nginx
    nginx -t && systemctl reload nginx
    
    log_success "Initial Nginx configuration completed."
}

# Function to obtain SSL certificate
obtain_certificate() {
    local domain="$1"
    local email="$2"
    
    log_info "Obtaining SSL certificate for $domain..."
    
    # Create webroot directory
    mkdir -p /var/www/html
    
    # Obtain certificate
    certbot certonly \
        --webroot \
        --webroot-path=/var/www/html \
        --email "$email" \
        --agree-tos \
        --no-eff-email \
        --domains "$domain,www.$domain" \
        --non-interactive
    
    if [[ $? -eq 0 ]]; then
        log_success "SSL certificate obtained successfully for $domain"
    else
        log_error "Failed to obtain SSL certificate for $domain"
        exit 1
    fi
}

# Function to setup automatic renewal
setup_auto_renewal() {
    log_info "Setting up automatic certificate renewal..."
    
    # Create renewal script
    cat > /etc/cron.d/certbot-renewal << 'EOF'
# Renew Let's Encrypt certificates twice daily
0 */12 * * * root /usr/bin/certbot renew --quiet --post-hook "systemctl reload nginx"
EOF
    
    # Test renewal process
    log_info "Testing certificate renewal process..."
    certbot renew --dry-run
    
    if [[ $? -eq 0 ]]; then
        log_success "Certificate renewal test passed."
    else
        log_warning "Certificate renewal test failed. Please check the configuration."
    fi
    
    log_success "Automatic renewal setup completed."
}

# Function to cleanup temporary nginx config
cleanup_temp_nginx() {
    local domain="$1"
    log_info "Cleaning up temporary Nginx configuration..."
    
    # Remove temporary site
    if [[ -f "/etc/nginx/sites-enabled/temp-$domain" ]]; then
        rm -f "/etc/nginx/sites-enabled/temp-$domain"
    fi
    
    if [[ -f "/etc/nginx/sites-available/temp-$domain" ]]; then
        rm -f "/etc/nginx/sites-available/temp-$domain"
    fi
    
    log_success "Temporary configuration cleaned up."
}

# Function to setup final nginx configuration
setup_final_nginx() {
    local domain="$1"
    local mode="$2"
    
    log_info "Setting up final Nginx configuration for $mode mode..."
    
    # Determine which nginx config to use
    local config_file
    if [[ "$mode" == "static" ]]; then
        config_file="nginx-static.conf"
    else
        config_file="nginx-ssr.conf"
    fi
    
    # Check if config file exists
    if [[ ! -f "$config_file" ]]; then
        log_error "Nginx configuration file $config_file not found."
        log_info "Please ensure you have the nginx configuration files in the current directory."
        exit 1
    fi
    
    # Copy and modify the config file
    cp "$config_file" "/etc/nginx/sites-available/chatbot"
    
    # Replace domain placeholder with actual domain
    sed -i "s/chatbot\.mydomain\.com/$domain/g" "/etc/nginx/sites-available/chatbot"
    
    # Enable the site
    ln -sf "/etc/nginx/sites-available/chatbot" "/etc/nginx/sites-enabled/chatbot"
    
    # Test and reload nginx
    nginx -t && systemctl reload nginx
    
    log_success "Final Nginx configuration completed."
}

# Function to verify SSL setup
verify_ssl() {
    local domain="$1"
    log_info "Verifying SSL setup..."
    
    # Check certificate validity
    local cert_info
    cert_info=$(openssl x509 -in "/etc/letsencrypt/live/$domain/fullchain.pem" -text -noout | grep "Not After")
    
    if [[ -n "$cert_info" ]]; then
        log_success "SSL certificate is valid: $cert_info"
    else
        log_error "SSL certificate verification failed."
        exit 1
    fi
    
    # Test HTTPS connection
    log_info "Testing HTTPS connection..."
    if curl -s -I "https://$domain" | grep -q "HTTP/"; then
        log_success "HTTPS connection test passed."
    else
        log_warning "HTTPS connection test failed. Please check your configuration."
    fi
}

# Function to show SSL status
show_ssl_status() {
    local domain="$1"
    
    log_info "SSL Setup Status:"
    echo "===================="
    echo "Domain: $domain"
    echo "Certificate Location: /etc/letsencrypt/live/$domain/"
    echo "Nginx Status: $(systemctl is-active nginx)"
    
    # Show certificate expiry
    local expiry
    expiry=$(openssl x509 -in "/etc/letsencrypt/live/$domain/fullchain.pem" -noout -dates | grep "notAfter" | cut -d= -f2)
    echo "Certificate Expires: $expiry"
    
    # Show renewal status
    echo "Auto-renewal: Configured (runs twice daily)"
    
    echo "===================="
    log_success "SSL setup completed successfully!"
    log_info "Your site should now be accessible at: https://$domain"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [domain] [email] [mode]"
    echo ""
    echo "Arguments:"
    echo "  domain    Your domain name (required)"
    echo "  email     Your email address for Let's Encrypt (required)"
    echo "  mode      Deployment mode: static or ssr (optional, default: ssr)"
    echo ""
    echo "Examples:"
    echo "  $0 chatbot.mydomain.com admin@mydomain.com"
    echo "  $0 chatbot.mydomain.com admin@mydomain.com static"
    echo "  $0 chatbot.mydomain.com admin@mydomain.com ssr"
    echo ""
    echo "Prerequisites:"
    echo "1. Domain must point to this server's IP address"
    echo "2. Nginx must be installed"
    echo "3. Ports 80 and 443 must be open"
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
    local mode="${3:-ssr}"  # Default to SSR mode
    
    # Validate inputs
    validate_domain "$domain"
    validate_email "$email"
    
    if [[ "$mode" != "static" && "$mode" != "ssr" ]]; then
        log_error "Invalid mode. Use 'static' or 'ssr'."
        exit 1
    fi
    
    log_info "Starting SSL setup for domain: $domain (mode: $mode)"
    
    # Run setup steps
    check_root
    check_domain_resolution "$domain"
    install_certbot
    setup_initial_nginx "$domain"
    obtain_certificate "$domain" "$email"
    setup_auto_renewal
    cleanup_temp_nginx "$domain"
    setup_final_nginx "$domain" "$mode"
    verify_ssl "$domain"
    show_ssl_status "$domain"
}

# Handle script interruption
trap 'log_error "SSL setup interrupted. Please check the logs and try again."; exit 1' INT TERM

# Run main function
main "$@"