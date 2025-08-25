# Docker-Based Deployment Guide for Next.js Chatbot

This guide provides a complete Docker-based deployment solution for your Next.js chatbot to `chatbot.kapgate.com` on your VPS at `72.60.40.39`.

## 🚀 Quick Deployment (3 Simple Steps)

### Step 1: Configure DNS
In your domain registrar's DNS settings, add:
```
Type: A
Name: chatbot
Value: 72.60.40.39
TTL: 300 (or lowest available)
```

### Step 2: Connect to Your VPS and Run Deployment
```bash
# Connect to your VPS
ssh root@72.60.40.39
# Password: )oN.-y0h8kmnKWUbDa5K

# Download and run the automated deployment script
curl -fsSL https://raw.githubusercontent.com/pkapgatelive/SINU-AI_CourseHandbook-ChatBot/main/docker-deploy.sh -o docker-deploy.sh
chmod +x docker-deploy.sh
sudo ./docker-deploy.sh
```

### Step 3: Access Your Chatbot
🎉 **Your chatbot will be live at: https://chatbot.kapgate.com**

## 📋 What the Deployment Script Does

The automated script handles everything:

✅ **Installs Docker & Docker Compose**  
✅ **Configures Firewall & Security**  
✅ **Clones Your Repository**  
✅ **Sets Up SSL Certificates**  
✅ **Builds & Deploys Application**  
✅ **Configures Nginx Reverse Proxy**  
✅ **Sets Up Monitoring & Health Checks**  

## 🏗️ Architecture Overview

```
Internet → Nginx (Port 80/443) → Next.js App (Port 3000) → n8n Webhook
```

**Components:**
- **Next.js App**: Your chatbot application running in Docker
- **Nginx**: Reverse proxy with SSL termination
- **Certbot**: Automatic SSL certificate management
- **Docker Compose**: Container orchestration

## 🛠️ Management Commands

After deployment, use the management script for easy maintenance:

```bash
# Download management script
curl -fsSL https://raw.githubusercontent.com/pkapgatelive/SINU-AI_CourseHandbook-ChatBot/main/manage.sh -o /usr/local/bin/chatbot
chmod +x /usr/local/bin/chatbot

# Available commands:
chatbot status    # Show service status
chatbot logs      # Show application logs
chatbot restart   # Restart all services
chatbot update    # Update and redeploy
chatbot health    # Check application health
chatbot ssl       # Renew SSL certificate
chatbot backup    # Create backup
chatbot monitor   # Real-time logs
```

## 📁 File Structure

```
/opt/nextjs-chatbot/
├── Dockerfile                 # Application container
├── docker-compose.yml         # Service orchestration
├── .env                      # Environment variables
├── nginx/
│   ├── nginx.conf            # Main Nginx config
│   └── conf.d/
│       └── chatbot.conf      # Site-specific config
├── ssl/                      # SSL certificates
└── ssl-challenge/            # Let's Encrypt challenges
```

## 🔧 Configuration Details

### Environment Variables
```env
NODE_ENV=production
N8N_WEBHOOK_URL=https://n8n.srv963093.hstgr.cloud/webhook/5f1c0c82-0ff9-40c7-9e2e-b1a96ffe24cd/chat
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX_REQUESTS=10
PORT=3000
DOMAIN=chatbot.kapgate.com
EMAIL=admin@kapgate.com
```

### Docker Services
- **chatbot**: Next.js application container
- **nginx**: Reverse proxy with SSL
- **certbot**: SSL certificate management

### Security Features
- **Firewall**: UFW configured for ports 22, 80, 443
- **SSL/TLS**: Let's Encrypt certificates with auto-renewal
- **Security Headers**: HSTS, CSP, XSS protection
- **Rate Limiting**: Built into the application

## 🔍 Monitoring & Logs

### Health Checks
```bash
# Application health
curl https://chatbot.kapgate.com/health

# Container status
docker compose ps

# Resource usage
docker stats
```

### Log Locations
```bash
# Application logs
docker compose logs chatbot

# Nginx logs
docker compose logs nginx

# System logs
journalctl -u docker
```

