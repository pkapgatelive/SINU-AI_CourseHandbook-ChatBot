#!/usr/bin/env node

/**
 * =============================================================================
 * GitHub Webhook Deployment Server for Next.js Chatbot
 * =============================================================================
 * This server listens for GitHub webhook events and automatically deploys
 * the chatbot when changes are pushed to the main branch.
 * 
 * Usage: node webhook-deploy.js
 * Environment variables:
 * - WEBHOOK_SECRET: GitHub webhook secret
 * - WEBHOOK_PORT: Port to listen on (default: 3001)
 * - DEPLOY_MODE: 'static' or 'ssr' (default: 'ssr')
 * - DOMAIN: Your domain name
 * =============================================================================
 */

const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  port: process.env.WEBHOOK_PORT || 3001,
  secret: process.env.WEBHOOK_SECRET || '',
  deployMode: process.env.DEPLOY_MODE || 'ssr',
  domain: process.env.DOMAIN || 'chatbot.mydomain.com',
  deployScript: path.join(__dirname, 'deploy.sh'),
  logFile: path.join(__dirname, 'webhook-deploy.log')
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Logging functions
function log(level, message) {
  const timestamp = new Date().toISOString();
  const colorMap = {
    INFO: colors.blue,
    SUCCESS: colors.green,
    WARNING: colors.yellow,
    ERROR: colors.red
  };
  
  const coloredMessage = `${colorMap[level] || ''}[${level}]${colors.reset} ${message}`;
  const logMessage = `${timestamp} [${level}] ${message}\n`;
  
  console.log(coloredMessage);
  
  // Append to log file
  fs.appendFileSync(config.logFile, logMessage);
}

function logInfo(message) { log('INFO', message); }
function logSuccess(message) { log('SUCCESS', message); }
function logWarning(message) { log('WARNING', message); }
function logError(message) { log('ERROR', message); }

// Verify GitHub webhook signature
function verifySignature(payload, signature) {
  if (!config.secret) {
    logWarning('No webhook secret configured. Skipping signature verification.');
    return true;
  }
  
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', config.secret)
    .update(payload)
    .digest('hex');
    
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Execute deployment
function executeDeployment(payload) {
  return new Promise((resolve, reject) => {
    logInfo('Starting deployment...');
    logInfo(`Repository: ${payload.repository.full_name}`);
    logInfo(`Branch: ${payload.ref}`);
    logInfo(`Commit: ${payload.head_commit.id.substring(0, 7)} - ${payload.head_commit.message}`);
    logInfo(`Deploy mode: ${config.deployMode}`);
    logInfo(`Domain: ${config.domain}`);
    
    // Check if deploy script exists
    if (!fs.existsSync(config.deployScript)) {
      const error = `Deploy script not found: ${config.deployScript}`;
      logError(error);
      return reject(new Error(error));
    }
    
    // Execute deployment script
    const deployProcess = spawn('bash', [config.deployScript, config.deployMode, config.domain], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        DEPLOY_MODE: config.deployMode,
        DOMAIN: config.domain
      }
    });
    
    let stdout = '';
    let stderr = '';
    
    deployProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      // Log deployment output in real-time
      output.split('\n').forEach(line => {
        if (line.trim()) {
          logInfo(`[DEPLOY] ${line.trim()}`);
        }
      });
    });
    
    deployProcess.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      // Log deployment errors in real-time
      output.split('\n').forEach(line => {
        if (line.trim()) {
          logError(`[DEPLOY] ${line.trim()}`);
        }
      });
    });
    
    deployProcess.on('close', (code) => {
      if (code === 0) {
        logSuccess('Deployment completed successfully!');
        logSuccess(`Chatbot should be accessible at: https://${config.domain}`);
        resolve({ success: true, stdout, stderr });
      } else {
        const error = `Deployment failed with exit code ${code}`;
        logError(error);
        reject(new Error(error));
      }
    });
    
    deployProcess.on('error', (error) => {
      logError(`Failed to start deployment process: ${error.message}`);
      reject(error);
    });
  });
}

// Handle webhook request
function handleWebhook(req, res) {
  let body = '';
  
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', async () => {
    try {
      // Verify signature
      const signature = req.headers['x-hub-signature-256'];
      if (!verifySignature(body, signature)) {
        logError('Invalid webhook signature');
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid signature' }));
        return;
      }
      
      // Parse payload
      const payload = JSON.parse(body);
      const event = req.headers['x-github-event'];
      
      logInfo(`Received GitHub webhook: ${event}`);
      
      // Handle push events to main branch
      if (event === 'push' && payload.ref === 'refs/heads/main') {
        logInfo('Push to main branch detected. Starting deployment...');
        
        try {
          await executeDeployment(payload);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            message: 'Deployment completed successfully',
            timestamp: new Date().toISOString()
          }));
          
        } catch (error) {
          logError(`Deployment failed: ${error.message}`);
          
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
          }));
        }
        
      } else {
        logInfo(`Ignoring ${event} event (not a push to main branch)`);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: 'Event ignored (not a push to main branch)',
          timestamp: new Date().toISOString()
        }));
      }
      
    } catch (error) {
      logError(`Error processing webhook: ${error.message}`);
      
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Invalid JSON payload',
        timestamp: new Date().toISOString()
      }));
    }
  });
}

// Health check endpoint
function handleHealthCheck(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    config: {
      port: config.port,
      deployMode: config.deployMode,
      domain: config.domain,
      hasSecret: !!config.secret
    }
  }));
}

// Create HTTP server
const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-GitHub-Event, X-Hub-Signature-256');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  if (url.pathname === '/webhook' && req.method === 'POST') {
    handleWebhook(req, res);
  } else if (url.pathname === '/health' && req.method === 'GET') {
    handleHealthCheck(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Not found',
      message: 'Available endpoints: POST /webhook, GET /health'
    }));
  }
});

// Error handling
server.on('error', (error) => {
  logError(`Server error: ${error.message}`);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  logInfo('Received SIGINT. Shutting down gracefully...');
  server.close(() => {
    logInfo('Server closed.');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  logInfo('Received SIGTERM. Shutting down gracefully...');
  server.close(() => {
    logInfo('Server closed.');
    process.exit(0);
  });
});

// Start server
server.listen(config.port, () => {
  logSuccess(`GitHub webhook deployment server started`);
  logInfo(`Listening on port ${config.port}`);
  logInfo(`Webhook endpoint: http://localhost:${config.port}/webhook`);
  logInfo(`Health check: http://localhost:${config.port}/health`);
  logInfo(`Deploy mode: ${config.deployMode}`);
  logInfo(`Domain: ${config.domain}`);
  logInfo(`Deploy script: ${config.deployScript}`);
  logInfo(`Log file: ${config.logFile}`);
  
  if (!config.secret) {
    logWarning('No WEBHOOK_SECRET configured. Consider setting one for security.');
  }
  
  logInfo('Ready to receive GitHub webhook events!');
});