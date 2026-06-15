'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { Crosshair, Loader2, Layers, BarChart3, Newspaper, Search, X, Globe, MapPinned, Radar, Satellite, Moon, ExternalLink, AlertTriangle, Activity, Database, Wifi, Play, Network, Sparkles, ShieldAlert } from 'lucide-react';
import IntelFeed from '@/components/IntelFeed';
import MarketsPanel from '@/components/MarketsPanel';
import ScmPanel from '@/components/ScmPanel';
import SearchBar from '@/components/SearchBar';
import ScaleBar from '@/components/ScaleBar';
import ErrorBoundary from '@/components/ErrorBoundary';
import SharePanel from '@/components/SharePanel';
import ViewPresets from '@/components/ViewPresets';
import KeyboardShortcuts from '@/components/KeyboardShortcuts';
import GlobalStatusBar from '@/components/GlobalStatusBar';
import LiveAlerts from '@/components/LiveAlerts';
import AiSidePanel from '@/components/AiSidePanel';
import SecurityPanel from '@/components/SecurityPanel';

const OsirisMap = dynamic(() => import('@/components/OsirisMap'), { ssr: false });
const LayerPanel = dynamic(() => import('@/components/LayerPanel'));
const CameraViewer = dynamic(() => import('@/components/CameraViewer'));
const OsintPanel = dynamic(() => import('@/components/OsintPanel'));
const EntityGraphPanel = dynamic(() => import('@/components/EntityGraphPanel'));

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setIsMobile(w < 768 || (h < 500 && w < 1024));
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);
  return isMobile;
}

const UptimeClock = () => {
  const [uptime, setUptime] = useState('00:00:00');
  const startTime = useRef(0);
  if (startTime.current === 0) startTime.current = Date.now();
  useEffect(() => {
    const iv = setInterval(() => {
      const e = Math.floor((Date.now() - startTime.current) / 1000);
      setUptime(`${String(Math.floor(e/3600)).padStart(2,'0')}:${String(Math.floor((e%3600)/60)).padStart(2,'0')}:${String(e%60).padStart(2,'0')}`);
    }, 1000);
    return () => clearInterval(iv);
  }, []);
  return <span className="hidden lg:inline">运行时间: <span className="text-[var(--gold-primary)]">{uptime}</span></span>;
};

const ZuluClock = () => {
  const [time, setTime] = useState('');
  useEffect(() => {
    const iv = setInterval(() => {
      const now = new Date();
      setTime(`UTC时间 ${String(now.getUTCHours()).padStart(2,'0')}:${String(now.getUTCMinutes()).padStart(2,'0')}:${String(now.getUTCSeconds()).padStart(2,'0')}Z`);
    }, 1000);
    return () => clearInterval(iv);
  }, []);
  return <span className="text-[var(--cyan-primary)] font-bold tabular-nums">{time || 'UTC时间 --:--:--Z'}</span>;
};

const ActiveEntityCount = ({ data }: { data: Record<string, unknown[]> }) => {
  const count = useMemo(() => {
    if (!data) return 0;
    return Object.values(data).reduce((sum, v) => sum + (Array.isArray(v) ? v.length : 0), 0);
  }, [data]);
  return <span className="text-[var(--alert-green)] font-bold tabular-nums">{count.toLocaleString()}</span>;
};

function getYouTubeWatchUrl(url: string): string {
  if (url.includes('channel=')) return `https://www.youtube.com/channel/${url.split('channel=')[1].split('&')[0]}/live`;
  if (url.includes('/embed/')) return `https://www.youtube.com/watch?v=${url.split('/embed/')[1].split('?')[0]}`;
  return url;
}

