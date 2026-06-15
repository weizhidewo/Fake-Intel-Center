import { NextResponse } from 'next/server';

const BACKEND_URL = 'http://localhost:8080';
const AUTH_TOKEN = 'my-fixed-scanner-key-32-bytes-long';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get('domain');

  if (!domain) {
    return NextResponse.json({ error: 'Missing domain parameter' }, { status: 400 });
  }

  try {
    // 调用后端 /scan/dns 接口
    const backendUrl = `${BACKEND_URL}/scan/dns?target=${encodeURIComponent(domain)}`;
    const res = await fetch(backendUrl, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` },
      cache: 'no-store'
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Backend DNS error: ${res.status} - ${errorText}`);
      return NextResponse.json({ domain, records: {}, error: `Backend error: ${res.status}` }, { status: 500 });
    }

    const data = await res.json();
    // 转换格式为前端期望的 { domain, records: { A, MX, NS, ... } }
    // 后端返回格式: { domain, records: { A, AAAA, MX, NS, TXT, CNAME } }
    const records = data.records || {};

    // 构建 summary 以兼容前端可能存在的旧代码
    const summary = {
      ip_addresses: records.A || [],
      mail_servers: (records.MX || []).map((mx: string) => {
        const parts = mx.split(' ');
        return parts.length > 1 ? parts[1] : parts[0];
      }),
      nameservers: records.NS || [],
      total_records: (records.A?.length || 0) + (records.AAAA?.length || 0) + (records.MX?.length || 0) + (records.NS?.length || 0) + (records.TXT?.length || 0) + (records.CNAME?.length || 0)
    };

    return NextResponse.json({
      domain: data.domain || domain,
      records,
      timestamp: new Date().toISOString(),
      summary
    });
  } catch (err: any) {
    console.error('DNS proxy error:', err);
    return NextResponse.json({ error: err.message, domain, records: {} }, { status: 500 });
  }
}
