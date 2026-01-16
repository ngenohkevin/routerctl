import { NextRequest, NextResponse } from 'next/server';

async function proxyRequest(
  request: NextRequest,
  method: string
): Promise<NextResponse> {
  // Read env vars at request time to ensure they're loaded
  const agentUrl = process.env.AGENT_URL || 'http://localhost:8090';
  const agentApiKey = process.env.AGENT_API_KEY || '';

  const url = new URL(request.url);
  // Remove the /api prefix from Next.js route
  const path = url.pathname.replace('/api', '');
  // Health endpoint is at root, all others under /api on the agent
  const targetPath = path === '/health' ? '/health' : `/api${path}`;
  const targetUrl = `${agentUrl}${targetPath}${url.search}`;

  console.log(`[Proxy] ${method} ${targetUrl} (API key: ${agentApiKey ? 'set' : 'not set'})`);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (agentApiKey) {
    headers['Authorization'] = `Bearer ${agentApiKey}`;
  }

  // Forward relevant headers from original request
  const contentType = request.headers.get('content-type');
  if (contentType) {
    headers['Content-Type'] = contentType;
  }

  try {
    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    // Include body for methods that support it
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      const body = await request.text();
      if (body) {
        fetchOptions.body = body;
      }
    }

    const response = await fetch(targetUrl, fetchOptions);

    // Check if this is an SSE request
    const isSSE = response.headers.get('content-type')?.includes('text/event-stream');

    if (isSSE) {
      // Stream SSE responses
      return new NextResponse(response.body, {
        status: response.status,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
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
