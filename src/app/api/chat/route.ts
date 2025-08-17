import { NextRequest, NextResponse } from 'next/server';
import { isRateLimited, getRateLimitHeaders } from '@/lib/rateLimit';

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
        },
      }
    );
  }

  // Get session ID from request body
  let body;
  try {
    body = await request.json();
  } catch (error) {
    return new NextResponse(
      JSON.stringify({
        error: 'Invalid JSON in request body',
        code: 'INVALID_JSON'
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
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
          ...headers,
        },
      }
    );
  }

  try {
    // Get the webhook URL from environment variables with fallback
    const raw = process.env.N8N_WEBHOOK_URL ?? 'https://ceit.app.n8n.cloud/webhook/5f1c0c82-0ff9-40c7-9e2e-b1a96ffe24cd/chat';
    const url = raw.trim();
    try { new URL(url); } catch {
      console.error('[api/chat] Invalid webhook URL:', { raw });
      return NextResponse.json({ error: 'Invalid webhook URL', code: 'BAD_WEBHOOK_URL' }, { status: 500 });
    }
    
    // Map payload according to specifications
    const payload = {
      chatId: sessionId,
      chatInput: message,
      action: 'sendMessage',
      source: 'web',
      ...(metadata && typeof metadata === 'object' ? metadata : {})
    };

    // Fetch with proper error handling
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // Log the response status
    console.log('[api/chat] POST →', url, { status: upstream.status });

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
    
    // If content-type includes application/json, return NextResponse.json(await upstream.json())
    const contentType = upstream.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const json = await upstream.json();
      return NextResponse.json(json);
    }
    
    // Else, stream or return text
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'Content-Type': 'text/plain' }
    });
  } catch (error: any) {
    console.error('[api/chat] Webhook error:', error);
    
    // If upstream throws (network/DNS/TLS), catch and return
    return NextResponse.json({ error: 'Failed to connect to webhook', code: 'WEBHOOK_CONNECTION_ERROR' }, { status: 502 });
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
        // CORS: allow same-origin only
        'Access-Control-Allow-Origin': 'same-origin',
      },
    }
  );
}

// Handle OPTIONS requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': 'same-origin',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Session-ID',
    },
  });
}