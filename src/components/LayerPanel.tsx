'use client';

import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plane, Satellite, Activity, Sun, AlertTriangle, Camera, Flame, Target,
  CloudLightning, Radiation, Tv, Anchor, Ship, Newspaper,
  Network, Share2, Radio
} from 'lucide-react';

interface LayerPanelProps {
  data: any;
  activeLayers: any;
  setActiveLayers: React.Dispatch<React.SetStateAction<any>>;
  isMobile?: boolean;
}

const LAYER_GROUPS = [
  {
    label: '平台',
    fullLabel: '平台网络',
    color: '#1565C0',
    layers: [
      { key: 'sdk_sea', label: '海上航线', icon: Anchor, color: '#4FC3F7', dataKey: 'sdk_entities' },
      { key: 'sdk_ransomware', label: 'Ransomware Feed', icon: AlertTriangle, color: '#D32F2F', dataKey: 'sdk_entities' },
    ],
  },
  {
    label: '航空',
    fullLabel: '航空监视',
    color: '#64B5F6',
    layers: [
      { key: 'flights', label: '商用航班', icon: Plane, color: '#64B5F6', dataKey: 'commercial_flights' },
      { key: 'private', label: '私人飞机', icon: Plane, color: '#B0BEC5', dataKey: 'private_flights' },
      { key: 'jets', label: '私人公务机', icon: Plane, color: '#7E57C2', dataKey: 'private_jets' },
      { key: 'military', label: '军用航空', icon: Shield, color: '#D32F2F', dataKey: 'military_flights' },
    ],
  },
  {
    label: '海事',
    fullLabel: '海事与太空',
    color: '#26C6DA',
    layers: [
      { key: 'maritime', label: 'Maritime / Naval', icon: Ship, color: '#26C6DA', dataKey: 'maritime_ships,maritime_ports,maritime_chokepoints' },
      { key: 'satellites', label: '卫星', icon: Satellite, color: '#D4AF37', dataKey: 'satellites' },
    ],
  },
  {
    label: '监控',
    fullLabel: '监控网络',
    color: '#7E57C2',
    layers: [
      { key: 'cctv', label: '监控摄像头', icon: Camera, color: '#7E57C2', dataKey: 'cameras' },
      { key: 'live_news', label: '直播新闻', icon: Tv, color: '#EC407A', dataKey: 'live_feeds' },
    ],
  },
  {
    label: '灾害',
    fullLabel: '自然灾害',
    color: '#F9A825',
    layers: [
      { key: 'earthquakes', label: '地震 (24小时)',icon: Activity, color: '#F9A825', dataKey: 'earthquakes' },
      { key: 'fires', label: '活跃火点',icon: Flame, color: '#E65100', dataKey: 'fires' },
      { key: 'weather', label: '恶劣天气',icon: CloudLightning, color: '#7E57C2', dataKey: 'weather_events' },
    ],
  },
  {
    label: '威胁',
    fullLabel: '威胁与设施',
    color: '#D32F2F',
    layers: [
      { key: 'infrastructure', label: '核设施', icon: Radiation, color: '#26A69A', dataKey: 'infrastructure' },
      { key: 'global_incidents', label: '全球事件', icon: AlertTriangle, color: '#D32F2F', dataKey: 'gdelt' },
      { key: 'gps_jamming', label: 'GPS干扰', icon: Radio, color: '#D32F2F', dataKey: 'gps_jamming' },
    ],
  },
  {
    label: '网络',
    fullLabel: '网络情报',
    color: '#D32F2F',
    layers: [

      { key: 'malware', label: '实时恶意软件', icon: AlertTriangle, color: '#D32F2F', dataKey: 'malware_threats' },
    ],
  },
  {
    label: '显示',
    fullLabel: '显示设置',
    color: '#448AFF',
    layers: [
      { key: 'day_night', label: 'Day / Night Cycle', icon: Sun, color: '#448AFF', dataKey: '' },
    ],
  },
];

const ALL_LAYERS = LAYER_GROUPS.flatMap(g => g.layers);

// SVG component for Shield which was missing in the imports above
function Shield(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}

