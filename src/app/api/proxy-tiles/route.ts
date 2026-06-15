import { NextRequest, NextResponse } from 'next/server';
import { agent } from '@/lib/proxy';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(url, {
      signal: controller.signal,
      agent,
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      return new NextResponse('Upstream error', { status: res.status });
    }
    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('Proxy error:', err);
    return NextResponse.json({ error: 'Proxy fetch failed' }, { status: 500 });
  }
}
