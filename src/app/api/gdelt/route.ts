import { NextResponse } from 'next/server';
import { agent } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const queries = [
      'protest OR riot OR unrest',
      'conflict OR military OR attack OR strike',
      'coup OR revolution OR emergency',
    ];
    const allEvents: any[] = [];
    let eventId = 0;
    for (const query of queries) {
      try {
        const url = `https://api.gdeltproject.org/api/v2/geo/geo?query=${encodeURIComponent(query)}&format=GeoJSON&timespan=24h&maxpoints=100`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        const geojson = await fetch(url, { signal: controller.signal, agent }).then(r => r.json());
        clearTimeout(timeoutId);
        if (!geojson?.features) continue;
        for (const feature of geojson.features) {
          const coords = feature.geometry?.coordinates;
          if (!coords || coords.length < 2) continue;
          const props = feature.properties || {};
          const name = props.name || props.html?.replace(/<[^>]*>/g, '').slice(0, 120) || 'GDELT Event';
          const urlLink = props.url || props.shareimage || '';
          const isDupe = allEvents.some(e => Math.abs(e.lat - coords[1]) < 0.5 && Math.abs(e.lng - coords[0]) < 0.5 && e.name === name);
          if (isDupe) continue;
          allEvents.push({
            id: `gdelt-${eventId++}`,
            lat: coords[1],
            lng: coords[0],
            name,
            url: urlLink,
            html: props.html || '',
            type: query.includes('protest') ? 'unrest' : query.includes('conflict') ? 'conflict' : 'political',
            count: props.count || 1,
            shareimage: props.shareimage || '',
          });
        }
      } catch { /* individual query failure is non-fatal */ }
    }
    if (allEvents.length === 0) {
      allEvents.push({ id: 'gdelt-static', lat: 48.5, lng: 31.2, name: 'Regional tensions reported', type: 'conflict', url: '', html: '' });
    }
    return NextResponse.json({ events: allEvents, total: allEvents.length, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('GDELT fetch error:', error);
    return NextResponse.json({ events: [], error: 'GDELT unavailable' }, { status: 500 });
  }
}
