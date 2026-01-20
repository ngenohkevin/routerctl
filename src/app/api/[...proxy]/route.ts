import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Disable response size limit for streaming
export const fetchCache = 'force-no-store';

async function proxyRequest(
  request: NextRequest,
  method: string
): Promise<Response> {
  // Read env vars at request time to ensure they're loaded
  const agentUrl = process.env.AGENT_URL || 'http://localhost:8090';
  const agentApiKey = process.env.AGENT_API_KEY || '';

  const url = new URL(request.url);
  // Remove the /api prefix from Next.js route
  const path = url.pathname.replace('/api', '');
  // Health endpoint is at root, all others under /api on the agent
  const targetPath = path === '/health' ? '/health' : `/api${path}`;
  const targetUrl = `${agentUrl}${targetPath}${url.search}`;

  // Check if this is an SSE request
  const isSSE = path === '/events';

  console.log(`[Proxy] ${method} ${targetUrl} (SSE: ${isSSE}, API key: ${agentApiKey ? 'set' : 'not set'})`);

  const headers: Record<string, string> = {
    'Accept': isSSE ? 'text/event-stream' : 'application/json',
  };

  if (agentApiKey) {
    headers['Authorization'] = `Bearer ${agentApiKey}`;
  }

  // Forward relevant headers from original request
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

    // Regular JSON response
    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    console.error('Proxy error:', error);

    // Check if it's a connection error
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { error: 'Agent is not reachable. Make sure the agent is running on your Mac.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Proxy error' },
      { status: 500 }
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
