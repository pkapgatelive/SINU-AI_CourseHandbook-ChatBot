import { NextRequest, NextResponse } from 'next/server';
import { isRateLimited, getRateLimitHeaders } from '@/lib/rateLimit';

// Attempts to extract a human-readable reply string from arbitrary JSON structures
function extractTextFromUnknown(data: unknown, visited = new Set<object>()): string | null {
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
    const obj = data as Record<string, unknown>;
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

// Collects all string leaf values from an unknown JSON-like structure
function collectStringsFromUnknown(data: unknown, out: string[] = [], visited = new Set<object>()): string[] {
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
    const obj = data as Record<string, unknown>;
    if (visited.has(obj)) return out;
    visited.add(obj);
    for (const value of Object.values(obj)) collectStringsFromUnknown(value, out, visited);
    return out;
  }

  return out;
}

// Helper to get client IP
function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    '127.0.0.1'
  );
}

// Helper to filter sensitive headers
function filterHeaders(headers: Headers): Record<string, string> {
  const filtered: Record<string, string> = {};
  const sensitiveHeaders = [
    'host',
    'cookie',
    'authorization',
    'x-forwarded-for',
    'x-forwarded-host',
    'x-real-ip',
    'cf-connecting-ip',
    'x-vercel-ip',
    'x-vercel-forwarded-for',
    'x-vercel-id',
    'x-amzn-trace-id',
    'true-client-ip',
    'x-client-ip',
    'x-cluster-client-ip',
  ];

  headers.forEach((value, key) => {
    // Skip sensitive headers and any header that might leak infrastructure
    if (!sensitiveHeaders.includes(key.toLowerCase())) {
      filtered[key] = value;
    }
  });

  return filtered;
}

