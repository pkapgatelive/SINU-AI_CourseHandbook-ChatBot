#!/bin/bash

# =============================================================================
# Chatbot Management Script
# =============================================================================
# Simple management commands for the Docker-deployed chatbot
# Usage: ./manage.sh [command]
# =============================================================================

set -e

PROJECT_DIR="/opt/nextjs-chatbot"
DOMAIN="chatbot.kapgate.com"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Function to show usage
show_usage() {
    echo "Chatbot Management Script"
    echo "========================="
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  status    - Show service status"
    echo "  logs      - Show application logs"
    echo "  restart   - Restart all services"
    echo "  update    - Update and redeploy application"
    echo "  stop      - Stop all services"
    echo "  start     - Start all services"
    echo "  health    - Check application health"
    echo "  ssl       - Renew SSL certificate"
    echo "  backup    - Create backup of application"
    echo "  monitor   - Show real-time logs"
    echo ""
    echo "Examples:"
    echo "  $0 status"
    echo "  $0 logs"
    echo "  $0 restart"
}

# Function to check if in project directory
check_project_dir() {
    if [[ ! -d "$PROJECT_DIR" ]]; then
        log_error "Project directory not found: $PROJECT_DIR"
        log_info "Please run the deployment script first."
        exit 1
    fi
    cd "$PROJECT_DIR"
}

# Function to show status
show_status() {
    log_info "Checking service status..."
    echo ""
    docker compose ps
    echo ""
    log_info "System resources:"
    echo "CPU Usage: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)%"
    echo "Memory Usage: $(free | grep Mem | awk '{printf("%.1f%%", $3/$2 * 100.0)}')"
    echo "Disk Usage: $(df -h / | awk 'NR==2{printf "%s", $5}')"
}

# Function to show logs
show_logs() {
    log_info "Showing application logs (last 50 lines)..."
    docker compose logs --tail=50
}

# Function to restart services
restart_services() {
    log_info "Restarting all services..."
    docker compose restart
    sleep 10
    log_success "Services restarted successfully."
    show_status
}

# Function to update application
update_application() {
    log_info "Updating application..."
    
    # Pull latest code
    git fetch origin
    git reset --hard origin/main
    git clean -fd
    
    # Rebuild and restart
    docker compose down
    docker compose up -d --build
    
    log_success "Application updated successfully."
    show_status
}

# Function to stop services
stop_services() {
    log_info "Stopping all services..."
    docker compose down
    log_success "All services stopped."
}

# Function to start services
start_services() {
    log_info "Starting all services..."
    docker compose up -d
    sleep 10
    log_success "All services started."
    show_status
}

# Function to check health
check_health() {
    log_info "Checking application health..."
    
    # Check containers
    if docker compose ps | grep -q "Up"; then
        log_success "✅ Containers are running"
    else
        log_error "❌ Some containers are not running"
    fi
    
    # Check HTTP endpoint
    if curl -f -s http://localhost/health > /dev/null; then
        log_success "✅ HTTP health check passed"
    else
        log_error "❌ HTTP health check failed"
    fi
    
    # Check HTTPS endpoint
    if curl -f -s https://$DOMAIN/health > /dev/null 2>&1; then
        log_success "✅ HTTPS health check passed"
    else
        log_warning "⚠️  HTTPS health check failed (SSL may not be configured)"
    fi
    
    # Check disk space
    DISK_USAGE=$(df / | awk 'NR==2{print $5}' | cut -d'%' -f1)
    if [[ $DISK_USAGE -lt 80 ]]; then
        log_success "✅ Disk usage: ${DISK_USAGE}%"
    else
        log_warning "⚠️  High disk usage: ${DISK_USAGE}%"
    fi
}

# Function to renew SSL certificate
renew_ssl() {
    log_info "Renewing SSL certificate..."
    docker compose run --rm certbot renew
    docker compose restart nginx
    log_success "SSL certificate renewal completed."
}

# Function to create backup
create_backup() {
    log_info "Creating backup..."
    
    BACKUP_DIR="/opt/backups"
    BACKUP_FILE="chatbot-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
    
    mkdir -p "$BACKUP_DIR"
    
    tar -czf "$BACKUP_DIR/$BACKUP_FILE" \
        --exclude='node_modules' \
        --exclude='.git' \
        --exclude='ssl' \
        "$PROJECT_DIR"
    
    log_success "Backup created: $BACKUP_DIR/$BACKUP_FILE"
    
    # Keep only last 5 backups
    cd "$BACKUP_DIR"
    ls -t chatbot-backup-*.tar.gz | tail -n +6 | xargs -r rm
    
    log_info "Backup cleanup completed."
}

# Function to monitor logs
monitor_logs() {
    log_info "Monitoring real-time logs (Press Ctrl+C to exit)..."
    docker compose logs -f
}

# Main function
main() {
    if [[ $# -eq 0 ]]; then
        show_usage
        exit 1
    fi
    
    check_project_dir
    
    case "$1" in
        status)
            show_status
            ;;
        logs)
            show_logs
            ;;
        restart)
            restart_services
            ;;
        update)
            update_application
            ;;
        stop)
            stop_services
            ;;
        start)
            start_services
            ;;
        health)
            check_health
            ;;
        ssl)
            renew_ssl
            ;;
        backup)
            create_backup
            ;;
        monitor)
            monitor_logs
            ;;
        *)
            log_error "Unknown command: $1"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function
main "$@"