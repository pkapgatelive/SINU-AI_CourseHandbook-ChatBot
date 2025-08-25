# Domain Setup Guide for Next.js Chatbot Deployment

This guide walks you through setting up your domain to point to your VPS and configuring DNS records for your Next.js chatbot deployment.

## Table of Contents

1. [Domain Registration](#domain-registration)
2. [DNS Configuration](#dns-configuration)
3. [Domain Verification](#domain-verification)
4. [Subdomain Setup](#subdomain-setup)
5. [Common DNS Providers](#common-dns-providers)
6. [Troubleshooting](#troubleshooting)

## Domain Registration

### Option 1: Register a New Domain

If you don't have a domain yet, you can register one from popular registrars:

- **Namecheap** (recommended for beginners)
- **GoDaddy**
- **Google Domains** (now part of Squarespace)
- **Cloudflare Registrar**
- **Porkbun**

### Option 2: Use an Existing Domain

If you already own a domain, you can create a subdomain for your chatbot (e.g., `chatbot.yourdomain.com`).

## DNS Configuration

### Required DNS Records

You need to create the following DNS records:

#### Primary Domain Setup

```
Type: A
Name: chatbot (or your preferred subdomain)
Value: YOUR_VPS_IP_ADDRESS
TTL: 300 (5 minutes) or 3600 (1 hour)
```

#### Optional: WWW Subdomain

```
Type: CNAME
Name: www.chatbot
Value: chatbot.yourdomain.com
TTL: 300 or 3600
```

### Step-by-Step DNS Configuration

1. **Get Your VPS IP Address**
   ```bash
   # On your VPS, run:
   curl ifconfig.me
   # or
   curl ipinfo.io/ip
   ```

2. **Access Your DNS Management Panel**
   - Log into your domain registrar or DNS provider
   - Navigate to DNS management/DNS records section

3. **Add A Record**
   - **Type**: A
   - **Name/Host**: `chatbot` (for chatbot.yourdomain.com)
   - **Value/Points to**: Your VPS IP address
   - **TTL**: 300 seconds (for testing) or 3600 seconds (for production)

4. **Add CNAME Record (Optional)**
   - **Type**: CNAME
   - **Name/Host**: `www.chatbot`
   - **Value/Points to**: `chatbot.yourdomain.com`
   - **TTL**: 3600 seconds

## Domain Verification

### Check DNS Propagation

After setting up DNS records, verify they're working:

#### Using Command Line Tools

```bash
# Check A record
dig chatbot.yourdomain.com A

# Check from different DNS servers
dig @8.8.8.8 chatbot.yourdomain.com A
dig @1.1.1.1 chatbot.yourdomain.com A

# Alternative using nslookup
nslookup chatbot.yourdomain.com
```

#### Using Online Tools

- [DNS Checker](https://dnschecker.org/)
- [What's My DNS](https://www.whatsmydns.net/)
- [DNS Propagation Checker](https://www.dnsmap.io/)

### Expected Results

You should see your VPS IP address returned for your domain:

```
chatbot.yourdomain.com.    300    IN    A    YOUR_VPS_IP
```

## Subdomain Setup

### Common Subdomain Patterns

Choose a subdomain that makes sense for your chatbot:

- `chatbot.yourdomain.com` (recommended)
- `chat.yourdomain.com`
- `bot.yourdomain.com`
- `support.yourdomain.com`
- `ai.yourdomain.com`

### Multiple Environment Setup

For different environments, you can use:

- `chatbot.yourdomain.com` (production)
- `staging-chatbot.yourdomain.com` (staging)
- `dev-chatbot.yourdomain.com` (development)

## Common DNS Providers

### Cloudflare (Recommended)

**Advantages:**
- Free SSL/TLS certificates
- DDoS protection
- CDN capabilities
- Advanced security features

**Setup Steps:**
1. Sign up at [cloudflare.com](https://cloudflare.com)
2. Add your domain
3. Update nameservers at your registrar
4. Add A record for your subdomain
5. Enable "Proxy status" (orange cloud) for additional protection

**DNS Record Example:**
```
Type: A
Name: chatbot
IPv4 address: YOUR_VPS_IP
Proxy status: Proxied (orange cloud)
TTL: Auto
```

### Namecheap

**Setup Steps:**
1. Log into Namecheap account
2. Go to Domain List → Manage
3. Click "Advanced DNS"
4. Add new A record

**DNS Record Example:**
```
Type: A Record
Host: chatbot
Value: YOUR_VPS_IP
TTL: 5 min
```

### GoDaddy

**Setup Steps:**
1. Log into GoDaddy account
2. Go to My Products → DNS
3. Click "Manage" next to your domain
4. Add new A record

**DNS Record Example:**
```
Type: A
Name: chatbot
Value: YOUR_VPS_IP
TTL: 1 Hour
```

### Google Domains (Squarespace)

**Setup Steps:**
1. Log into Google Domains
2. Select your domain
3. Go to DNS settings
4. Add custom resource record

**DNS Record Example:**
```
Name: chatbot
Type: A
TTL: 300
Data: YOUR_VPS_IP
```

## Troubleshooting

### Common Issues and Solutions

#### 1. DNS Not Propagating

**Problem**: Domain doesn't resolve to your VPS IP

**Solutions:**
- Wait 24-48 hours for full propagation
- Check TTL settings (lower TTL = faster updates)
- Verify DNS records are correct
- Clear local DNS cache:
  ```bash
  # Linux/Mac
  sudo systemctl flush-dns
  # or
  sudo dscacheutil -flushcache
  
  # Windows
  ipconfig /flushdns
  ```

#### 2. Wrong IP Address Returned

**Problem**: Domain resolves to wrong IP

**Solutions:**
- Double-check A record value
- Ensure you're using the correct VPS IP
- Remove any conflicting DNS records

#### 3. Subdomain Not Working

**Problem**: Main domain works but subdomain doesn't

**Solutions:**
- Verify subdomain A record exists
- Check for typos in subdomain name
- Ensure DNS provider supports subdomains

#### 4. SSL Certificate Issues

**Problem**: HTTPS not working after domain setup

**Solutions:**
- Run SSL setup script: `sudo ./ssl-setup.sh chatbot.yourdomain.com your@email.com`
- Verify domain points to your server before running Certbot
- Check Nginx configuration

### Verification Commands

```bash
# Test HTTP connection
curl -I http://chatbot.yourdomain.com

# Test HTTPS connection (after SSL setup)
curl -I https://chatbot.yourdomain.com

# Check SSL certificate
openssl s_client -connect chatbot.yourdomain.com:443 -servername chatbot.yourdomain.com

# Test from different locations
curl -H "Host: chatbot.yourdomain.com" http://YOUR_VPS_IP
```

### DNS Propagation Timeline

- **Local DNS**: 0-5 minutes
- **ISP DNS**: 30 minutes - 4 hours
- **Global DNS**: 4-48 hours
- **Full propagation**: Up to 72 hours

## Security Considerations

### DNS Security Best Practices

1. **Use DNSSEC** (if supported by your provider)
2. **Enable two-factor authentication** on your DNS provider account
3. **Use strong passwords** for DNS management accounts
4. **Monitor DNS changes** with alerts
5. **Consider using Cloudflare** for additional security layers

### Domain Privacy

- Enable **WHOIS privacy protection** to hide personal information
- Use a **business email** for domain registration
- Consider **domain locking** to prevent unauthorized transfers

## Next Steps

After your domain is properly configured and verified:

1. **Run SSL Setup**:
   ```bash
   sudo ./ssl-setup.sh chatbot.yourdomain.com your@email.com ssr
   ```

2. **Deploy Your Application**:
   ```bash
   ./deploy.sh ssr chatbot.yourdomain.com
   ```

3. **Test Your Deployment**:
   ```bash
   curl -I https://chatbot.yourdomain.com
   ```

4. **Setup Monitoring** (optional):
   - Configure uptime monitoring
   - Set up SSL certificate expiration alerts
   - Monitor DNS changes

## Support

If you encounter issues:

1. Check the [troubleshooting section](#troubleshooting)
2. Verify your DNS configuration with online tools
3. Contact your DNS provider's support
4. Check server logs: `/var/log/nginx/error.log`

---

**Remember**: DNS changes can take time to propagate globally. Be patient and allow up to 48 hours for full propagation, especially for new domains or major DNS changes.