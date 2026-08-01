import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Disable response size limit for streaming
export const fetchCache = 'force-no-store';

async function proxyRequest(
  request: NextRequest,
  method: string
): Promise<Response> {
  const agentUrl = process.env.AGENT_URL || 'http://localhost:8090';

  const url = new URL(request.url);
  const path = url.pathname.replace('/api', '');
  // Health and auth endpoints are at root; everything else lives under /api on the agent.
  const isAuth = path.startsWith('/auth/');
  const targetPath = path === '/health' || isAuth ? path : `/api${path}`;
  const targetUrl = `${agentUrl}${targetPath}${url.search}`;

  const isSSE =
    path === '/events' ||
    path === '/events/poll' ||
    path === '/nettest/speedtest' ||
    path === '/nettest/streaming';

  const headers: Record<string, string> = {
    'Accept': isSSE ? 'text/event-stream' : 'application/json',
  };

  // Forward the user's Authorization header — never inject a shared service key.
  // EventSource clients can't set headers; they pass the JWT via ?token= which the
  // agent's middleware also accepts (see middleware.go AuthMiddleware).
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    headers['Authorization'] = authHeader;
  }

  const contentType = request.headers.get('content-type');
  if (contentType) {
    headers['Content-Type'] = contentType;
  }

  if (isSSE) {
    headers['Cache-Control'] = 'no-cache';
    // Don't set Connection header - HTTP/2 doesn't use it
  }

  try {
    // Build fetch options - SSE needs special handling
    const fetchOptions: RequestInit = {
      method,
      headers,
      cache: 'no-store',
      // @ts-expect-error - duplex is needed for streaming
      duplex: 'half',
    };

    // Include body for methods that support it
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      const body = await request.text();
      if (body) {
        fetchOptions.body = body;
      }
    }

    const response = await fetch(targetUrl, fetchOptions);

    // Check if this is an SSE response
    const responseIsSSE = response.headers.get('content-type')?.includes('text/event-stream');

    if (responseIsSSE && response.body) {
      console.log('[SSE] Streaming response from agent');

      // For HTTP/2 compatibility, pass through the response body directly
      // This avoids issues with ReadableStream wrapping that can cause protocol errors
      return new Response(response.body, {
        status: response.status,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-store, no-transform, must-revalidate',
          'X-Accel-Buffering': 'no',
          'X-Content-Type-Options': 'nosniff',
          // Don't set Connection or Transfer-Encoding - HTTP/2 handles these differently
        },
      });
    }

    // Pass the upstream status code through verbatim — collapsing every error
    // into 500 used to break the session-expired flow in fetchApi (which only
    // redirects on 401). Also handle empty/non-JSON bodies, which the agent
    // returns for some mutation responses; `response.json()` on an empty body
    // throws and falls into the catch, dropping the real status.
    const text = await response.text();
    let parsed: unknown = {};
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { raw: text };
      }
    }

    return NextResponse.json(parsed, {
      status: response.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Proxy error:', error);

    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { error: 'Agent is not reachable. Make sure the agent is running on your Mac.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Proxy error' },
      { status: 502 }
    );
  }
}

export async function GET(request: NextRequest) {
  return proxyRequest(request, 'GET');
}

export async function POST(request: NextRequest) {
  return proxyRequest(request, 'POST');
}

export async function PUT(request: NextRequest) {
  return proxyRequest(request, 'PUT');
}

export async function DELETE(request: NextRequest) {
  return proxyRequest(request, 'DELETE');
}

export async function PATCH(request: NextRequest) {
  return proxyRequest(request, 'PATCH');
}