function LayerPanel({ data, activeLayers, setActiveLayers, isMobile }: LayerPanelProps) {
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);

  const toggle = (key: string) => setActiveLayers((prev: any) => ({ ...prev, [key]: !prev[key] }));
  
  const getCount = (dk: string): number | null => {
    if (!dk) return null;
    let total = 0;
    let found = false;
    for (const k of dk.split(',')) {
      if (data[k] && Array.isArray(data[k])) {
        total += data[k].length;
        found = true;
      }
    }
    return found ? total : null;
  };

  if (isMobile) {
    return (
      <div className="flex flex-col gap-4 py-2">
        {LAYER_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-2">
            <div 
              className="text-[10px] font-bold font-mono tracking-widest border-b border-white/10 pb-1"
              style={{ color: group.color }}
            >
              {group.fullLabel}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {group.layers.map((layer) => {
                const isLayerActive = activeLayers[layer.key];
                const count = getCount(layer.dataKey);
                
                return (
                  <button
                    key={layer.key}
                    onClick={() => {
                      if (layer.key === 'sdk_ransomware') {
                        // alert('Ransomware Feed - Coming Soon');
                      } else {
                        toggle(layer.key);
                      }
                    }}
                    className={`flex items-center gap-2 px-2 py-2 rounded border transition-colors ${
                      isLayerActive 
                        ? 'bg-white/10 border-white/20' 
                        : 'bg-transparent border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div 
                      className={`w-2 h-2 rounded-full border flex-shrink-0 transition-all ${
                        isLayerActive ? 'bg-current border-current scale-100' : 'bg-transparent border-white/30 scale-75'
                      }`}
                      style={{ color: isLayerActive ? layer.color : 'inherit', boxShadow: isLayerActive ? `0 0 8px ${layer.color}` : 'none' }}
                    />
                    <span className={`text-[9px] font-mono uppercase tracking-wider flex-1 text-left ${isLayerActive ? 'text-white' : 'text-white/60'}`}>
                      {layer.label}
                    </span>
                    {count !== null && (
                      <span className="text-[8px] font-mono tabular-nums opacity-60">
                        {count.toLocaleString()}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="absolute top-0 left-0 h-full w-[80px] border-r border-white/5 flex flex-col pt-32 pb-8 z-50 pointer-events-auto bg-black/20 backdrop-blur-[2px]">
      
      <div className="flex-1 flex flex-col gap-8 px-2">
        {LAYER_GROUPS.map((group) => {
          const groupActiveCount = group.layers.filter(l => activeLayers[l.key]).length;
          const isActive = groupActiveCount > 0;
          const isHovered = hoveredGroup === group.label;

          return (
            <div 
              key={group.label} 
              className="relative flex justify-center items-center"
              onMouseEnter={() => setHoveredGroup(group.label)}
              onMouseLeave={() => setHoveredGroup(null)}
            >
              {/* The Vertical Label */}
              <div 
                className={`text-[10px] font-mono font-bold cursor-pointer select-none transition-all duration-300 flex items-center justify-center`}
                style={{
                  writingMode: 'horizontal-tb',
                  color: isActive ? group.color : 'rgba(255, 255, 255, 0.4)',
                  textShadow: isActive ? `0 0 10px ${group.color}80` : 'none',
                  letterSpacing: '0.1em',
                  opacity: isActive || isHovered ? 1 : 0.5,
                }}
              >
                {/* Active Indicator dot */}
                {isActive && (
                  <div 
                    className="absolute -left-1 w-1 h-1 rounded-full animate-pulse"
                    style={{ backgroundColor: group.color, boxShadow: `0 0 8px ${group.color}` }}
                  />
                )}
                {group.label}
              </div>

              {/* Slide-out Menu */}
              <AnimatePresence>
                {isHovered && (
                  <motion.div
                    initial={{ opacity: 0, x: -10, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, x: -5, filter: 'blur(2px)' }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute left-[70px] top-1/2 -translate-y-1/2 min-w-[240px] bg-black/80 backdrop-blur-md border border-white/10 rounded-lg p-3 shadow-2xl z-50 pointer-events-auto"
                    style={{
                      boxShadow: `0 0 30px ${group.color}15, inset 0 0 20px ${group.color}05`
                    }}
                  >
                    <div className="text-[11px] font-bold font-mono mb-3 tracking-widest border-b border-white/10 pb-2" style={{ color: group.color }}>
                      {group.fullLabel}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {group.layers.map((layer) => {
                        const isLayerActive = activeLayers[layer.key];
                        const count = getCount(layer.dataKey);
                        const Icon = layer.icon || Shield;
                        
                        return (
                          <button
                            key={layer.key}
                            onClick={() => {
                              if (layer.key === 'sdk_ransomware') {
                                // alert('Ransomware Feed - Coming Soon');
                              } else {
                                toggle(layer.key);
                              }
                            }}
                            className="w-full flex items-center gap-3 px-2 py-1.5 rounded bg-transparent hover:bg-white/5 transition-colors group"
                          >
                            <div 
                              className={`w-2 h-2 rounded-full border flex-shrink-0 transition-all duration-300 ${isLayerActive ? 'bg-current border-current scale-100' : 'bg-transparent border-white/30 scale-75'}`}
                              style={{ color: isLayerActive ? layer.color : 'inherit', boxShadow: isLayerActive ? `0 0 8px ${layer.color}` : 'none' }}
                            />
                            <span className={`text-[11px] font-mono uppercase tracking-wider flex-1 text-left transition-colors duration-200 ${isLayerActive ? 'text-white' : 'text-white/50 group-hover:text-white/80'}`}>
                              {layer.label}
                            </span>
                            {count !== null && (
                              <span className="text-[9px] font-mono tabular-nums opacity-60">
                                {count.toLocaleString()}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(LayerPanel);
