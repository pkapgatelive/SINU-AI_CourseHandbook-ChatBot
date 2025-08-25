/**
 * =============================================================================
 * PM2 Ecosystem Configuration for Next.js Chatbot
 * =============================================================================
 * This configuration file defines PM2 applications for both the Next.js chatbot
 * and the webhook deployment server.
 * 
 * Usage:
 * - Start all apps: pm2 start ecosystem.config.js
 * - Start specific app: pm2 start ecosystem.config.js --only chatbot
 * - Restart all: pm2 restart ecosystem.config.js
 * - Stop all: pm2 stop ecosystem.config.js
 * - Delete all: pm2 delete ecosystem.config.js
 * =============================================================================
 */

module.exports = {
  apps: [
    {
      // Next.js Chatbot Application (SSR)
      name: 'chatbot',
      script: 'npm',
      args: 'start',
      cwd: '/home/deploy/nextjs-chat-app',
      instances: 1, // Can be increased for load balancing
      exec_mode: 'fork', // Use 'cluster' for multiple instances
      
      // Environment variables
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        N8N_WEBHOOK_URL: 'https://n8n.srv963093.hstgr.cloud/webhook/5f1c0c82-0ff9-40c7-9e2e-b1a96ffe24cd/chat',
        RATE_LIMIT_WINDOW: '900000',
        RATE_LIMIT_MAX_REQUESTS: '10'
      },
      
      // Development environment (optional)
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      
      // Staging environment (optional)
      env_staging: {
        NODE_ENV: 'production',
        PORT: 3000,
        N8N_WEBHOOK_URL: 'https://your-staging-webhook-url.com'
      },
      
      // Logging
      log_file: '/var/log/pm2/chatbot-combined.log',
      out_file: '/var/log/pm2/chatbot-out.log',
      error_file: '/var/log/pm2/chatbot-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Process management
      autorestart: true,
      watch: false, // Set to true for development
      max_memory_restart: '1G',
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s',
      
      // Health monitoring
      health_check_grace_period: 3000,
      health_check_fatal_exceptions: true,
      
      // Advanced options
      node_args: '--max-old-space-size=1024',
      merge_logs: true,
      time: true
    },
    
    {
      // GitHub Webhook Deployment Server
      name: 'webhook-deploy',
      script: './webhook-deploy.js',
      cwd: '/home/deploy/nextjs-chat-app',
      instances: 1,
      exec_mode: 'fork',
      
      // Environment variables
      env: {
        NODE_ENV: 'production',
        WEBHOOK_PORT: 3001,
        WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || '',
        DEPLOY_MODE: 'ssr', // or 'static'
        DOMAIN: 'chatbot.mydomain.com' // Replace with your actual domain
      },
      
      // Logging
      log_file: '/var/log/pm2/webhook-deploy-combined.log',
      out_file: '/var/log/pm2/webhook-deploy-out.log',
      error_file: '/var/log/pm2/webhook-deploy-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Process management
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s',
      
      // Health monitoring
      health_check_grace_period: 3000,
      health_check_fatal_exceptions: true,
      
      // Advanced options
      merge_logs: true,
      time: true
    }
  ],
  
  // Deployment configuration (optional)
  deploy: {
    production: {
      user: 'deploy',
      host: ['your-vps-ip'], // Replace with your VPS IP
      ref: 'origin/main',
      repo: 'https://github.com/pkapgatelive/SINU-AI_CourseHandbook-ChatBot.git',
      path: '/home/deploy/nextjs-chat-app',
      
      // Pre-deploy commands (run on server before deployment)
      'pre-deploy': 'git fetch --all',
      
      // Post-deploy commands (run on server after deployment)
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      
      // Pre-setup commands (run on server before first deployment)
      'pre-setup': 'sudo apt update && sudo apt install -y nodejs npm git',
      
      // Environment variables for deployment
      env: {
        NODE_ENV: 'production'
      }
    },
    
    staging: {
      user: 'deploy',
      host: ['your-staging-ip'], // Replace with your staging server IP
      ref: 'origin/develop',
      repo: 'https://github.com/pkapgatelive/SINU-AI_CourseHandbook-ChatBot.git',
      path: '/home/deploy/nextjs-chat-app-staging',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env staging',
      env: {
        NODE_ENV: 'staging'
      }
    }
  }
};