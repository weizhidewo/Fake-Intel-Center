import { NextResponse } from 'next/server';
import { agent } from '@/lib/proxy';

export async function GET() {
  try {
    const res = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson', {
      signal: AbortSignal.timeout(30000),
      agent,
    });
    if (!res.ok) return NextResponse.json({ earthquakes: [], error: 'USGS unavailable' });
    const data = await res.json();
    const earthquakes = (data.features || []).map((f: any) => {
      const coords = f.geometry?.coordinates || [0, 0, 0];
      const props = f.properties || {};
      return {
        id: f.id,
        lat: coords[1],
        lng: coords[0],
        depth: coords[2],
        magnitude: props.mag,
        place: props.place,
        time: props.time,
        url: props.url,
        tsunami: props.tsunami,
        type: props.type,
        felt: props.felt,
        alert: props.alert,
      };
    });
    return NextResponse.json({ earthquakes, total: earthquakes.length, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Earthquake fetch error:', error);
    return NextResponse.json({ earthquakes: [], error: 'Failed to fetch earthquake data' }, { status: 500 });
  }
}
