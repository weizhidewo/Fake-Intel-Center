'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Settings, Trash2, Loader2, Clock, ChevronDown, ChevronUp, Maximize2, Minimize2, X, ExternalLink } from 'lucide-react';

interface SecurityItem {
  id: number;
  title: string;
  summary: string;
  raw_content: string;
  category: string;
  risk_score: number;
  source: string;
  published: string;
  lat: number | null;
  lng: number | null;
  link: string | null;
  created_at: number;
}

interface DataSourceConfig {
  secCrawler: boolean;
  alienVault: boolean;
  nvd: boolean;
  bleepingComputer: boolean;
}

const RISK_COLORS: Record<string, string> = {
  HIGH: '#FF3D3D',
  CRITICAL: '#FF1744',
  ELEVATED: '#FF9500',
  MODERATE: '#FFD700',
  LOW: '#00E676',
};

function formatDate(timestamp: string) {
  if (!timestamp) return '';
  try {
    const date = new Date(timestamp);
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return '';
  }
}

export default function SecurityPanel({ onLocate, onClose }: { onLocate: (lat: number, lng: number) => void; onClose: () => void }) {
  const [expanded, setExpanded] = useState(true);
  const [maximized, setMaximized] = useState(false);
  const [securityData, setSecurityData] = useState<SecurityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [intervalHours, setIntervalHours] = useState(6);
  const [dataSources, setDataSources] = useState<DataSourceConfig>({
    secCrawler: false,
    alienVault: true,
    nvd: true,
    bleepingComputer: false
  });
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    loadData();
    loadConfig();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/infosec?limit=200');
      const json = await res.json();
      setSecurityData(json.items || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  const clearData = async () => {
    setClearing(true);
    try {
      await fetch('/api/infosec?clear=true', { method: 'DELETE' });
      setSecurityData([]);
    } catch (e) { console.error(e); } finally { setClearing(false); }
  };

  const loadConfig = async () => {
    try {
      const res = await fetch('/api/infosec/schedule');
      const cfg = await res.json();
      setAutoEnabled(cfg.enabled);
      setIntervalHours(cfg.intervalHours);
      if (cfg.dataSources) setDataSources(cfg.dataSources);
    } catch (e) {}
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      await fetch('/api/infosec/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: autoEnabled, intervalHours, dataSources })
      });
      setShowSettings(false);
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  // 获取所有唯一的类别（用于筛选按钮）
  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    securityData.forEach(item => {
      if (item.category) cats.add(item.category);
    });
    return Array.from(cats).sort();
  }, [securityData]);

  // 筛选 + 排序（按 published 倒序，最新在前）
  const filteredAndSortedData = useMemo(() => {
    let filtered = securityData;
    if (selectedCategory !== 'all') {
      filtered = securityData.filter(item => item.category === selectedCategory);
    }
    // 排序：按 published 倒序（字符串比较 ISO 日期可行）
    return [...filtered].sort((a, b) => {
      const dateA = a.published ? new Date(a.published).getTime() : 0;
      const dateB = b.published ? new Date(b.published).getTime() : 0;
      return dateB - dateA;
    });
  }, [securityData, selectedCategory]);

  return (
    <div className={`glass-panel flex flex-col overflow-hidden pointer-events-auto transition-all duration-300 ${maximized ? 'fixed inset-4 z-[9999] bg-[#0a0a09]/95 backdrop-blur-3xl' : 'shrink-0 h-[500px] max-h-[80vh] resize-y'}`}>
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 hover:bg-[var(--hover-accent)] transition-colors border-b border-[rgba(255,255,255,0.05)] bg-[rgba(0,0,0,0.3)]">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-3.5 h-3.5 text-[#D4AF37]" />
          <span className="hud-text text-[10px] text-[var(--text-primary)]">安全情报</span>
          <span className="gotham-tag gotham-tag--info" style={{ fontSize: '7px', padding: '1px 4px' }}>{filteredAndSortedData.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }} className="hover:text-white transition-colors">
            <Settings className="w-3 h-3 text-[var(--text-muted)]" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setMaximized(!maximized); if (!expanded && !maximized) setExpanded(true); }} className="hover:text-white transition-colors">
            {maximized ? <Minimize2 className="w-3 h-3 text-[var(--text-muted)]" /> : <Maximize2 className="w-3 h-3 text-[var(--text-muted)]" />}
          </button>
          <button onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="w-3.5 h-3.5 text-[var(--text-muted)]" /> : <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
          </button>
          <button onClick={onClose} className="hover:text-white transition-colors">
            <X className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-b border-[var(--border-primary)]">
            <div className="p-3 space-y-3 bg-black/30" translate="no">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-[var(--text-primary)]">自动拉取</span>
                <button onClick={() => setAutoEnabled(!autoEnabled)} className={`px-3 py-1 rounded text-[9px] font-mono ${autoEnabled ? 'bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/40' : 'bg-white/10 text-white/60'}`}>
                  {autoEnabled ? '开启' : '关闭'}
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-[var(--text-primary)]">间隔（小时）</span>
                <select value={intervalHours} onChange={(e) => setIntervalHours(Number(e.target.value))} className="bg-black/50 border border-[var(--border-primary)] rounded px-2 py-1 text-[10px] font-mono">
                  <option value={1}>1</option><option value={3}>3</option><option value={6}>6</option>
                  <option value={12}>12</option><option value={24}>24</option>
                </select>
              </div>
              <div className="space-y-2">
                <div className="text-[10px] font-mono text-[var(--text-muted)] mt-2">数据源</div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 text-[9px] font-mono"><input type="checkbox" checked={dataSources.secCrawler} onChange={e => setDataSources({...dataSources, secCrawler: e.target.checked})} /> SecCrawler</label>
                  <label className="flex items-center gap-2 text-[9px] font-mono"><input type="checkbox" checked={dataSources.alienVault} onChange={e => setDataSources({...dataSources, alienVault: e.target.checked})} /> AlienVault OTX</label>
                  <label className="flex items-center gap-2 text-[9px] font-mono"><input type="checkbox" checked={dataSources.nvd} onChange={e => setDataSources({...dataSources, nvd: e.target.checked})} /> NVD</label>
                  <label className="flex items-center gap-2 text-[9px] font-mono"><input type="checkbox" checked={dataSources.bleepingComputer} onChange={e => setDataSources({...dataSources, bleepingComputer: e.target.checked})} /> BleepingComputer</label>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={clearData} disabled={clearing} className="flex-1 py-1.5 rounded bg-red-500/20 text-red-400 text-[9px] font-mono flex items-center justify-center gap-1">
                  {clearing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />} 清除
                </button>
                <button onClick={saveConfig} disabled={saving} className="flex-1 py-1.5 rounded bg-[#D4AF37]/20 text-[#D4AF37] text-[9px] font-mono">
                  {saving ? '保存中' : '保存'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 筛选栏 */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-[rgba(255,255,255,0.05)] overflow-x-auto styled-scrollbar">
        <div className="flex gap-1.5">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-2 py-0.5 rounded text-[9px] font-mono transition-colors whitespace-nowrap ${selectedCategory === 'all' ? 'bg-[#D4AF37] text-black' : 'bg-white/10 text-[var(--text-muted)] hover:bg-white/20'}`}
          >
            全部
          </button>
          {allCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2 py-0.5 rounded text-[9px] font-mono transition-colors whitespace-nowrap ${selectedCategory === cat ? 'bg-[#D4AF37] text-black' : 'bg-white/10 text-[var(--text-muted)] hover:bg-white/20'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="flex-1 overflow-y-auto styled-scrollbar p-3">
            {loading ? (
              <div className="text-center py-4 text-[10px]">加载中...</div>
            ) : filteredAndSortedData.length === 0 ? (
              <div className="text-center py-4 text-[10px]">暂无安全情报</div>
            ) : (
              <div className="space-y-2">
                {filteredAndSortedData.map(item => {
                  const sevColor = RISK_COLORS[item.risk_score >= 80 ? 'CRITICAL' : item.risk_score >= 60 ? 'HIGH' : item.risk_score >= 40 ? 'ELEVATED' : 'LOW'] || '#FFD700';

                  let displayTitle = '';
                  let description = '';

                  if (item.source === 'NVD') {
                    displayTitle = item.title;
                    description = item.summary || item.raw_content || '暂无描述';
                  } else if (item.source === 'AlienVault OTX') {
                    displayTitle = item.summary || item.title;
                    description = item.raw_content || item.summary || '暂无简介';
                  } else {
                    displayTitle = item.summary || item.title;
                    description = item.raw_content || item.summary || '';
                  }

                  if (description === displayTitle) description = '';

                  return (
                    <div key={item.id} className="p-2.5 rounded-lg bg-[#111111]/60 border border-[#2A2A28] hover:bg-[#1A1A1A] transition-all">
                      <div className="flex items-start gap-2.5">
                        <div className="mt-1 w-2 h-2 rounded-full" style={{ backgroundColor: sevColor, boxShadow: `0 0 6px ${sevColor}60` }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-2">
                            <div className="text-[10px] font-mono font-bold text-white leading-tight break-words line-clamp-2">
                              {displayTitle}
                            </div>
                            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap flex-shrink-0" style={{ backgroundColor: `${sevColor}20`, color: sevColor }}>
                              {item.category}
                            </span>
                          </div>

                          {description && (
                            <div className="text-[9px] text-[#B0B0B0] mt-1 line-clamp-3">
                              {description}
                            </div>
                          )}

                          <div className="flex items-center justify-between mt-2 text-[8px]">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[#8A8880] truncate">{item.source}</span>
                              {item.published && (
                                <span className="text-[#5C5A54] flex items-center gap-1 flex-shrink-0">
                                  <Clock className="w-2.5 h-2.5" />
                                  {formatDate(item.published)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-[#D4AF37]">风险 {item.risk_score}</span>
                              {item.link && (
                                <a
                                  href={item.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-[var(--cyan-primary)] hover:underline"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <ExternalLink className="w-2.5 h-2.5" />
                                  <span>SOURCE</span>
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
