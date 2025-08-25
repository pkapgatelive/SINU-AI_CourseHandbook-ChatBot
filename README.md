# Next.js Chat Application - Production Deployment

A modern chat application built with Next.js 14+, Tailwind CSS, and TanStack React Query, with complete production deployment setup for Ubuntu VPS hosting.

## 🚀 Quick Deploy to VPS

Deploy your chatbot to any Ubuntu VPS (including Hostinger) in minutes:

```bash
# 1. Setup server
sudo ./server-setup.sh chatbot.yourdomain.com admin@yourdomain.com

# 2. Configure SSL
sudo ./ssl-setup.sh chatbot.yourdomain.com admin@yourdomain.com ssr

# 3. Deploy application
./deploy.sh ssr chatbot.yourdomain.com
```

**Your chatbot will be live at `https://chatbot.yourdomain.com`** 🎉

## 📋 Table of Contents

- [Features](#features)
- [Technologies](#technologies)
- [Local Development](#local-development)
- [Production Deployment](#production-deployment)
- [Deployment Modes](#deployment-modes)
- [Auto-Deployment](#auto-deployment)
- [Configuration](#configuration)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## ✨ Features

### Application Features
- 🤖 **AI-powered chatbot** with n8n integration
- 💬 **Real-time messaging** with session management
- 🎨 **Modern UI** with Tailwind CSS and Framer Motion
- 📱 **Responsive design** for all devices
- 🔒 **Rate limiting** and security features
- 📊 **Query state management** with TanStack React Query

### Deployment Features
- 🚀 **One-command deployment** to any Ubuntu VPS
- 🔄 **Dual deployment modes**: Static export and SSR
- 🔐 **Automatic SSL/HTTPS** with Let's Encrypt
- 🔧 **Production-ready** with PM2 and Nginx
- 📈 **Auto-deployment** via GitHub Actions or webhooks
- 🛡️ **Security hardened** with firewall and fail2ban
- 📊 **Comprehensive monitoring** and logging

## 🛠 Technologies

### Frontend
- [Next.js 15](https://nextjs.org/) with App Router
- [React 19](https://reactjs.org/)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [TanStack React Query](https://tanstack.com/query/latest)
- [Framer Motion](https://www.framer.com/motion/)
- [TypeScript](https://www.typescriptlang.org/)

### Backend & Infrastructure
- [Node.js 18+](https://nodejs.org/)
- [PM2](https://pm2.keymetrics.io/) process manager
- [Nginx](https://nginx.org/) reverse proxy
- [Let's Encrypt](https://letsencrypt.org/) SSL certificates
- [n8n](https://n8n.io/) workflow automation

## 🏃‍♂️ Local Development

### Prerequisites
- Node.js 18+ and npm
- Git

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/pkapgatelive/SINU-AI_CourseHandbook-ChatBot.git
   cd SINU-AI_CourseHandbook-ChatBot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your n8n webhook URL
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   ```
   http://localhost:3000
   ```

### Development Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm test             # Run tests (if available)
```

## 🌐 Production Deployment

### Quick Start

For detailed instructions, see the [Complete Deployment Guide](DEPLOYMENT_GUIDE.md).

#### 1. Server Setup

```bash
# Connect to your VPS
ssh root@your-vps-ip

# Download and run server setup
wget https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/server-setup.sh
chmod +x server-setup.sh
sudo ./server-setup.sh chatbot.yourdomain.com admin@yourdomain.com
```

#### 2. Domain Configuration

Set up DNS A record:
```
Type: A
Name: chatbot
Value: YOUR_VPS_IP
TTL: 300
```

See [Domain Setup Guide](DOMAIN_SETUP_GUIDE.md) for detailed instructions.

#### 3. SSL Setup

```bash
# Switch to deploy user
su - deploy

# Setup SSL certificates
sudo ./ssl-setup.sh chatbot.yourdomain.com admin@yourdomain.com ssr
```

#### 4. Deploy Application

```bash
# Clone your repository
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git nextjs-chat-app
cd nextjs-chat-app

# Deploy in SSR mode
./deploy.sh ssr chatbot.yourdomain.com

# Or deploy in static mode
./deploy.sh static chatbot.yourdomain.com
```

## 🔧 Deployment Modes

### SSR Mode (Recommended)
- **Best for**: Full Next.js functionality, API routes, dynamic content
- **Features**: Server-side rendering, PM2 process management
- **Performance**: Good performance with full functionality

```bash
./deploy.sh ssr chatbot.yourdomain.com
```

### Static Export Mode
- **Best for**: Maximum performance, CDN-friendly
- **Features**: Pre-built static files, Nginx-served
- **Performance**: Excellent performance, lower server resources

```bash
./deploy.sh static chatbot.yourdomain.com
```

### Comparison

| Feature | SSR Mode | Static Mode |
|---------|----------|-------------|
| Performance | Good | Excellent |
| API Routes | ✅ Native | ❌ Proxied only |
| Build Time | Fast | Slower |
| Server Resources | Higher | Lower |
| Scalability | Good | Excellent |

## 🔄 Auto-Deployment

### GitHub Actions (Recommended)

1. **Set repository secrets**:
   ```
   VPS_HOST=your-vps-ip
   VPS_USER=deploy
   VPS_SSH_KEY=your-private-ssh-key
   DOMAIN=chatbot.yourdomain.com
   ```

2. **Push to main branch** - deployment happens automatically!

3. **Manual deployment**: Use GitHub Actions tab to trigger deployments

### Webhook Deployment

1. **Start webhook server**:
   ```bash
   pm2 start ecosystem.config.js --only webhook-deploy
   ```

2. **Configure GitHub webhook**:
   - URL: `http://your-vps-ip:3001/webhook`
   - Content type: `application/json`
   - Events: Push events

## ⚙️ Configuration

### Environment Variables

Create `.env` file in project root:

```env
# n8n Integration
N8N_WEBHOOK_URL=https://your-n8n-webhook-url

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX_REQUESTS=10

# Application
NODE_ENV=production
PORT=3000
```

### GitHub Secrets

For auto-deployment, configure these secrets in your GitHub repository:

```
VPS_HOST=your-vps-ip
VPS_USER=deploy
VPS_SSH_KEY=your-private-ssh-key
DOMAIN=chatbot.yourdomain.com
WEBHOOK_SECRET=your-webhook-secret
```

### PM2 Configuration

The [`ecosystem.config.js`](ecosystem.config.js) file configures:
- Application process management
- Environment variables
- Logging configuration
- Health monitoring
- Webhook deployment server

## 📊 Monitoring

### Application Monitoring

```bash
# View running processes
pm2 list

# View logs
pm2 logs chatbot
pm2 logs webhook-deploy

# Monitor resources
pm2 monit

# Restart applications
pm2 restart chatbot
```

### System Monitoring

```bash
# Check application health
curl -I https://chatbot.yourdomain.com

# Check webhook server
curl http://localhost:3001/health

# View system logs
tail -f /var/log/nginx/chatbot-ssr.access.log
tail -f /var/log/pm2/chatbot-combined.log
```

### Health Checks

The deployment includes built-in health checks:
- Application endpoint monitoring
- SSL certificate validation
- Process health monitoring
- System resource monitoring

## 🔍 Troubleshooting

### Common Issues

#### Domain Not Resolving
```bash
# Check DNS configuration
dig chatbot.yourdomain.com A
nslookup chatbot.yourdomain.com
```

#### SSL Certificate Issues
```bash
# Check certificate status
sudo certbot certificates

# Renew certificate
sudo certbot renew --force-renewal
```

#### Application Not Starting
```bash
# Check PM2 logs
pm2 logs chatbot

# Restart application
pm2 restart chatbot

# Check environment variables
pm2 env 0
```

#### Nginx 502 Bad Gateway
```bash
# Check if application is running
pm2 list

# Check Nginx error logs
tail -f /var/log/nginx/error.log

# Restart services
pm2 restart chatbot
sudo systemctl reload nginx
```

For more troubleshooting help, see the [Complete Deployment Guide](DEPLOYMENT_GUIDE.md#troubleshooting).

## 📁 Project Structure

```
nextjs-chat-app/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/chat/        # Chat API endpoint
│   │   ├── chat/            # Chat page
│   │   └── globals.css      # Global styles
│   ├── components/          # React components
│   │   ├── ChatBox.tsx      # Main chat interface
│   │   ├── ChatLauncher.tsx # Chat launcher button
│   │   └── ...
│   └── lib/                 # Utility functions
├── public/                  # Static assets
├── deployment/              # Deployment scripts
│   ├── deploy.sh           # Main deployment script
│   ├── server-setup.sh     # Server setup script
│   ├── ssl-setup.sh        # SSL setup script
│   ├── nginx-static.conf   # Nginx config (static)
│   ├── nginx-ssr.conf      # Nginx config (SSR)
│   ├── webhook-deploy.js   # Webhook server
│   └── ecosystem.config.js # PM2 configuration
├── .github/workflows/       # GitHub Actions
├── docs/                   # Documentation
└── README.md               # This file
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📖 **Documentation**: [Complete Deployment Guide](DEPLOYMENT_GUIDE.md)
- 🌐 **Domain Setup**: [Domain Setup Guide](DOMAIN_SETUP_GUIDE.md)
- 🐛 **Issues**: [GitHub Issues](https://github.com/pkapgatelive/SINU-AI_CourseHandbook-ChatBot/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/pkapgatelive/SINU-AI_CourseHandbook-ChatBot/discussions)

## 🎯 Roadmap

- [ ] Docker containerization
- [ ] Kubernetes deployment
- [ ] Multi-language support
- [ ] Advanced analytics
- [ ] Load balancing setup
- [ ] Database integration
- [ ] Redis caching

---

**Made with ❤️ for the developer community**

Deploy your Next.js chatbot to production in minutes, not hours!
