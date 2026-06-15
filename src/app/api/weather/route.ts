import { NextResponse } from 'next/server';
import { agent } from '@/lib/proxy';

type Severity = 'low' | 'medium' | 'high';
type WeatherEvent = {
  id: string; title: string; category: string; type: string; icon: string;
  severity: Severity; lat: number; lng: number; date?: string; expires?: string;
  area?: string; source: string; provider: 'NASA EONET' | 'NOAA/NWS';
};

export async function GET() {
  try {
    const [eonetRes, nwsRes] = await Promise.allSettled([
      fetch('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=100', {
        signal: AbortSignal.timeout(30000), agent,
      }),
      fetch('https://api.weather.gov/alerts/active?status=actual&message_type=alert', {
        headers: { Accept: 'application/geo+json', 'User-Agent': 'OSIRIS Severe Weather Layer' },
        signal: AbortSignal.timeout(30000), agent,
      }),
    ]);

    const events: WeatherEvent[] = [];
    let providerSucceeded = false;

    if (eonetRes.status === 'fulfilled' && eonetRes.value.ok) {
      const data = await eonetRes.value.json();
      providerSucceeded = true;
      for (const event of data.events || []) {
        const geom = event.geometry?.[event.geometry.length - 1];
        if (!geom || geom.type !== 'Point' || !geom.coordinates) continue;
        const category = event.categories?.[0]?.id || 'unknown';
        if (category === 'wildfires') continue;
        let typeLabel = 'Event', icon = 'alert', severity: Severity = 'low';
        if (category === 'severeStorms') { typeLabel = 'Severe Storm'; icon = 'cyclone'; severity = 'high'; }
        else if (category === 'volcanoes') { typeLabel = 'Volcano Eruption'; icon = 'volcano'; severity = 'high'; }
        else if (category === 'seaIce') { typeLabel = 'Iceberg / Sea Ice'; icon = 'ice'; severity = 'medium'; }
        else typeLabel = event.categories?.[0]?.title || 'Anomaly';
        events.push({
          id: `eonet-${event.id}`, title: event.title, category, type: typeLabel, icon, severity,
          lat: geom.coordinates[1], lng: geom.coordinates[0], date: geom.date,
          source: event.sources?.[0]?.url || 'NASA EONET', provider: 'NASA EONET',
        });
      }
    }

    if (nwsRes.status === 'fulfilled' && nwsRes.value.ok) {
      const data = await nwsRes.value.json();
      providerSucceeded = true;
      for (const feature of data.features || []) {
        const props = feature.properties || {};
        let coords = null;
        const geom = feature.geometry;
        if (geom?.type === 'Point') {
          const [lng, lat] = geom.coordinates;
          coords = { lat, lng };
        } else if (geom?.type === 'Polygon' && geom.coordinates?.[0]?.length) {
          const points = geom.coordinates[0];
          let sumLat = 0, sumLng = 0;
          for (const p of points) { sumLng += p[0]; sumLat += p[1]; }
          coords = { lat: sumLat / points.length, lng: sumLng / points.length };
        } else if (geom?.type === 'MultiPolygon' && geom.coordinates?.[0]?.[0]?.length) {
          const points = geom.coordinates[0][0];
          let sumLat = 0, sumLng = 0;
          for (const p of points) { sumLng += p[0]; sumLat += p[1]; }
          coords = { lat: sumLat / points.length, lng: sumLng / points.length };
        }
        if (!coords) continue;
        let severity: Severity = 'low';
        if (props.severity === 'Extreme' || props.severity === 'Severe') severity = 'high';
        else if (props.severity === 'Moderate') severity = 'medium';
        events.push({
          id: `nws-${props.id || props['@id'] || props.event || coords.lat}`,
          title: props.headline || props.event || 'NWS Weather Alert',
          category: 'weatherAlerts', type: props.event || 'Weather Alert', icon: 'weather', severity,
          lat: coords.lat, lng: coords.lng, date: props.effective || props.sent,
          expires: props.expires, area: props.areaDesc,
          source: props['@id'] || 'https://api.weather.gov/alerts/active', provider: 'NOAA/NWS',
        });
      }
    }

    if (!providerSucceeded) return NextResponse.json({ events: [], error: 'Failed to fetch weather data' }, { status: 500 });
    return NextResponse.json({ events, total: events.length, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Weather API error:', error);
    return NextResponse.json({ events: [], error: 'Failed to fetch weather data' }, { status: 500 });
  }
}