### Automated Monitoring
The deployment includes:
- **Health Check Endpoint**: `/health`
- **Automatic Restart**: Containers restart on failure
- **Cron Monitoring**: Checks every 5 minutes
- **Log Rotation**: Prevents disk space issues

## 🔄 Updates & Maintenance

### Updating Your Application
```bash
# Automatic update (recommended)
chatbot update

# Manual update
cd /opt/nextjs-chatbot
git pull origin main
docker compose up -d --build
```

### SSL Certificate Renewal
```bash
# Automatic renewal (runs via cron)
chatbot ssl

# Manual renewal
cd /opt/nextjs-chatbot
docker compose run --rm certbot renew
docker compose restart nginx
```

### Backup & Recovery
```bash
# Create backup
chatbot backup

# Backups are stored in /opt/backups/
# Restore from backup
cd /opt/nextjs-chatbot
tar -xzf /opt/backups/chatbot-backup-YYYYMMDD-HHMMSS.tar.gz
docker compose up -d --build
```

## 🐛 Troubleshooting

### Common Issues

#### 1. DNS Not Resolving
```bash
# Check DNS propagation
nslookup chatbot.kapgate.com
dig chatbot.kapgate.com A

# Wait up to 24 hours for full propagation
```

#### 2. SSL Certificate Issues
```bash
# Check certificate status
docker compose run --rm certbot certificates

# Force renewal
docker compose run --rm certbot renew --force-renewal
docker compose restart nginx
```

#### 3. Application Not Starting
```bash
# Check container logs
docker compose logs chatbot

# Check container status
docker compose ps

# Restart services
chatbot restart
```

#### 4. 502 Bad Gateway
```bash
# Check if app container is running
docker compose ps

# Check nginx logs
docker compose logs nginx

# Restart all services
chatbot restart
```

### Debug Commands
```bash
# Check all services
chatbot status

# View real-time logs
chatbot monitor

# Check system resources
htop
df -h
free -h

# Test connectivity
curl -I https://chatbot.kapgate.com
```

## 🔐 Security Considerations

### Firewall Rules
```bash
# Check firewall status
ufw status

# Allowed ports:
# 22 (SSH), 80 (HTTP), 443 (HTTPS)
```

### SSL Configuration
- **TLS 1.2/1.3 only**
- **Strong cipher suites**
- **HSTS enabled**
- **Auto-renewal configured**

### Container Security
- **Non-root user** in containers
- **Minimal base images** (Alpine Linux)
- **No unnecessary packages**
- **Regular security updates**

## 📊 Performance Optimization

### Docker Optimizations
- **Multi-stage builds** for smaller images
- **Layer caching** for faster builds
- **Health checks** for reliability
- **Resource limits** to prevent abuse

### Nginx Optimizations
- **Gzip compression** enabled
- **Static file caching** configured
- **Connection keep-alive** optimized
- **Rate limiting** implemented

## 🆘 Support & Maintenance

### Regular Maintenance Tasks
1. **Weekly**: Check logs and system resources
2. **Monthly**: Update system packages
3. **Quarterly**: Review and update Docker images
4. **As needed**: Monitor SSL certificate expiration

### Getting Help
1. **Check logs first**: `chatbot logs` or `chatbot monitor`
2. **Verify services**: `chatbot status` and `chatbot health`
3. **Review configuration**: Check Docker Compose and Nginx configs
4. **Test connectivity**: Use curl commands to test endpoints

## 🎯 Next Steps

After successful deployment:

1. **Test thoroughly**: Verify all chatbot functionality
2. **Set up monitoring**: Consider additional monitoring tools
3. **Configure backups**: Set up automated backup schedule
4. **Plan updates**: Establish update and maintenance procedures
5. **Scale if needed**: Add load balancing for high traffic

---

## 📞 Quick Reference

**Deployment**: `sudo ./docker-deploy.sh`  
**Management**: `chatbot [command]`  
**Logs**: `chatbot logs` or `chatbot monitor`  
**Health**: `chatbot health`  
**Update**: `chatbot update`  
**Restart**: `chatbot restart`  

**Your chatbot URL**: https://chatbot.kapgate.com  
**Health check**: https://chatbot.kapgate.com/health  

---

*This deployment solution provides a production-ready, secure, and maintainable setup for your Next.js chatbot with minimal manual intervention required.*