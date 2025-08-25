# Customization Checklist for Your Deployment

This checklist shows all the changes you need to make to customize the deployment for your specific setup.

## ✅ Already Updated Files

The following files have been automatically updated with your GitHub repository URL:

- ✅ [`deploy.sh`](deploy.sh) - Updated REPO_URL
- ✅ [`ecosystem.config.js`](ecosystem.config.js) - Updated repository URLs
- ✅ [`README.md`](README.md) - Updated GitHub links and clone commands

## 🔧 Required Changes You Need to Make

### 1. GitHub Repository Settings

#### A. Add Repository Secrets (for GitHub Actions auto-deployment)

Go to your GitHub repository: `https://github.com/pkapgatelive/SINU-AI_CourseHandbook-ChatBot`

Navigate to: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these secrets:

```
VPS_HOST=your-vps-ip-address
VPS_USER=deploy
VPS_SSH_KEY=your-private-ssh-key-content
DOMAIN=your-domain.com
WEBHOOK_SECRET=your-secure-webhook-secret
```

**Example:**
```
VPS_HOST=203.0.113.1
VPS_USER=deploy
VPS_SSH_KEY=-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAlwAAAAdzc2gtcn...
-----END OPENSSH PRIVATE KEY-----
DOMAIN=chatbot.yourdomain.com
WEBHOOK_SECRET=your-super-secret-webhook-key-123
```

### 2. Domain Configuration

#### A. Replace Domain Placeholders

You need to replace `chatbot.mydomain.com` with your actual domain in these files:

**Files to update:**
- [`nginx-static.conf`](nginx-static.conf) - Lines 11, 18, 23, 24
- [`nginx-ssr.conf`](nginx-ssr.conf) - Lines 18, 25, 30, 31, 172, 173
- [`ecosystem.config.js`](ecosystem.config.js) - Line 52

**Find and replace:**
```bash
# Replace in all files
sed -i 's/chatbot\.mydomain\.com/your-actual-domain.com/g' nginx-static.conf
sed -i 's/chatbot\.mydomain\.com/your-actual-domain.com/g' nginx-ssr.conf
sed -i 's/chatbot\.mydomain\.com/your-actual-domain.com/g' ecosystem.config.js
```

**Or manually edit each file:**

**nginx-static.conf:**
```nginx
# Line 11 & 18
server_name your-actual-domain.com;

# Lines 23-24
ssl_certificate /etc/letsencrypt/live/your-actual-domain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/your-actual-domain.com/privkey.pem;
```

**nginx-ssr.conf:**
```nginx
# Line 18 & 25
server_name your-actual-domain.com;

# Lines 30-31
ssl_certificate /etc/letsencrypt/live/your-actual-domain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/your-actual-domain.com/privkey.pem;

# Lines 172-173
server_name www.your-actual-domain.com;
ssl_certificate /etc/letsencrypt/live/your-actual-domain.com/fullchain.pem;
```

**ecosystem.config.js:**
```javascript
// Line 52
DOMAIN: 'your-actual-domain.com'
```

### 3. VPS IP Address Configuration

#### A. Update VPS IP in ecosystem.config.js

**File:** [`ecosystem.config.js`](ecosystem.config.js)

**Find line 94:**
```javascript
host: ['your-vps-ip'], // Replace with your VPS IP
```

**Replace with:**
```javascript
host: ['203.0.113.1'], // Your actual VPS IP
```

### 4. Environment Variables

#### A. Create .env file

Create a `.env` file in your project root with your actual values:

```env
# n8n Integration (update with your actual webhook URL)
N8N_WEBHOOK_URL=https://n8n.srv963093.hstgr.cloud/webhook/5f1c0c82-0ff9-40c7-9e2e-b1a96ffe24cd/chat

# Rate Limiting (adjust as needed)
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX_REQUESTS=10

# Application
NODE_ENV=production
PORT=3000

# Optional: Custom settings
NEXT_PUBLIC_CHAT_API_ENDPOINT=/api/chat
NEXT_PUBLIC_CHAT_TIMEOUT=30000
NEXT_PUBLIC_CHAT_MAX_RETRIES=3
NEXT_PUBLIC_CHAT_RETRY_DELAY=1000
```

