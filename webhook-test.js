#!/usr/bin/env node

// Webhook Testing Utility
// This script helps test the n8n webhook directly to debug response issues

const https = require('https');
const http = require('http');

// Configuration
const WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://n8n.srv963093.hstgr.cloud/webhook/5f1c0c82-0ff9-40c7-9e2e-b1a96ffe24cd/chat';
const TEST_SESSION_ID = 'test' + Math.random().toString(36).substr(2, 28); // 32 chars total
const TEST_MESSAGE = process.argv[2] || 'hi';

console.log('🔧 Webhook Testing Utility');
console.log('==========================');
console.log(`Webhook URL: ${WEBHOOK_URL}`);
console.log(`Session ID: ${TEST_SESSION_ID} (length: ${TEST_SESSION_ID.length})`);
console.log(`Test Message: "${TEST_MESSAGE}"`);
console.log('');

// Test payload matching the API route format
const payload = {
  chatId: TEST_SESSION_ID,
  chatInput: TEST_MESSAGE,
  action: 'sendMessage',
  source: 'web',
  timestamp: new Date().toISOString(),
  userAgent: 'webhook-test-utility'
};

console.log('📤 Sending payload:');
console.log(JSON.stringify(payload, null, 2));
console.log('');

// Parse URL
const url = new URL(WEBHOOK_URL);
const isHttps = url.protocol === 'https:';
const client = isHttps ? https : http;

// Request options
const options = {
  hostname: url.hostname,
  port: url.port || (isHttps ? 443 : 80),
  path: url.pathname + url.search,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'webhook-test-utility/1.0'
  }
};

console.log('🚀 Making request...');
const startTime = Date.now();

const req = client.request(options, (res) => {
  const duration = Date.now() - startTime;
  
  console.log('📥 Response received:');
  console.log(`Status: ${res.statusCode} ${res.statusMessage}`);
  console.log(`Duration: ${duration}ms`);
  console.log('Headers:', res.headers);
  console.log('');

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('📄 Response body:');
    console.log('Raw length:', data.length);
    
    if (data.length > 0) {
      console.log('Raw content:');
      console.log(data);
      console.log('');

      // Try to parse as JSON
      try {
        const parsed = JSON.parse(data);
        console.log('✅ Successfully parsed as JSON:');
        console.log(JSON.stringify(parsed, null, 2));
        console.log('');

        // Test the extraction logic
        console.log('🔍 Testing extraction logic:');
        const extracted = extractTextFromUnknown(parsed);
        if (extracted) {
          console.log('✅ Extracted text:', extracted);
        } else {
          console.log('❌ No text could be extracted');
          
          // Try collecting strings
          const collected = collectStringsFromUnknown(parsed);
          if (collected.length > 0) {
            console.log('📝 Collected strings:', collected);
            console.log('📝 Joined:', collected.join(' '));
          } else {
            console.log('❌ No strings could be collected');
          }
        }
      } catch (e) {
        console.log('❌ Failed to parse as JSON:', e.message);
        console.log('📝 Treating as plain text response');
      }
    } else {
      console.log('❌ Empty response body');
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request failed:', e.message);
  process.exit(1);
});

// Send the request
req.write(JSON.stringify(payload));
req.end();

// Extraction logic (copied from API route)
function extractTextFromUnknown(data, visited = new Set()) {
  const preferredKeys = ['reply', 'response', 'message', 'text', 'content', 'output', 'result', 'answer'];

  if (data == null) return null;

  if (typeof data === 'string') {
    const trimmed = data.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return String(data);
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      const extracted = extractTextFromUnknown(item, visited);
      if (extracted) return extracted;
    }
    return null;
  }

  if (typeof data === 'object') {
    const obj = data;
    if (visited.has(obj)) return null;
    visited.add(obj);

    // 1) Try preferred keys at the current level first
    for (const key of preferredKeys) {
      const value = obj[key];
      const extracted = extractTextFromUnknown(value, visited);
      if (extracted) return extracted;
    }

    // 2) Try common container keys next
    const containerKeys = ['data', 'json', 'body', 'payload', 'choices'];
    for (const key of containerKeys) {
      if (key in obj) {
        const extracted = extractTextFromUnknown(obj[key], visited);
        if (extracted) return extracted;
      }
    }

    // 3) Fallback: scan all values
    for (const value of Object.values(obj)) {
      const extracted = extractTextFromUnknown(value, visited);
      if (extracted) return extracted;
    }

    return null;
  }

  return null;
}

function collectStringsFromUnknown(data, out = [], visited = new Set()) {
  if (data == null) return out;

  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (trimmed.length > 0) out.push(trimmed);
    return out;
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    out.push(String(data));
    return out;
  }

  if (Array.isArray(data)) {
    for (const item of data) collectStringsFromUnknown(item, out, visited);
    return out;
  }

  if (typeof data === 'object') {
    const obj = data;
    if (visited.has(obj)) return out;
    visited.add(obj);
    for (const value of Object.values(obj)) collectStringsFromUnknown(value, out, visited);
    return out;
  }

  return out;
}