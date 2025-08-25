# Complete Deployment Guide: Next.js Chatbot to Hostinger VPS

This comprehensive guide provides everything you need to deploy your Next.js chatbot project from GitHub to your Hostinger VPS with Ubuntu, including both static export and SSR deployment options.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Detailed Setup](#detailed-setup)
5. [Deployment Options](#deployment-options)
6. [Auto-Deployment Setup](#auto-deployment-setup)
7. [Security & SSL](#security--ssl)
8. [Monitoring & Maintenance](#monitoring--maintenance)
9. [Troubleshooting](#troubleshooting)
10. [File Reference](#file-reference)

## Overview

This deployment solution provides:

✅ **Dual deployment modes**: Static export and SSR (Server-Side Rendering)  
✅ **Automated deployments**: GitHub Actions and webhook-based  
✅ **SSL/HTTPS support**: Automatic Let's Encrypt certificates  
✅ **Production-ready**: PM2 process management, Nginx reverse proxy  
✅ **Security hardened**: Firewall, fail2ban, optimized configurations  
✅ **Monitoring**: Comprehensive logging and health checks  

## Prerequisites

### Local Requirements
- Git installed and configured
- SSH key pair generated
- GitHub repository with your Next.js chatbot project

### VPS Requirements
- Ubuntu 20.04+ VPS (Hostinger or any provider)
- Root/sudo access
- At least 1GB RAM, 1 CPU core, 10GB storage
- Public IP address

### Domain Requirements
- Domain name (new or existing)
- Access to DNS management

## Quick Start

### 1. Initial Server Setup

```bash
# 1. Connect to your VPS
ssh root@your-vps-ip

# 2. Download and run server setup
wget https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/server-setup.sh
chmod +x server-setup.sh
sudo ./server-setup.sh chatbot.yourdomain.com admin@yourdomain.com

# 3. Add your SSH key (replace with your actual public key)
echo "ssh-rsa AAAAB3NzaC1yc2E... your-email@example.com" >> /home/deploy/.ssh/authorized_keys
```

### 2. Domain Configuration

```bash
# Point your domain to your VPS IP
# Create A record: chatbot.yourdomain.com -> YOUR_VPS_IP
# Wait for DNS propagation (5-30 minutes)

# Verify DNS resolution
dig chatbot.yourdomain.com A
```

### 3. SSL Setup

```bash
# Switch to deploy user and setup SSL
su - deploy
sudo ./ssl-setup.sh chatbot.yourdomain.com admin@yourdomain.com ssr
```

### 4. Deploy Application

```bash
# Clone and deploy your application
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git nextjs-chat-app
cd nextjs-chat-app
./deploy.sh ssr chatbot.yourdomain.com
```

### 5. Verify Deployment

```bash
# Check if your chatbot is live
curl -I https://chatbot.yourdomain.com
```

🎉 **Your chatbot should now be live at `https://chatbot.yourdomain.com`!**

## Detailed Setup

### Step 1: Server Preparation

#### 1.1 Connect to Your VPS

```bash
# Connect via SSH (replace with your VPS IP)
ssh root@your-vps-ip
```

#### 1.2 Run Server Setup Script

The [`server-setup.sh`](server-setup.sh) script automates the entire server preparation:

```bash
# Make script executable and run
chmod +x server-setup.sh
sudo ./server-setup.sh chatbot.yourdomain.com admin@yourdomain.com
```

**What this script does:**
- Updates system packages
- Installs Node.js 18, PM2, Nginx
- Creates deploy user with sudo access
- Configures firewall (UFW) and fail2ban
- Sets up logging and system optimizations
- Prepares directory structure

#### 1.3 Configure SSH Access

```bash
# Add your SSH public key for secure access
echo "your-ssh-public-key-here" >> /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys

# Test SSH connection as deploy user
ssh deploy@your-vps-ip
```

### Step 2: Domain Setup

Follow the detailed [Domain Setup Guide](DOMAIN_SETUP_GUIDE.md) to:

1. **Configure DNS Records**:
   ```
   Type: A
   Name: chatbot
   Value: YOUR_VPS_IP
   TTL: 300
   ```

2. **Verify DNS Propagation**:
   ```bash
   dig chatbot.yourdomain.com A
   nslookup chatbot.yourdomain.com
   ```

3. **Test Domain Resolution**:
   ```bash
   ping chatbot.yourdomain.com
   ```

### Step 3: SSL Certificate Setup

#### 3.1 Run SSL Setup Script

```bash
# As deploy user, run SSL setup
sudo ./ssl-setup.sh chatbot.yourdomain.com admin@yourdomain.com ssr
```

**What this script does:**
- Installs Certbot via snap
- Obtains Let's Encrypt SSL certificate
- Configures Nginx with SSL
- Sets up automatic certificate renewal
- Verifies SSL configuration

#### 3.2 Verify SSL Certificate

```bash
# Test HTTPS connection
curl -I https://chatbot.yourdomain.com

# Check certificate details
openssl s_client -connect chatbot.yourdomain.com:443 -servername chatbot.yourdomain.com
```

### Step 4: Application Deployment

#### 4.1 Clone Repository

```bash
# Clone your repository
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git nextjs-chat-app
cd nextjs-chat-app
```

#### 4.2 Configure Environment

```bash
# Create .env file with your settings
cat > .env << 'EOF'
N8N_WEBHOOK_URL=https://n8n.srv963093.hstgr.cloud/webhook/5f1c0c82-0ff9-40c7-9e2e-b1a96ffe24cd/chat
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX_REQUESTS=10
NODE_ENV=production
PORT=3000
EOF
```

#### 4.3 Deploy Application

```bash
# Make deploy script executable
chmod +x deploy.sh

# Deploy in SSR mode
./deploy.sh ssr chatbot.yourdomain.com

# Or deploy in static mode
./deploy.sh static chatbot.yourdomain.com
```

## Deployment Options

### SSR (Server-Side Rendering) Mode

**Best for**: Dynamic content, API routes, real-time features

**Deployment**:
```bash
./deploy.sh ssr chatbot.yourdomain.com
```

**Features**:
- Full Next.js functionality
- API routes work natively
- Server-side rendering
- Runs on PM2 (port 3000)
- Nginx reverse proxy

**Architecture**:
```
Internet → Nginx (443/80) → Next.js App (3000) → n8n Webhook
```

### Static Export Mode

**Best for**: Static sites, better performance, CDN-friendly

**Deployment**:
```bash
./deploy.sh static chatbot.yourdomain.com
```

**Features**:
- Pre-built static files
- Served directly by Nginx
- Better performance
- API calls proxied to n8n

**Architecture**:
```
Internet → Nginx (443/80) → Static Files + API Proxy → n8n Webhook
```

### Choosing the Right Mode

| Feature | SSR Mode | Static Mode |
|---------|----------|-------------|
| Performance | Good | Excellent |
| API Routes | ✅ Native | ❌ Proxied only |
| Build Time | Fast | Slower |
| Server Resources | Higher | Lower |
| Scalability | Good | Excellent |
| Complexity | Higher | Lower |

## Auto-Deployment Setup

### Option 1: GitHub Actions (Recommended)

#### 1.1 Setup Repository Secrets

In your GitHub repository, go to Settings → Secrets and variables → Actions, and add:

```
VPS_HOST=your-vps-ip
VPS_USER=deploy
VPS_SSH_KEY=your-private-ssh-key
DOMAIN=chatbot.yourdomain.com
```

#### 1.2 Configure Workflow

The [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) file is already configured. It will:

- Trigger on pushes to `main` branch
- Build and test the application
- Deploy to your VPS
- Verify deployment
- Support both SSR and static modes

#### 1.3 Manual Deployment Trigger

You can also trigger deployments manually:

1. Go to Actions tab in GitHub
2. Select "Deploy Next.js Chatbot to VPS"
3. Click "Run workflow"
4. Choose deployment mode (SSR/static)

### Option 2: Webhook-Based Deployment

#### 2.1 Start Webhook Server

```bash
# Start webhook deployment server
pm2 start ecosystem.config.js --only webhook-deploy
pm2 save
```

#### 2.2 Configure GitHub Webhook

1. Go to your GitHub repository
2. Settings → Webhooks → Add webhook
3. **Payload URL**: `http://your-vps-ip:3001/webhook`
4. **Content type**: `application/json`
5. **Secret**: Set a secure secret
6. **Events**: Just the push event

#### 2.3 Set Environment Variables

```bash
# Set webhook secret
export WEBHOOK_SECRET="your-webhook-secret"
export DEPLOY_MODE="ssr"
export DOMAIN="chatbot.yourdomain.com"

# Restart webhook server
pm2 restart webhook-deploy
```

## Security & SSL

### SSL Certificate Management

#### Automatic Renewal

Certificates automatically renew via cron job:
```bash
# Check renewal status
sudo certbot renew --dry-run

# View cron job
cat /etc/cron.d/certbot-renewal
```

#### Manual Renewal

```bash
# Renew certificates manually
sudo certbot renew
sudo systemctl reload nginx
```

### Security Features

#### Firewall Configuration

```bash
# Check firewall status
sudo ufw status

# Allow specific ports
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw allow 3001/tcp # Webhook (optional)
```

#### Fail2ban Protection

```bash
# Check fail2ban status
sudo fail2ban-client status

# View banned IPs
sudo fail2ban-client status sshd
sudo fail2ban-client status nginx-http-auth
```

#### Security Headers

Both Nginx configurations include security headers:
- X-Frame-Options
- X-XSS-Protection
- X-Content-Type-Options
- Strict-Transport-Security
- Content-Security-Policy

## Monitoring & Maintenance

### Application Monitoring

#### PM2 Process Management

```bash
# View running processes
pm2 list

# View logs
pm2 logs chatbot
pm2 logs webhook-deploy

# Restart applications
pm2 restart chatbot
pm2 restart webhook-deploy

# Monitor resources
pm2 monit
```

#### Log Files

```bash
# Application logs
tail -f /var/log/pm2/chatbot-combined.log
tail -f /var/log/pm2/webhook-deploy-combined.log

# Nginx logs
tail -f /var/log/nginx/chatbot-ssr.access.log
tail -f /var/log/nginx/chatbot-ssr.error.log

# System logs
journalctl -u nginx -f
journalctl -u pm2-deploy -f
```

### Health Checks

#### Application Health

```bash
# Check application status
curl -I https://chatbot.yourdomain.com

# Check webhook server
curl http://localhost:3001/health

# Test API endpoint
curl -X POST https://chatbot.yourdomain.com/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello","sessionId":"test"}'
```

#### System Health

```bash
# Check system resources
htop
df -h
free -h

# Check service status
systemctl status nginx
systemctl status pm2-deploy
systemctl status fail2ban
```

### Backup & Recovery

#### Database Backup (if applicable)

```bash
# Backup application data
tar -czf chatbot-backup-$(date +%Y%m%d).tar.gz /home/deploy/nextjs-chat-app

# Backup logs
tar -czf logs-backup-$(date +%Y%m%d).tar.gz /var/log/pm2 /var/log/nginx
```

#### Configuration Backup

```bash
# Backup Nginx configuration
cp /etc/nginx/sites-available/chatbot /home/deploy/nginx-backup.conf

# Backup PM2 configuration
pm2 save
cp /home/deploy/.pm2/dump.pm2 /home/deploy/pm2-backup.json
```

## Troubleshooting

### Common Issues

#### 1. Domain Not Resolving

**Symptoms**: `curl: (6) Could not resolve host`

**Solutions**:
```bash
# Check DNS configuration
dig chatbot.yourdomain.com A
nslookup chatbot.yourdomain.com

# Wait for DNS propagation (up to 48 hours)
# Verify A record points to correct IP
```

#### 2. SSL Certificate Issues

**Symptoms**: SSL/TLS errors, certificate warnings

**Solutions**:
```bash
# Check certificate status
sudo certbot certificates

# Renew certificate
sudo certbot renew --force-renewal

# Verify Nginx configuration
sudo nginx -t
sudo systemctl reload nginx
```

#### 3. Application Not Starting

**Symptoms**: PM2 shows app as errored or stopped

**Solutions**:
```bash
# Check PM2 logs
pm2 logs chatbot

# Restart application
pm2 restart chatbot

# Check environment variables
pm2 env 0

# Verify Node.js version
node --version
npm --version
```

#### 4. Nginx 502 Bad Gateway

**Symptoms**: Nginx returns 502 error

**Solutions**:
```bash
# Check if application is running
pm2 list

# Check Nginx error logs
tail -f /var/log/nginx/error.log

# Verify upstream configuration
sudo nginx -t

# Restart services
pm2 restart chatbot
sudo systemctl reload nginx
```

#### 5. Webhook Not Working

**Symptoms**: GitHub pushes don't trigger deployments

**Solutions**:
```bash
# Check webhook server status
pm2 logs webhook-deploy
curl http://localhost:3001/health

# Verify GitHub webhook configuration
# Check webhook secret matches
# Ensure webhook URL is accessible

# Test webhook manually
curl -X POST http://your-vps-ip:3001/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -d '{"ref":"refs/heads/main","repository":{"full_name":"test/repo"}}'
```

### Debug Commands

```bash
# Check all services
systemctl status nginx pm2-deploy fail2ban

# Check network connectivity
netstat -tlnp | grep :80
netstat -tlnp | grep :443
netstat -tlnp | grep :3000
netstat -tlnp | grep :3001

# Check disk space
df -h

# Check memory usage
free -h

# Check system load
uptime
```

### Getting Help

1. **Check logs first**: Most issues are logged in PM2 or Nginx logs
2. **Verify configuration**: Use `nginx -t` and `pm2 list`
3. **Test components individually**: Test domain, SSL, application separately
4. **Check GitHub Issues**: Look for similar problems in the repository
5. **Contact support**: Provide logs and error messages when asking for help

## File Reference

### Core Deployment Files

| File | Purpose | Usage |
|------|---------|-------|
| [`deploy.sh`](deploy.sh) | Main deployment script | `./deploy.sh [static\|ssr] [domain]` |
| [`server-setup.sh`](server-setup.sh) | Initial server setup | `sudo ./server-setup.sh [domain] [email]` |
| [`ssl-setup.sh`](ssl-setup.sh) | SSL certificate setup | `sudo ./ssl-setup.sh [domain] [email] [mode]` |

### Configuration Files

| File | Purpose | Location |
|------|---------|----------|
| [`nginx-static.conf`](nginx-static.conf) | Nginx config for static mode | `/etc/nginx/sites-available/chatbot` |
| [`nginx-ssr.conf`](nginx-ssr.conf) | Nginx config for SSR mode | `/etc/nginx/sites-available/chatbot` |
| [`ecosystem.config.js`](ecosystem.config.js) | PM2 configuration | Project root |

### Automation Files

| File | Purpose | Usage |
|------|---------|-------|
| [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) | GitHub Actions workflow | Automatic on push |
| [`webhook-deploy.js`](webhook-deploy.js) | Webhook deployment server | `pm2 start webhook-deploy.js` |

### Documentation

| File | Purpose |
|------|---------|
| [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) | This comprehensive guide |
| [`DOMAIN_SETUP_GUIDE.md`](DOMAIN_SETUP_GUIDE.md) | Domain configuration guide |

### Environment Files

```bash
# .env (create in project root)
N8N_WEBHOOK_URL=https://your-n8n-webhook-url
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX_REQUESTS=10
NODE_ENV=production
PORT=3000

# GitHub Secrets (set in repository settings)
VPS_HOST=your-vps-ip
VPS_USER=deploy
VPS_SSH_KEY=your-private-ssh-key
DOMAIN=chatbot.yourdomain.com
WEBHOOK_SECRET=your-webhook-secret
```

## Summary

This deployment solution provides a complete, production-ready setup for hosting your Next.js chatbot on any Ubuntu VPS. The automated scripts handle all the complexity while giving you full control over your deployment.

### Key Benefits

- ✅ **One-command deployment**: Simple scripts handle everything
- ✅ **Production-ready**: Optimized for performance and security
- ✅ **Auto-deployment**: GitHub integration for seamless updates
- ✅ **SSL/HTTPS**: Automatic certificate management
- ✅ **Monitoring**: Comprehensive logging and health checks
- ✅ **Flexible**: Support for both static and SSR modes

### Next Steps

1. **Customize**: Modify configurations for your specific needs
2. **Monitor**: Set up additional monitoring and alerting
3. **Scale**: Add load balancing or multiple instances as needed
4. **Backup**: Implement regular backup procedures
5. **Update**: Keep dependencies and certificates up to date

---

**Need help?** Check the troubleshooting section or create an issue in the repository with your logs and error messages.