#### B. Update n8n Webhook URL

If your n8n webhook URL is different, update it in:
- `.env` file (create this)
- [`deploy.sh`](deploy.sh) - Line 114 in the environment setup section

### 5. DNS Configuration

#### A. Set up DNS A Record

In your domain registrar's DNS management:

```
Type: A
Name: chatbot (or your preferred subdomain)
Value: YOUR_VPS_IP_ADDRESS
TTL: 300
```

**Example:**
```
Type: A
Name: chatbot
Value: 203.0.113.1
TTL: 300
```

This will make your chatbot accessible at `https://chatbot.yourdomain.com`

### 6. SSH Key Setup

#### A. Generate SSH Key Pair (if you don't have one)

```bash
# On your local machine
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"

# This creates:
# ~/.ssh/id_rsa (private key - add to GitHub secrets)
# ~/.ssh/id_rsa.pub (public key - add to VPS)
```

#### B. Add Public Key to VPS

```bash
# Copy your public key content
cat ~/.ssh/id_rsa.pub

# On your VPS, add it to authorized_keys
echo "your-public-key-content" >> /home/deploy/.ssh/authorized_keys
```

## 🚀 Deployment Steps

After making all the above changes:

### 1. Initial VPS Setup

```bash
# Connect to your VPS
ssh root@your-vps-ip

# Download and run server setup
wget https://raw.githubusercontent.com/pkapgatelive/SINU-AI_CourseHandbook-ChatBot/main/server-setup.sh
chmod +x server-setup.sh
sudo ./server-setup.sh your-actual-domain.com your-email@example.com
```

### 2. SSL Setup

```bash
# Switch to deploy user
su - deploy

# Setup SSL
sudo ./ssl-setup.sh your-actual-domain.com your-email@example.com ssr
```

### 3. Deploy Application

```bash
# Clone and deploy
git clone https://github.com/pkapgatelive/SINU-AI_CourseHandbook-ChatBot.git SINU-AI_CourseHandbook-ChatBot
cd SINU-AI_CourseHandbook-ChatBot
./deploy.sh ssr your-actual-domain.com
```

### 4. Verify Deployment

```bash
# Test your deployment
curl -I https://your-actual-domain.com
```

## 📋 Quick Reference

### Your Specific URLs and Commands

Replace these placeholders with your actual values:

| Placeholder | Your Value | Example |
|-------------|------------|---------|
| `your-vps-ip` | Your VPS IP address | `203.0.113.1` |
| `your-actual-domain.com` | Your domain | `chatbot.example.com` |
| `your-email@example.com` | Your email | `admin@example.com` |
| `your-webhook-secret` | Secure random string | `webhook-secret-123` |

### Final Commands (with your values)

```bash
# Server setup
sudo ./server-setup.sh chatbot.example.com admin@example.com

# SSL setup
sudo ./ssl-setup.sh chatbot.example.com admin@example.com ssr

# Deploy
./deploy.sh ssr chatbot.example.com

# Test
curl -I https://chatbot.example.com
```

## ✅ Verification Checklist

Before deploying, ensure:

- [ ] GitHub repository secrets are set
- [ ] Domain DNS A record points to your VPS IP
- [ ] All domain placeholders are replaced in config files
- [ ] VPS IP is updated in ecosystem.config.js
- [ ] .env file is created with correct values
- [ ] SSH keys are properly configured
- [ ] n8n webhook URL is correct

## 🆘 Need Help?

If you encounter issues:

1. Check the [Troubleshooting section](DEPLOYMENT_GUIDE.md#troubleshooting) in the deployment guide
2. Verify all placeholders are replaced with actual values
3. Ensure DNS propagation is complete (can take up to 48 hours)
4. Check server logs: `pm2 logs` and `/var/log/nginx/error.log`

---

**Next Step:** After making these changes, follow the [Deployment Guide](DEPLOYMENT_GUIDE.md) for step-by-step deployment instructions.