export default function Dashboard() {
  const dataRef = useRef<any>({});
  const [dataVersion, setDataVersion] = useState(0);
  const data = dataRef.current;

  const [backendStatus, setBackendStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [mapView, setMapView] = useState({ zoom: 2.5, latitude: 20 });
  const [flyToLocation, setFlyToLocation] = useState<{ lat: number; lng: number; ts: number } | null>(null);
  const [globalStats, setGlobalStats] = useState<any>(null);
  const mouseCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const coordsDisplayRef = useRef<HTMLDivElement>(null);
  const [locationLabel, setLocationLabel] = useState('');
  const [regionDossier, setRegionDossier] = useState<any>(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [activeCamera, setActiveCamera] = useState<any>(null);
  const [spaceWeather, setSpaceWeather] = useState<any>(null);
  const [showLayers, setShowLayers] = useState(true);
  const [showMarkets, setShowMarkets] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [showScmPanel, setShowScmPanel] = useState(true);
  const [showIntel, setShowIntel] = useState(false);
  const [showEntityGraph, setShowEntityGraph] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [showSecurityPanel, setShowSecurityPanel] = useState(false);
  const [showSecurityPanelMobile, setShowSecurityPanelMobile] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'layers'|'markets'|'intel'|'search'|'recon'|null>(null);
  const [mapProjection, setMapProjection] = useState<'globe'|'mercator'>('globe');
  const [mapStyle, setMapStyle] = useState<'dark'|'satellite'>('dark');
  const [sweepData, setSweepData] = useState<any>(null);
  const [scanTargets, setScanTargets] = useState<any[]>([]);
  const [entityGraphTarget, setEntityGraphTarget] = useState<{ type: string; id: string; label?: string; properties?: Record<string, any> } | null>(null);
  const [demoMode, setDemoMode] = useState(false);

  const isMobile = useIsMobile();
  const geocodeCache = useRef<Map<string, string>>(new Map());
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastGeocodedPos = useRef<{ lat: number; lng: number } | null>(null);

  const [activeLayers, setActiveLayers] = useState({
    flights: false,
    private: false,
    jets: false,
    military: false,
    maritime: true,
    satellites: false,
    balloons: false,
    cctv: true,
    live_news: true,
    news_intel: true,
    earthquakes: true,
    fires: false,
    weather: false,
    radiation: false,
    infrastructure: false,
    global_incidents: true,
    war_alerts: false,
    gps_jamming: false,
    day_night: true,
    cables: true,
    sdk_sea: true,
    sdk_air: true,
    sdk_naval: true,
    malware: false,
  });
  const [liveFeedUrl, setLiveFeedUrl] = useState<string | null>(null);
  const [liveFeedName, setLiveFeedName] = useState('');
  const [liveFeedEmbedAllowed, setLiveFeedEmbedAllowed] = useState(true);

  useEffect(() => {
    const splashTimer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(splashTimer);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams(window.location.search);
    const lat = parseFloat(p.get('lat') || '');
    const lon = parseFloat(p.get('lon') || '');
    const zoom = parseFloat(p.get('zoom') || '');
    if (!isNaN(lat) && !isNaN(lon)) {
      setFlyToLocation({ lat, lng: lon, ts: Date.now() });
      if (!isNaN(zoom)) setMapView(v => ({ ...v, zoom }));
    }
    const layers = p.get('layers');
    if (layers) {
      const active = layers.split(',');
      setActiveLayers(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => { (next as any)[k] = active.includes(k); });
        return next;
      });
    }
  }, []);

  const urlTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (urlTimer.current) clearTimeout(urlTimer.current);
    urlTimer.current = setTimeout(() => {
      const p = new URLSearchParams();
      p.set('lat', (mapView.latitude ?? 20).toFixed(4));
      p.set('lon', '0');
      p.set('zoom', mapView.zoom.toFixed(2));
      const active = Object.entries(activeLayers).filter(([,v]) => v).map(([k]) => k).join(',');
      p.set('layers', active);
      const url = `${window.location.pathname}?${p.toString()}`;
      window.history.replaceState(null, '', url);
    }, 1500);
  }, [mapView, activeLayers]);

  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(d => {
        if (d.stats) setGlobalStats(d.stats);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as Element)?.tagName)) return;
      if (e.key === 'f' && !e.ctrlKey) {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen();
      }
      if (e.key === 'l') setShowLayers(p => !p);
      if (e.key === 'm') setShowMarkets(p => !p);
      if (e.key === 'c') setShowScmPanel(p => !p);
      if (e.key === 'i') setShowIntel(p => !p);
      if (e.key === 'r') setFlyToLocation({ lat: 20, lng: 0, ts: Date.now() });
      if (e.key === 'g') setMapProjection(p => p === 'globe' ? 'mercator' : 'globe');
    };
    const fsHandler = () => setIsFullscreen(!!document.fullscreenElement);
    window.addEventListener('keydown', handler);
    document.addEventListener('fullscreenchange', fsHandler);
    return () => {
      window.removeEventListener('keydown', handler);
      document.removeEventListener('fullscreenchange', fsHandler);
    };
  }, []);

  const handleMouseCoords = useCallback((coords: { lat: number; lng: number }) => {
    mouseCoordsRef.current = coords;
    if (coordsDisplayRef.current) {
      coordsDisplayRef.current.innerText = `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
    }
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(async () => {
      if (lastGeocodedPos.current) {
        const d = Math.abs(coords.lat - lastGeocodedPos.current.lat) + Math.abs(coords.lng - lastGeocodedPos.current.lng);
        if (d < 0.5) return;
      }
      const gk = `${coords.lat.toFixed(1)},${coords.lng.toFixed(1)}`;
      if (geocodeCache.current.has(gk)) {
        setLocationLabel(geocodeCache.current.get(gk)!);
        lastGeocodedPos.current = coords;
        return;
      }
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${coords.lat}&lon=${coords.lng}&format=json&zoom=10&addressdetails=1`, { headers: { 'Accept-Language': 'zh-CN' } });
        if (res.ok) {
          const d = await res.json();
          const a = d.address || {};
          const label = [a.city||a.town||a.village||a.county, a.state||a.region, a.country].filter(Boolean).join(', ') || '未知位置';
          if (geocodeCache.current.size > 500) {
            const it = geocodeCache.current.keys();
            for (let i=0;i<100;i++) {
              const k = it.next().value;
              if(k) geocodeCache.current.delete(k);
            }
          }
          geocodeCache.current.set(gk, label);
          setLocationLabel(label);
          lastGeocodedPos.current = coords;
        }
      } catch (e) {
        console.warn('[OSIRIS] Suppressed error:', e instanceof Error ? e.message : e);
      }
    }, 3000);
  }, []);

  const handleRightClick = useCallback(async (coords: { lat: number; lng: number }) => {
    setDossierLoading(true);
    setRegionDossier(null);
    try {
      const res = await fetch(`/api/region-dossier?lat=${coords.lat}&lng=${coords.lng}`);
      if (res.ok) setRegionDossier(await res.json());
    } catch (e) {
      console.warn('[OSIRIS] Suppressed error:', e instanceof Error ? e.message : e);
    } finally {
      setDossierLoading(false);
    }
  }, []);

  const handleEntityClick = useCallback((entity: any) => {
    if (entity?.type === 'cctv') setActiveCamera(entity);
    if (entity?.type === 'live_news' && entity.url) {
      setLiveFeedUrl(entity.url);
      setLiveFeedName(entity.name);
      setLiveFeedEmbedAllowed(entity.embed_allowed !== false);
    }
  }, []);

  useEffect(() => {
    (window as any).openOsirisIntel = (entity: any) => {
      if (entity?.callsign || entity?.icao24) {
        setEntityGraphTarget({
          type: 'aircraft',
          id: entity.callsign?.trim() || entity.icao24,
          label: entity.callsign?.trim() || entity.icao24,
          properties: { model: entity.model, registration: entity.registration, icao24: entity.icao24 }
        });
        setShowEntityGraph(true);
      } else if (entity?.type === 'vessel' || entity?.mmsi || entity?.imo) {
        setEntityGraphTarget({
          type: 'vessel',
          id: entity.imo || entity.mmsi || entity.name,
          label: entity.name || entity.imo,
          properties: { flag: entity.flag, speed: entity.speed, destination: entity.destination }
        });
        setShowEntityGraph(true);
      } else if (entity?.type === 'ip' && entity?.ip) {
        setEntityGraphTarget({
          type: 'ip',
          id: entity.ip,
          label: entity.ip,
          properties: { threat_type: entity.threat_type, status: entity.status }
        });
        setShowEntityGraph(true);
      } else if (entity?.type === 'country' && entity?.country) {
        setEntityGraphTarget({
          type: 'country',
          id: entity.country,
          label: entity.country,
          properties: {}
        });
        setShowEntityGraph(true);
      }
    };
    return () => { delete (window as any).openOsirisIntel; };
  }, []);

  const fetchEndpoint = useCallback(async (url: string, transform?: (d: any) => any, options?: RequestInit) => {
    if (typeof document !== 'undefined' && document.hidden) return;
    try {
      const res = await fetch(url, { ...options, cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        const d = transform ? transform(json) : json;
        dataRef.current = { ...dataRef.current, ...d };
        setDataVersion(v => v + 1);
        setBackendStatus('connected');
      }
    } catch (e) {
      console.warn('[OSIRIS] Suppressed error:', e instanceof Error ? e.message : e);
      setBackendStatus('error');
    }
  }, []);

  useEffect(() => {
    fetchEndpoint('/api/earthquakes');
    fetchEndpoint('/api/news');
    const marketTimer = setTimeout(() => fetchEndpoint('/api/markets', d => ({ markets: d })), 800);

    const spaceTimer = setTimeout(async () => {
      try {
        const r = await fetch('/api/space-weather');
        if (r.ok) setSpaceWeather(await r.json());
      } catch (e) {
        console.warn('[OSIRIS] Suppressed error:', e instanceof Error ? e.message : e);
      }
    }, 5000);

    const intervals = [
      setInterval(() => fetchEndpoint('/api/earthquakes'), 900000),
      setInterval(() => fetchEndpoint('/api/news'), 1800000),
      setInterval(() => fetchEndpoint('/api/markets', d => ({ markets: d })), 900000),
    ];
    return () => {
      clearTimeout(marketTimer);
      clearTimeout(spaceTimer);
      intervals.forEach(clearInterval);
    };
  }, [fetchEndpoint]);

  const layerFetchedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (activeLayers.flights || activeLayers.military || activeLayers.jets || activeLayers.private) {
      if (!layerFetchedRef.current.has('flights')) {
        fetchEndpoint('/api/flights');
        layerFetchedRef.current.add('flights');
      }
    }
    if (activeLayers.satellites && !layerFetchedRef.current.has('satellites')) {
      fetchEndpoint('/api/satellites');
      layerFetchedRef.current.add('satellites');
    }
    if (activeLayers.fires && !layerFetchedRef.current.has('fires')) {
      fetchEndpoint('/api/fires');
      layerFetchedRef.current.add('fires');
    }
    if (activeLayers.cctv && !layerFetchedRef.current.has('cctv')) {
      fetchEndpoint('/api/cctv?region=all&v=2');
      layerFetchedRef.current.add('cctv');
    }
    if (activeLayers.maritime && !layerFetchedRef.current.has('maritime')) {
      fetchEndpoint('/api/maritime', d => ({ maritime_ports: d.ports, maritime_chokepoints: d.chokepoints, maritime_ships: d.ships }));
      layerFetchedRef.current.add('maritime');
    }
    if (activeLayers.balloons && !layerFetchedRef.current.has('balloons')) {
      fetchEndpoint('/api/balloons', d => ({ balloons: d.balloons }));
      layerFetchedRef.current.add('balloons');
    }
    if (activeLayers.radiation && !layerFetchedRef.current.has('radiation')) {
      fetchEndpoint('/api/radiation', d => ({ radiation: d.stations }));
      layerFetchedRef.current.add('radiation');
    }
    if (activeLayers.live_news && !layerFetchedRef.current.has('live_news')) {
      fetchEndpoint('/api/live-news', d => ({ live_feeds: d.feeds }));
      layerFetchedRef.current.add('live_news');
    }
    if (activeLayers.weather && !layerFetchedRef.current.has('weather')) {
      fetchEndpoint('/api/weather', d => ({ weather_events: d.events }));
      layerFetchedRef.current.add('weather');
    }
    if (activeLayers.infrastructure && !layerFetchedRef.current.has('infrastructure')) {
      fetchEndpoint('/api/infrastructure', d => ({ infrastructure: d.infrastructure }));
      layerFetchedRef.current.add('infrastructure');
    }
    if (activeLayers.global_incidents && !layerFetchedRef.current.has('gdelt')) {
      fetchEndpoint('/api/gdelt', d => ({ gdelt: d.events }));
      layerFetchedRef.current.add('gdelt');
    }
    if (activeLayers.cables && !layerFetchedRef.current.has('cables')) {
      (async () => {
        try {
          const ts = Date.now();
          const res = await fetch(`/data/submarine-cables.json?v=${ts}`);
          if (res.ok) {
            const cablesData = await res.json();
            dataRef.current = { ...dataRef.current, submarine_cables: cablesData.features };
            setDataVersion(v => v + 1);
          }
        } catch (e) {
          console.warn('Cables fetch failed');
        }
      })();
      layerFetchedRef.current.add('cables');
    }
    if (activeLayers.malware && !layerFetchedRef.current.has('malware')) {
      fetchEndpoint('/api/malware', d => ({ malware_threats: d.threats }));
      layerFetchedRef.current.add('malware');
    }
  }, [activeLayers, fetchEndpoint]);

  useEffect(() => {
    const intervals: ReturnType<typeof setInterval>[] = [];
    if (activeLayers.flights || activeLayers.military || activeLayers.jets || activeLayers.private) {
      intervals.push(setInterval(() => fetchEndpoint('/api/flights'), 300000));
    }
    if (activeLayers.balloons) {
      intervals.push(setInterval(() => fetchEndpoint('/api/balloons', d => ({ balloons: d.balloons })), 300000));
    }
    if (activeLayers.radiation) {
      intervals.push(setInterval(() => fetchEndpoint('/api/radiation', d => ({ radiation: d.stations })), 300000));
    }
    if (activeLayers.maritime) {
      intervals.push(setInterval(() => fetchEndpoint('/api/maritime', d => ({ maritime_ports: d.ports, maritime_chokepoints: d.chokepoints, maritime_ships: d.ships })), 10000));
    }
    return () => intervals.forEach(clearInterval);
  }, [activeLayers, fetchEndpoint]);

  useEffect(() => {
    const anyActive = activeLayers.sdk_sea || activeLayers.sdk_air || activeLayers.sdk_naval;
    if (!anyActive) {
      dataRef.current = { ...dataRef.current, sdk_entities: [] };
      return;
    }

    const sdkEntities: any[] = [];

    const allFlights = [
      ...(data.commercial_flights || []),
      ...(data.private_flights || []),
      ...(data.private_jets || []),
      ...(data.military_flights || []),
    ];
    const flightStep = Math.max(1, Math.floor(allFlights.length / 60));
    for (let i = 0; i < allFlights.length; i += flightStep) {
      const f = allFlights[i];
      if (!f.lat || !f.lng) continue;
      sdkEntities.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [f.lng, f.lat] },
        properties: { domain: 'AIR', name: f.callsign?.trim() || 'TRACK', source: 'ADS-B / OpenSky' },
      });
    }

    const ships = data.maritime_ships || [];
    const shipStep = Math.max(1, Math.floor(ships.length / 60));
    for (let i = 0; i < ships.length; i += shipStep) {
      const s = ships[i];
      if (!s.lat || !s.lng) continue;
      sdkEntities.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
        properties: { domain: 'SEA', name: s.name || `MMSI-${s.mmsi}`, source: 'AIS Stream' },
      });
    }

    if (data.earthquakes?.length) {
      for (const eq of data.earthquakes) {
        if (!eq.lat || !eq.lng) continue;
        sdkEntities.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [eq.lng, eq.lat] },
          properties: { domain: 'LAND', name: `M${eq.magnitude} ${eq.place || ''}`, source: 'USGS' },
        });
      }
    }

    if (data.gdelt?.length) {
      for (const g of data.gdelt) {
        if (!g.lat || !g.lng) continue;
        sdkEntities.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [g.lng, g.lat] },
          properties: { domain: 'INTEL', name: g.name || 'GDELT Event', source: 'GDELT Project' },
        });
      }
    }

    if (data.news?.length) {
      for (const n of data.news) {
        if (!n.coords || n.coords.length < 2) continue;
        sdkEntities.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [n.coords[1], n.coords[0]] },
          properties: { domain: 'INTEL', name: n.title || 'SIGINT', source: n.source || 'RSS Feed' },
        });
      }
    }

    dataRef.current = { ...dataRef.current, sdk_entities: sdkEntities };
  }, [dataVersion, activeLayers.sdk_sea, activeLayers.sdk_air, activeLayers.sdk_naval]);

  const totalFlights = useMemo(
    () =>
      (data.commercial_flights?.length || 0) +
      (data.private_flights?.length || 0) +
      (data.private_jets?.length || 0) +
      (data.military_flights?.length || 0),
    [data.commercial_flights, data.private_flights, data.private_jets, data.military_flights]
  );

  // 后端状态中文映射
  const getBackendStatusText = () => {
    switch (backendStatus) {
      case 'connected': return '在线';
      case 'connecting': return '连接中';
      case 'error': return '错误';
      default: return backendStatus;
    }
  };

  return (
    <main className="fixed inset-0 w-full h-full bg-[var(--bg-void)] overflow-hidden">
      <AnimatePresence>
        {showSplash && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
            className="absolute inset-0 z-[999] flex flex-col items-center justify-center overflow-hidden"
            style={{ background: 'radial-gradient(ellipse at center, #0a0a14 0%, var(--bg-void) 70%)' }}
          >
            <div className="absolute inset-0 pointer-events-none z-[1]" style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(212,175,55,0.015) 2px, rgba(212,175,55,0.015) 4px)',
              animation: 'splashScanDrift 8s linear infinite',
            }} />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="absolute top-6 left-6 z-[2] font-mono text-[10px] tracking-[0.3em] text-[var(--gold-primary)]"
            >
              V4.2
            </motion.div>
            <div className="relative w-40 h-40 mb-8 flex items-center justify-center z-[2]">
              <motion.div
                initial={{ opacity: 0, scale: 0.6, rotate: 0 }}
                animate={{ opacity: 1, scale: 1, rotate: 360 }}
                transition={{ opacity: { duration: 0.6 }, scale: { duration: 0.8, ease: 'easeOut' }, rotate: { duration: 20, repeat: Infinity, ease: 'linear' } }}
                className="absolute inset-0 rounded-full"
                style={{ border: '1px solid rgba(212,175,55,0.2)' }}
              >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full" style={{ background: 'var(--gold-primary)', boxShadow: '0 0 12px var(--gold-primary), 0 0 24px rgba(212,175,55,0.3)' }} />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-1 h-1 rounded-full" style={{ background: 'rgba(212,175,55,0.5)', boxShadow: '0 0 6px rgba(212,175,55,0.3)' }} />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0.4, rotate: 0 }}
                animate={{ opacity: 1, scale: 1, rotate: -360 }}
                transition={{ opacity: { duration: 0.6, delay: 0.15 }, scale: { duration: 0.8, delay: 0.15, ease: 'easeOut' }, rotate: { duration: 12, repeat: Infinity, ease: 'linear' } }}
                className="absolute rounded-full"
                style={{ inset: '18px', border: '1px solid rgba(0,229,255,0.15)' }}
              >
                <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--cyan-primary)', boxShadow: '0 0 10px var(--cyan-primary), 0 0 20px rgba(0,229,255,0.2)' }} />
                <div className="absolute bottom-0 left-1/4 translate-y-1/2 w-1 h-1 rounded-full" style={{ background: 'rgba(0,229,255,0.4)' }} />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0.2, rotate: 0 }}
                animate={{ opacity: 1, scale: 1, rotate: 360 }}
                transition={{ opacity: { duration: 0.6, delay: 0.3 }, scale: { duration: 0.8, delay: 0.3, ease: 'easeOut' }, rotate: { duration: 7, repeat: Infinity, ease: 'linear' } }}
                className="absolute rounded-full"
                style={{ inset: '40px', border: '1px solid rgba(212,175,55,0.25)' }}
              >
                <div className="absolute top-0 left-1/4 -translate-y-1/2 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--gold-primary)', boxShadow: '0 0 8px var(--gold-primary)' }} />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
                className="relative w-12 h-12 rounded-full flex items-center justify-center"
                style={{ border: '2px solid var(--gold-primary)', boxShadow: '0 0 20px rgba(212,175,55,0.15), inset 0 0 20px rgba(212,175,55,0.05)' }}
              >
                <motion.div
                  animate={{ opacity: [0.3, 0.8, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-5 h-5 rounded-full"
                  style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.4) 0%, rgba(212,175,55,0.05) 70%)' }}
                />
                <div className="absolute w-[1px] h-full" style={{ background: 'linear-gradient(to bottom, transparent, rgba(212,175,55,0.3), transparent)' }} />
                <div className="absolute w-full h-[1px]" style={{ background: 'linear-gradient(to right, transparent, rgba(212,175,55,0.3), transparent)' }} />
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.15, 0], rotate: [0, 360] }}
                transition={{ opacity: { duration: 3, repeat: Infinity }, rotate: { duration: 3, repeat: Infinity, ease: 'linear' }, delay: 0.6 }}
                className="absolute inset-[10px] rounded-full"
                style={{ background: 'conic-gradient(from 0deg, transparent 0deg, rgba(212,175,55,0.15) 40deg, transparent 80deg)' }}
              />
            </div>
            <div className="flex items-center gap-[2px] mb-3 z-[2]">
              {'虚假情报中心'.split('').map((letter, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ delay: 0.5 + i * 0.08, duration: 0.5, ease: 'easeOut' }}
                  className="text-4xl md:text-5xl font-bold tracking-[0.5em] font-mono"
                  style={{ color: 'var(--text-heading)', textShadow: '0 0 30px rgba(212,175,55,0.2)' }}
                >
                  {letter}
                </motion.span>
              ))}
            </div>
            <div className="overflow-hidden mb-8 z-[2]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ delay: 1.2, duration: 0.8, ease: 'easeInOut' }}
                className="overflow-hidden whitespace-nowrap"
              >
                <p className="text-[10px] md:text-[11px] font-mono tracking-[0.5em] text-[var(--gold-primary)]" style={{ opacity: 0.8 }}>
                  虚假情报中心
                </p>
              </motion.div>
            </div>
            <div className="w-64 md:w-80 z-[2]">
              <div className="relative w-full h-[2px] rounded-full overflow-hidden" style={{ background: 'rgba(212,175,55,0.1)' }}>
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: ['0%', '25%', '50%', '78%', '100%'] }}
                  transition={{ duration: 2.2, delay: 0.5, times: [0, 0.25, 0.5, 0.75, 1], ease: 'easeInOut' }}
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ background: 'linear-gradient(90deg, var(--gold-primary), var(--cyan-primary), var(--gold-primary))', boxShadow: '0 0 12px rgba(212,175,55,0.4)' }}
                />
              </div>
              <div className="mt-3 h-4 flex items-center justify-center">
                {[
                  { text: '建立安全连接...', delay: 0.5 },
                  { text: '初始化数据源...', delay: 1.1 },
                  { text: '校准传感器...', delay: 1.7 },
                  { text: '系统就绪', delay: 2.2 },
                ].map((stage, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 1, 0] }}
                    transition={{ delay: stage.delay, duration: 0.6, times: [0, 0.1, 0.7, 1] }}
                    className="absolute text-[9px] font-mono tracking-[0.25em]"
                    style={{ color: i === 3 ? 'var(--cyan-primary)' : 'var(--text-muted)' }}
                  >
                    {stage.text}
                  </motion.span>
                ))}
              </div>
            </div>
            <div className="absolute inset-0 pointer-events-none z-[0]" style={{ opacity: 0.03 }}>
              <div className="absolute inset-0" style={{
                backgroundImage: 'linear-gradient(rgba(212,175,55,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.5) 1px, transparent 1px)',
                backgroundSize: '60px 60px',
              }} />
            </div>
            {[
              { t: '10px', l: '10px', bw: '2px 0 0 2px' },
              { t: '10px', r: '10px', bw: '2px 2px 0 0' },
              { b: '10px', l: '10px', bw: '0 0 2px 2px' },
              { b: '10px', r: '10px', bw: '0 2px 2px 0' },
            ].map((pos, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.3 }}
                transition={{ delay: 0.8 + i * 0.1, duration: 0.5 }}
                className="absolute w-8 h-8 z-[2]"
                style={{ top: pos.t, bottom: pos.b, left: pos.l, right: pos.r, borderWidth: pos.bw, borderStyle: 'solid', borderColor: 'var(--gold-primary)' }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <ErrorBoundary name="Map">
        <OsirisMap
          data={data}
          activeLayers={activeLayers}
          projection={mapProjection}
          mapStyle={mapStyle === 'satellite' ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' : 'dark'}
          onEntityClick={handleEntityClick}
          onMouseCoords={handleMouseCoords}
          onRightClick={handleRightClick}
          onViewStateChange={setMapView}
          flyToLocation={flyToLocation}
          sweepData={sweepData}
          scanTargets={scanTargets}
          demoMode={demoMode}
        />
      </ErrorBoundary>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 3.5 }}
        className="absolute bottom-[75px] md:bottom-6 left-3 md:left-[315px] z-[200] flex items-center gap-2 pointer-events-none"
      >
        <button
          onClick={() => setMapProjection(p => p === 'globe' ? 'mercator' : 'globe')}
          className="glass-panel p-3.5 pointer-events-auto hover:border-[var(--gold-primary)]/40 transition-colors group relative"
          title={mapProjection === 'globe' ? '切换到平面地图' : '切换到3D地球仪'}
        >
          {mapProjection === 'globe' ? (
            <MapPinned className="w-5 h-5 text-[var(--gold-primary)] group-hover:scale-110 transition-transform" />
          ) : (
            <Globe className="w-5 h-5 text-[var(--cyan-primary)] group-hover:scale-110 transition-transform" />
          )}
          <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 text-[9px] font-mono text-[var(--text-muted)] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity glass-panel px-2 py-1 z-[300]">
            {mapProjection === 'globe' ? '平面地图' : '3D地球仪'}
          </span>
        </button>
        <button
          onClick={() => setMapStyle(s => s === 'dark' ? 'satellite' : 'dark')}
          className="glass-panel p-3.5 pointer-events-auto hover:border-[var(--gold-primary)]/40 transition-colors group relative"
          title={mapStyle === 'dark' ? '切换到卫星影像' : '切换到夜间模式'}
        >
          {mapStyle === 'dark' ? (
            <Satellite className="w-5 h-5 text-[var(--alert-green)] group-hover:scale-110 transition-transform" />
          ) : (
            <Moon className="w-5 h-5 text-[var(--cyan-primary)] group-hover:scale-110 transition-transform" />
          )}
          <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 text-[9px] font-mono text-[var(--text-muted)] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity glass-panel px-2 py-1 z-[300]">
            {mapStyle === 'dark' ? '卫星影像' : '夜间模式'}
          </span>
        </button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 2.5 }}
        className={`absolute top-4 left-6 z-[200] pointer-events-none flex flex-col`}
      >
        <div className="flex items-baseline gap-2">
          <h1 className="text-xl font-bold tracking-[0.4em] text-[var(--gold-primary)] font-mono">虚假情报中心</h1>
          <span className="text-[10px] text-[var(--text-muted)] font-mono tracking-[0.15em] opacity-80">一个基于OSIRIS二次开发的平台</span>
        </div>
        <div className="flex items-center gap-4 mt-1">
          <span className="text-[5px] text-[var(--text-muted)] font-mono tracking-[0.3em] uppercase opacity-40">
            由虚假情报中心驱动 · C2引擎：物理指挥核心 · 传感器：轨道晶格 · 网络：狼群网络
          </span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 3 }}
        className="status-bar-desktop absolute top-4 right-6 z-[200] pointer-events-none flex items-center gap-4 text-[9px] font-mono tracking-widest text-[var(--text-muted)]"
      >
        <span className="hidden lg:inline-flex items-center gap-1.5">
          <ZuluClock />
        </span>
        <span className="flex items-center gap-1">
          系统: <span className={backendStatus === 'connected' ? 'text-[var(--alert-green)]' : backendStatus === 'error' ? 'text-[var(--alert-red)]' : 'text-[var(--text-muted)]'}>{getBackendStatusText()}</span>
        </span>
        {spaceWeather && (
          <span className="hidden lg:inline">
            太阳活动: <span style={{ color: spaceWeather.storm_color, fontWeight: 700 }}>Kp{spaceWeather.kp_index}</span>
          </span>
        )}
        <span className="hidden lg:inline-flex items-center gap-1">
          <span className="text-[var(--cyan-primary)] font-bold">{Object.values(activeLayers).filter(Boolean).length}</span>
          <span className="text-[var(--text-muted)]/60">数据源</span>
        </span>
        <UptimeClock />
        <span className="text-[10px] font-bold tracking-[0.2em] text-[var(--text-muted)] opacity-50 ml-2">版本 4.1</span>
      </motion.div>

      {isMobile && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.5 }}
          className="absolute top-3 right-3 z-[200] pointer-events-auto flex items-center gap-2"
        >
          <a
            href='https://ko-fi.com/M8D41ZYW4Z'
            target='_blank'
            className="glass-panel px-2 py-1 flex items-center gap-1.5 text-[7px] font-mono tracking-widest hover:opacity-80 transition-opacity border-[var(--gold-primary)]/40 bg-[var(--gold-primary)]/10"
          >
            <div className="w-1 h-1 rounded-full bg-[var(--gold-primary)] animate-osiris-pulse" />
            <span className="text-[var(--gold-primary)] font-bold">支持项目</span>
          </a>
        </motion.div>
      )}

      {showLayers && !isMobile && <LayerPanel data={data} activeLayers={activeLayers} setActiveLayers={setActiveLayers} />}

      {!isMobile && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-[250] pointer-events-auto bg-black/40 backdrop-blur-sm p-1 rounded-full border border-white/5">
          <div className="relative group">
            <button
              onClick={() => { setShowIntel(!showIntel); setShowMarkets(false); setShowAlerts(false); }}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${showIntel ? 'bg-[var(--cyan-primary)]/20' : 'hover:bg-white/10'}`}
            >
              <Radar className={`w-4 h-4 ${showIntel ? 'text-[var(--cyan-primary)]' : 'text-white/60'}`} />
            </button>
            <AnimatePresence>
              {showIntel && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="absolute right-12 top-1/2 -translate-y-1/2 w-80"
                >
                  <OsintPanel
                    onSweepVisualize={setSweepData}
                    onScanGeolocate={(target, data) => {
                      setScanTargets(prev => {
                        const existing = prev.filter(t => t.id !== target);
                        return [{ id: target, timestamp: Date.now(), ...data }, ...existing].slice(0, 10);
                      });
                      setFlyToLocation({ lat: data.lat, lng: data.lng, ts: Date.now() });
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="relative group">
            <button
              onClick={() => { setShowMarkets(!showMarkets); setShowIntel(false); setShowAlerts(false); }}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${showMarkets ? 'bg-[var(--gold-primary)]/20' : 'hover:bg-white/10'}`}
            >
              <BarChart3 className={`w-4 h-4 ${showMarkets ? 'text-[var(--gold-primary)]' : 'text-white/60'}`} />
            </button>
            <AnimatePresence>
              {showMarkets && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="absolute right-12 top-1/2 -translate-y-1/2 w-80"
                >
                  <MarketsPanel data={data} spaceWeather={spaceWeather} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="relative group">
            <button
              onClick={() => { setShowAlerts(!showAlerts); setShowIntel(false); setShowMarkets(false); setShowEntityGraph(false); }}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${showAlerts ? 'bg-[#FF3D3D]/20' : 'hover:bg-white/10'}`}
            >
              <AlertTriangle className={`w-4 h-4 ${showAlerts ? 'text-[#FF3D3D]' : 'text-white/60'}`} />
            </button>
            <AnimatePresence>
              {showAlerts && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="absolute right-12 top-1/2 -translate-y-1/2 w-80"
                >
                  <LiveAlerts
                    data={data}
                    onLocate={(lat, lng) => setFlyToLocation({ lat, lng, ts: Date.now() })}
                    onWatchFeed={(url, name) => { setLiveFeedUrl(url); setLiveFeedName(name); }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="relative group">
            <button
              onClick={() => { setShowEntityGraph(!showEntityGraph); setShowIntel(false); setShowMarkets(false); setShowAlerts(false); }}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${showEntityGraph ? 'bg-[#D4AF37]/20' : 'hover:bg-white/10'}`}
            >
              <Network className={`w-4 h-4 ${showEntityGraph ? 'text-[#D4AF37]' : 'text-white/60'}`} />
            </button>
            <AnimatePresence>
              {showEntityGraph && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="absolute right-12 top-1/2 -translate-y-1/2 w-80"
                >
                  <EntityGraphPanel entity={entityGraphTarget} onClose={() => setShowEntityGraph(false)} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="relative group">
            <button
              onClick={() => setShowAiPanel(true)}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10"
            >
              <Sparkles className="w-4 h-4 text-white/60" />
            </button>
            <AnimatePresence>
              {showAiPanel && (
                <AiSidePanel isOpen={showAiPanel} onClose={() => setShowAiPanel(false)} isMobile={false} />
              )}
            </AnimatePresence>
          </div>
          <div className="relative group">
            <button
              onClick={() => setShowSecurityPanel(!showSecurityPanel)}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10"
            >
              <ShieldAlert className="w-4 h-4 text-white/60" />
            </button>
            <AnimatePresence>
              {showSecurityPanel && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="absolute right-12 top-1/2 -translate-y-1/2 w-80"
                >
                  <SecurityPanel onLocate={(lat, lng) => setFlyToLocation({ lat, lng, ts: Date.now() })} onClose={() => setShowSecurityPanel(false)} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      <AnimatePresence>
        {liveFeedUrl && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[500] flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setLiveFeedUrl(null)}
          >
            <motion.div
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              className="w-[90vw] max-w-[900px] flex flex-col relative rounded-xl overflow-hidden border border-[var(--border-primary)] shadow-2xl bg-black"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-2.5 bg-[#111] border-b border-[var(--border-primary)]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#FF4081] animate-osiris-pulse" />
                  <span className="text-[12px] font-mono font-bold text-white tracking-wider">{liveFeedName}</span>
                  <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-mono text-[9px] font-bold">直播流</span>
                  {!liveFeedEmbedAllowed && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono text-[9px]">仅外部</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <a
                    href={getYouTubeWatchUrl(liveFeedUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--border-primary)] hover:bg-[var(--gold-primary)] hover:text-black text-white transition-colors text-[11px] font-mono"
                  >
                    <span>在 YouTube 打开</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button onClick={() => setLiveFeedUrl(null)} className="text-white/70 hover:text-white transition-colors p-1">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              {liveFeedEmbedAllowed ? (
                <div className="w-full aspect-video relative bg-black">
                  <iframe
                    src={liveFeedUrl}
                    className="w-full h-full absolute inset-0"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="w-full aspect-video flex items-center justify-center bg-black/95">
                  <div className="text-center px-8">
                    <div className="w-14 h-14 rounded-full bg-[#39FF14]/10 border border-[#39FF14]/20 flex items-center justify-center mx-auto mb-4">
                      <ExternalLink className="w-6 h-6 text-[#39FF14]" />
                    </div>
                    <p className="text-[13px] font-mono font-bold text-white tracking-widest mb-2">嵌入受限</p>
                    <p className="text-[11px] font-mono text-white/50 mb-6 max-w-xs">
                      {liveFeedName} 不允许第三方嵌入。点击下方按钮直接打开直播。
                    </p>
                    <a
                      href={getYouTubeWatchUrl(liveFeedUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded border border-[#39FF14]/40 text-[#39FF14] font-mono text-[12px] hover:bg-[#39FF14]/10 transition-colors tracking-wider"
                    >
                      <ExternalLink className="w-4 h-4" />
                      打开直播流
                    </a>
                  </div>
                </div>
              )}
              {liveFeedEmbedAllowed && (
                <div className="bg-[#111]/90 px-4 py-2.5 border-t border-[var(--border-primary)] flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-[var(--gold-primary)] shrink-0" />
                  <span className="text-[11px] font-mono text-white/70 leading-relaxed">
                    如果看到“视频不可用”，请使用上方的“在 YouTube 打开”按钮。
                  </span>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {isMobile && (
        <>
          <div className="mobile-nav">
            <div className="glass-panel mobile-nav-inner">
              {[
                { id: 'layers' as const, icon: Layers, label: '图层' },
                { id: 'markets' as const, icon: BarChart3, label: '市场' },
                { id: 'intel' as const, icon: Newspaper, label: '情报' },
                { id: 'recon' as const, icon: Radar, label: '侦察' },
                { id: 'search' as const, icon: Search, label: '搜索' },
                { id: 'ai' as const, icon: Sparkles, label: 'AI' },
                { id: 'security' as const, icon: ShieldAlert, label: '安全' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (tab.id === 'ai') {
                      setShowAiPanel(true);
                    } else if (tab.id === 'security') {
                      setShowSecurityPanelMobile(true);
                    } else {
                      setMobilePanel(mobilePanel === tab.id ? null : tab.id);
                    }
                  }}
                  className={`mobile-nav-btn ${(tab.id === 'ai' && showAiPanel) || mobilePanel === tab.id ? 'active' : ''}`}
                >
                  <tab.icon className={`w-4 h-4 ${tab.id === 'recon' ? 'text-[var(--cyan-primary)]' : tab.id === 'ai' ? 'text-[#D4AF37]' : ''}`} />
                  <span className={tab.id === 'recon' ? 'text-[var(--cyan-primary)]' : tab.id === 'ai' ? 'text-[#D4AF37]' : ''}>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          <AnimatePresence>
            {showSecurityPanelMobile && (
              <motion.div
                initial={{ opacity: 0, y: '100%' }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="fixed inset-x-0 bottom-[52px] z-[500] glass-panel rounded-b-none overflow-hidden"
                style={{ maxHeight: 'min(70vh, calc(100dvh - 100px))' }}
              >
                <div className="flex items-center justify-between p-2 border-b border-[rgba(255,255,255,0.05)]">
                  <span className="hud-text text-[10px] text-[var(--text-primary)]">安全情报</span>
                  <button onClick={() => setShowSecurityPanelMobile(false)} className="text-[var(--text-muted)] p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="overflow-y-auto styled-scrollbar h-full">
                  <SecurityPanel
                    onLocate={(lat, lng) => setFlyToLocation({ lat, lng, ts: Date.now() })}
                    onClose={() => setShowSecurityPanelMobile(false)}
                  />
                </div>
              </motion.div>
            )}
            {mobilePanel && (
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="fixed bottom-[52px] left-0 right-0 z-[400] glass-panel rounded-b-none overflow-y-auto styled-scrollbar"
                style={{ maxHeight: 'min(55vh, calc(100dvh - 100px))', paddingBottom: 'env(safe-area-inset-bottom, 4px)' }}
              >
                <div className="mobile-drawer-handle" />
                <div className="px-3 pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="hud-text text-[9px] text-[var(--text-primary)]">
                      {mobilePanel === 'layers'
                        ? '图层与统计'
                        : mobilePanel === 'markets'
                        ? '市场与情报'
                        : mobilePanel === 'intel'
                        ? '情报流'
                        : mobilePanel === 'recon'
                        ? '虚假情报侦察'
                        : '搜索'}
                    </span>
                    <button onClick={() => setMobilePanel(null)} className="text-[var(--text-muted)] p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {mobilePanel === 'layers' && (
                    <>
                      <div className="glass-panel-sm p-2 mb-2">
                        <div className="grid grid-cols-5 gap-1 text-center">
                          <div>
                            <div className="hud-label" style={{ fontSize: '6px' }}>空中</div>
                            <div className="hud-value text-[9px]">{totalFlights.toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="hud-label" style={{ fontSize: '6px' }}>卫星</div>
                            <div className="hud-value text-[9px]">{(data.satellites?.length || 0)}</div>
                          </div>
                          <div>
                            <div className="hud-label" style={{ fontSize: '6px' }}>摄像头</div>
                            <div className="hud-value text-[9px]">{(data.cameras?.length || 0)}</div>
                          </div>
                          <div>
                            <div className="hud-label" style={{ fontSize: '6px' }}>天气</div>
                            <div className="hud-value text-[9px]" style={{ color: 'var(--accent-weather)' }}>
                              {(data.weather_events?.length || 0)}
                            </div>
                          </div>
                          <div>
                            <div className="hud-label" style={{ fontSize: '6px' }}>核设施</div>
                            <div className="hud-value text-[9px]" style={{ color: 'var(--accent-nuclear)' }}>
                              {(data.infrastructure?.length || 0)}
                            </div>
                          </div>
                        </div>
                      </div>
                      <LayerPanel data={data} activeLayers={activeLayers} setActiveLayers={setActiveLayers} isMobile={true} />
                      <div className="mt-2">
                        <ViewPresets
                          onNavigate={(lat, lng, zoom) => {
                            setFlyToLocation({ lat, lng, ts: Date.now() });
                            setMapView(v => ({ ...v, zoom }));
                            setMobilePanel(null);
                          }}
                        />
                      </div>
                    </>
                  )}
                  {mobilePanel === 'markets' && <MarketsPanel data={data} spaceWeather={spaceWeather} />}
                  {mobilePanel === 'intel' && (
                    <IntelFeed
                      data={data}
                      onLocate={(lat, lng) => {
                        setFlyToLocation({ lat, lng, ts: Date.now() });
                        setMobilePanel(null);
                      }}
                    />
                  )}
                  {mobilePanel === 'search' && (
                    <div className="space-y-2">
                      <SearchBar
                        onLocate={(lat, lng) => {
                          setFlyToLocation({ lat, lng, ts: Date.now() });
                          setMobilePanel(null);
                        }}
                      />
                      <SharePanel mapView={mapView} activeLayers={activeLayers} mouseCoords={null} />
                    </div>
                  )}
                  {mobilePanel === 'recon' && (
                    <div className="space-y-2">
                      <OsintPanel
                        isOpen={true}
                        onClose={() => setMobilePanel(null)}
                        isMobile={true}
                        onSweepVisualize={setSweepData}
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {!isMobile && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3, duration: 0.8 }}
          className="desktop-only absolute bottom-4 left-20 z-[200] pointer-events-auto"
        >
          <div className="flex items-center gap-6 text-[8px] font-mono tracking-widest text-[var(--text-muted)] opacity-60">
            <div className="flex gap-2 items-center">
              <span>坐标</span>
              <span ref={coordsDisplayRef} className="text-[var(--gold-primary)] font-bold tabular-nums">—</span>
            </div>
            <div className="flex gap-2 items-center">
              <span>位置</span>
              <span className="text-[var(--cyan-primary)] truncate max-w-[200px]">{locationLabel || '悬停地图'}</span>
            </div>
            <div className="flex gap-2 items-center">
              <span>缩放</span>
              <span className="text-[var(--gold-primary)] font-bold tabular-nums">{mapView.zoom.toFixed(1)}</span>
            </div>
          </div>
        </motion.div>
      )}

      <div className="desktop-only absolute bottom-[4.5rem] left-[20rem] z-[201] pointer-events-none">
        <ScaleBar zoom={mapView.zoom} latitude={mapView.latitude} />
      </div>

      {(regionDossier || dossierLoading) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute top-16 md:top-20 left-2 right-2 md:left-1/2 md:right-auto md:-translate-x-1/2 z-[300] md:w-[480px] max-h-[65vh] overflow-y-auto styled-scrollbar"
        >
          <div className="glass-panel p-5 osiris-glow">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-mono font-bold text-[var(--gold-primary)] tracking-wider">地区档案</h2>
              <button
                onClick={() => {
                  setRegionDossier(null);
                  setDossierLoading(false);
                }}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs"
              >
                ✕
              </button>
            </div>
            {dossierLoading ? (
              <div className="text-center py-8">
                <div className="w-5 h-5 border-2 border-[var(--gold-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <span className="text-[8px] font-mono text-[var(--text-muted)] tracking-widest">整理情报中...</span>
              </div>
            ) : (
              regionDossier && (
                <div className="space-y-3">
                  <div>
                    <div className="hud-label mb-0.5">位置</div>
                    <div className="text-xs text-[var(--text-primary)]">{regionDossier.location?.display_name}</div>
                  </div>
                  {regionDossier.country && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="hud-label mb-0.5">国家</div>
                        <div className="text-xs text-[var(--text-primary)]">
                          {regionDossier.country.flag} {regionDossier.country.name}
                        </div>
                      </div>
                      <div>
                        <div className="hud-label mb-0.5">首都</div>
                        <div className="text-xs text-[var(--text-primary)]">{regionDossier.country.capital}</div>
                      </div>
                      <div>
                        <div className="hud-label mb-0.5">人口</div>
                        <div className="text-xs text-[var(--text-primary)]">{regionDossier.country.population?.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="hud-label mb-0.5">区域</div>
                        <div className="text-xs text-[var(--text-primary)]">
                          {regionDossier.country.subregion || regionDossier.country.region}
                        </div>
                      </div>
                      <div>
                        <div className="hud-label mb-0.5">语言</div>
                        <div className="text-xs text-[var(--text-primary)]">{regionDossier.country.languages?.join(', ')}</div>
                      </div>
                      <div>
                        <div className="hud-label mb-0.5">面积</div>
                        <div className="text-xs text-[var(--text-primary)]">{regionDossier.country.area?.toLocaleString()} km²</div>
                      </div>
                    </div>
                  )}
                  {regionDossier.head_of_state && (
                    <div>
                      <div className="hud-label mb-0.5">国家元首</div>
                      <div className="text-xs text-[var(--gold-primary)]">{regionDossier.head_of_state.name}</div>
                      <div className="text-[8px] text-[var(--text-muted)]">{regionDossier.head_of_state.position}</div>
                    </div>
                  )}
                  {regionDossier.wikipedia && (
                    <div>
                      <div className="hud-label mb-1">情报简报</div>
                      <div className="flex gap-3">
                        {regionDossier.wikipedia.thumbnail && (
                          <img src={regionDossier.wikipedia.thumbnail} alt="" className="w-14 h-14 rounded object-cover flex-shrink-0" />
                        )}
                        <p className="text-[8px] text-[var(--text-secondary)] leading-relaxed">{regionDossier.wikipedia.extract}</p>
                      </div>
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        </motion.div>
      )}

      <CameraViewer
        camera={activeCamera}
        onClose={() => setActiveCamera(null)}
        onLocate={(lat, lng) => setFlyToLocation({ lat, lng, ts: Date.now() })}
      />

      <AiSidePanel isOpen={showAiPanel} onClose={() => setShowAiPanel(false)} isMobile={isMobile} />

      <div className="vignette absolute inset-0 pointer-events-none z-[2]" />
      <div className="crt-scanlines absolute inset-0 pointer-events-none z-[3] opacity-[0.02]" />
      {[
        { pos: 'top-0 left-0', vAnchor: 'top-0', hAnchor: 'left-0', hGrad: 'bg-gradient-to-r', vGrad: 'bg-gradient-to-b' },
        { pos: 'top-0 right-0', vAnchor: 'top-0', hAnchor: 'right-0', hGrad: 'bg-gradient-to-l', vGrad: 'bg-gradient-to-b' },
        { pos: 'bottom-0 left-0', vAnchor: 'bottom-0', hAnchor: 'left-0', hGrad: 'bg-gradient-to-r', vGrad: 'bg-gradient-to-t' },
        { pos: 'bottom-0 right-0', vAnchor: 'bottom-0', hAnchor: 'right-0', hGrad: 'bg-gradient-to-l', vGrad: 'bg-gradient-to-t' },
      ].map((c, i) => (
        <div key={i} className={`absolute ${c.pos} w-16 h-16 pointer-events-none z-[1]`}>
          <div className={`absolute ${c.vAnchor} ${c.hAnchor} w-full h-[1px] ${c.hGrad} from-[var(--gold-primary)]/30 to-transparent`} />
          <div className={`absolute ${c.vAnchor} ${c.hAnchor} w-[1px] h-full ${c.vGrad} from-[var(--gold-primary)]/30 to-transparent`} />
        </div>
      ))}

      <KeyboardShortcuts />
      <GlobalStatusBar />

      <div className="desktop-only absolute bottom-[26px] right-5 z-[200] pointer-events-none text-[6px] font-mono text-[var(--text-muted)]/40 tracking-widest">
        [?] 快捷键 · [F] 全屏 · [S] 分享 · [R] 重置视图
      </div>
    </main>
  );
}