export async function POST(request: NextRequest) {
  // Guard against undefined request
  if (!request) {
    return new NextResponse(
      JSON.stringify({
        error: 'Request is required',
        code: 'MISSING_REQUEST'
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true',
        },
      }
    );
  }

  // Guard against missing Content-Type header
  const contentType = request.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    return new NextResponse(
      JSON.stringify({
        error: 'Content-Type must be application/json',
        code: 'INVALID_CONTENT_TYPE'
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true',
        },
      }
    );
  }

  // Get session ID from request body
  let body;
  try {
    body = await request.json();
  } catch {
    return new NextResponse(
      JSON.stringify({
        error: 'Invalid JSON in request body',
        code: 'INVALID_JSON'
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true',
        },
      }
    );
  }
  
  // Validate request body
  if (!body) {
    return new NextResponse(
      JSON.stringify({
        error: 'Request body is required',
        code: 'MISSING_BODY'
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true',
        },
      }
    );
  }

  // Validate session ID - if missing/short (<8), auto-generate crypto.randomUUID() and continue
  let sessionId = body.sessionId;
  
  if (!sessionId || typeof sessionId !== 'string' || sessionId.trim().length < 8) {
    sessionId = crypto.randomUUID();
  }
  
  // Limit session ID length
  if (sessionId.length > 100) {
    return NextResponse.json(
      { error: 'Session ID is too long', code: 'SESSION_ID_TOO_LONG' },
      { status: 400 }
    );
  }

  // Validate message - if empty, return 400
  if (!body.message || typeof body.message !== 'string' || body.message.trim().length === 0) {
    return NextResponse.json(
      { error: 'Message content is required', code: 'MISSING_MESSAGE' },
      { status: 400 }
    );
  }

  const message = body.message.trim();
  if (message.length > 1000) {
    return NextResponse.json(
      { error: 'Message is too long (max 1000 characters)', code: 'MESSAGE_TOO_LONG' },
      { status: 400 }
    );
  }

  const metadata = body.metadata;
  
  // Get client IP
  const ip = getClientIP(request);
  
  // Check rate limit
  if (isRateLimited(sessionId, ip)) {
    const headers = getRateLimitHeaders(sessionId, ip);
    
    // Log rate limit hit
    console.log(`[Rate Limit] Session: ${sessionId}, IP: ${ip}`);
    
    return new NextResponse(
      JSON.stringify({
        error: 'Rate limit exceeded. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true',
          ...headers,
        },
      }
    );
  }

  try {
    // Get the webhook URL from environment variables with fallback
    const raw = process.env.N8N_WEBHOOK_URL ?? 'https://n8n.srv963093.hstgr.cloud/webhook/5f1c0c82-0ff9-40c7-9e2e-b1a96ffe24cd/chat';
    const url = raw.trim();
    try { new URL(url); } catch {
      console.error('[api/chat] Invalid webhook URL:', { raw });
      return NextResponse.json({ error: 'Invalid webhook URL', code: 'BAD_WEBHOOK_URL' }, { status: 500 });
    }
    
    // Map payload according to specifications
    const payload = {
      sessionId: sessionId,
      chatInput: message,
      action: 'sendMessage',
      source: 'web',
      ...(metadata && typeof metadata === 'object' ? metadata : {})
    };

    // Enhanced logging for debugging
    console.log('[api/chat] Sending request to webhook:', {
      url,
      sessionIdLength: sessionId.length,
      sessionId: sessionId.substring(0, 8) + '...', // Log first 8 chars for debugging
      messageLength: message.length,
      payload: {
        sessionId: sessionId.substring(0, 8) + '...',
        chatInput: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
        action: payload.action,
        source: payload.source
      }
    });

    // Fetch with proper error handling
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // Log the response status and headers
    console.log('[api/chat] Webhook response:', {
      status: upstream.status,
      statusText: upstream.statusText,
      contentType: upstream.headers.get('content-type'),
      contentLength: upstream.headers.get('content-length')
    });

    // If !upstream.ok, read text safely (don't assume JSON) and return that status
    if (!upstream.ok) {
      const text = await upstream.text();
      // Try to parse as JSON, but don't assume it is
      try {
        const json = JSON.parse(text);
        return NextResponse.json(json, { status: upstream.status });
      } catch {
        // If not JSON, return as text
        return new NextResponse(text, {
          status: upstream.status,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    }
    
    // If content-type includes application/json, normalize to a consistent shape
    const contentType = upstream.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      console.log('[api/chat] Processing JSON response, content-type:', contentType);
      const json = await upstream.json();
      
      // Log the raw response for debugging
      console.log('[api/chat] Raw webhook response:', JSON.stringify(json, null, 2));
      
      const extracted = extractTextFromUnknown(json);
      if (extracted) {
        console.log('[api/chat] Successfully extracted reply:', {
          length: extracted.length,
          preview: extracted.substring(0, 100) + (extracted.length > 100 ? '...' : '')
        });
        return NextResponse.json({ reply: extracted }, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true',
          }
        });
      }
      
      // Fallback: collect any string leaves and join them to form a reply
      try {
        const collected = collectStringsFromUnknown(json);
        if (collected.length > 0) {
          const joined = collected.join(' ').slice(0, 4000);
          console.log('[api/chat] Using fallback collected strings:', {
            count: collected.length,
            length: joined.length,
            preview: joined.substring(0, 100) + (joined.length > 100 ? '...' : '')
          });
          return NextResponse.json({ reply: joined }, {
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Credentials': 'true',
            }
          });
        }
      } catch (e) {
        console.warn('[api/chat] Failed to collect strings from JSON:', e);
      }
      
      // Log when we're about to return the fallback message
      console.warn('[api/chat] No usable content found in webhook response, returning fallback message. Raw response was:', json);
      return NextResponse.json({ reply: 'Sorry, I could not generate a response at the moment. Please try again or rephrase your question.' }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true',
        }
      });
    }
    
    // Else, attempt to parse text as JSON; if not JSON, wrap as reply
    const text = await upstream.text();
    console.log('[api/chat] Processing text response:', {
      length: text.length,
      preview: text.substring(0, 200) + (text.length > 200 ? '...' : '')
    });
    
    try {
      const parsed = JSON.parse(text);
      console.log('[api/chat] Successfully parsed text as JSON:', JSON.stringify(parsed, null, 2));
      
      const extracted = extractTextFromUnknown(parsed);
      if (extracted) {
        console.log('[api/chat] Extracted reply from text JSON:', {
          length: extracted.length,
          preview: extracted.substring(0, 100) + (extracted.length > 100 ? '...' : '')
        });
        return NextResponse.json({ reply: extracted }, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true',
          }
        });
      }
      
      const collected = collectStringsFromUnknown(parsed);
      if (collected.length > 0) {
        const joined = collected.join(' ').slice(0, 4000);
        console.log('[api/chat] Using collected strings from text JSON:', {
          count: collected.length,
          length: joined.length
        });
        return NextResponse.json({ reply: joined }, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true',
          }
        });
      }
      
      // Friendly fallback when parsed JSON has no usable strings
      console.warn('[api/chat] No usable strings found in parsed text JSON, returning fallback');
      return NextResponse.json({ reply: 'Sorry, I could not generate a response at the moment. Please try again or rephrase your question.' }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true',
        }
      });
    } catch (parseError) {
      // Not JSON, return as JSON-wrapped reply string
      console.log('[api/chat] Text is not JSON, returning as plain text reply:', {
        parseError: parseError instanceof Error ? parseError.message : 'Unknown error',
        textLength: text.length
      });
      return NextResponse.json({ reply: text }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true',
        }
      });
    }
  } catch (error: unknown) {
    console.error('[api/chat] Webhook error:', error);
    
    // If upstream throws (network/DNS/TLS), catch and return
    return NextResponse.json({ error: 'Failed to connect to webhook', code: 'WEBHOOK_CONNECTION_ERROR' }, {
      status: 502,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
      }
    });
  }
}

// Handle GET requests (optional)
export async function GET() {
  return new NextResponse(
    JSON.stringify({
      message: 'Chat API endpoint. Use POST to send messages.'
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        // CORS: allow requests from the same origin and n8n domain
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
      },
    }
  );
}

// Handle OPTIONS requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Session-ID, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}