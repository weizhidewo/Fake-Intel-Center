'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, History, Play, Settings, Loader2, X, Clock, Maximize2, Minimize2, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { createPortal } from 'react-dom';

interface ConfigGroup {
  apiUrl: string;
  apiKey: string;
  model: string;
}

interface FullConfig {
  general: ConfigGroup;
  reasoning: ConfigGroup;
  preprocess: ConfigGroup;
  infosec: ConfigGroup;
}

interface AnalysisCard {
  conclusion: string;
  evidence: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  relevance: string;
}

interface HistoryItem {
  id: string;
  timestamp: number;
  content: string;
  cards?: AnalysisCard[];
}

interface DataSources {
  news: boolean;
  earthquakes: boolean;
  fires: boolean;
  flights: boolean;
  maritime: boolean;
  markets: boolean;
  malware: boolean;
  gdelt: boolean;
  infosec: boolean;
}

const confidenceColor = (conf: string) => {
  if (conf === 'HIGH') return '#39FF14';
  if (conf === 'MEDIUM') return '#FFD700';
  return '#FF9500';
};

// 安全转换 evidence 为字符串，防止 {table, rows} 报错
function safeEvidence(evidence: any): string {
  if (typeof evidence === 'string') return evidence;
  if (evidence === null || evidence === undefined) return '';
  if (typeof evidence === 'object') {
    // 处理 {table, rows} 格式
    if (evidence.table && Array.isArray(evidence.rows)) {
      let result = `${evidence.table}:\n`;
      evidence.rows.forEach((row: any, idx: number) => {
        result += `${idx+1}. ` + Object.values(row).join(' | ') + '\n';
      });
      return result;
    }
    return JSON.stringify(evidence);
  }
  return String(evidence);
}

export default function AiSidePanel({ isOpen, onClose, isMobile }: { isOpen: boolean; onClose: () => void; isMobile?: boolean }) {
  const [activeTab, setActiveTab] = useState<'history' | 'manual' | 'config' | 'schedule'>('manual');
  const [expanded, setExpanded] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiCards, setAiCards] = useState<AnalysisCard[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [config, setConfig] = useState<FullConfig>({
    general: { apiUrl: '', apiKey: '', model: '' },
    reasoning: { apiUrl: '', apiKey: '', model: '' },
    preprocess: { apiUrl: '', apiKey: '', model: '' },
    infosec: { apiUrl: '', apiKey: '', model: '' }
  });
  const [configSaving, setConfigSaving] = useState(false);
  const [currentAnalysisTime, setCurrentAnalysisTime] = useState('');
  
  const [intervalHours, setIntervalHours] = useState(9);
  const [infosecLimit, setInfosecLimit] = useState(50);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [selectedSources, setSelectedSources] = useState<DataSources>({
    news: true, earthquakes: true, fires: true, flights: true,
    maritime: true, markets: true, malware: true, gdelt: true,
    infosec: true
  });

  useEffect(() => setMounted(true), []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/ai-analysis/history');
      const data = await res.json();
      setHistory(data.history || []);
    } catch { setHistory([]); } finally { setHistoryLoading(false); }
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/ai-analysis/config');
      if (res.ok) {
        const data = await res.json();
        setConfig({
          general: data.general || { apiUrl: '', apiKey: '', model: '' },
          reasoning: data.reasoning || { apiUrl: '', apiKey: '', model: '' },
          preprocess: data.preprocess || { apiUrl: '', apiKey: '', model: '' },
          infosec: data.infosec || { apiUrl: '', apiKey: '', model: '' }
        });
      }
    } catch (err) { console.warn(err); }
  }, []);

  const loadSchedule = useCallback(async () => {
    try {
      const res = await fetch('/api/ai-analysis/schedule');
      const data = await res.json();
      setIntervalHours(data.intervalHours ?? 9);
      setInfosecLimit(data.infosecLimit ?? 50);
      if (data.sources) setSelectedSources(data.sources);
    } catch { }
  }, []);

  const saveConfig = async (newConfig: FullConfig) => {
    setConfigSaving(true);
    try {
      const res = await fetch('/api/ai-analysis/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });
      if (res.ok) {
        alert('配置已保存');
        await loadConfig();
      } else {
        const err = await res.json();
        alert('保存失败: ' + (err.error || '未知错误'));
      }
    } catch (err: any) {
      alert('保存失败: ' + err.message);
    } finally {
      setConfigSaving(false);
    }
  };

  const saveSchedule = async () => {
    setSavingSchedule(true);
    try {
      await fetch('/api/ai-analysis/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intervalHours, infosecLimit, sources: selectedSources })
      });
      alert('定时设置已保存');
    } catch (err: any) {
      alert('保存失败: ' + err.message);
    } finally {
      setSavingSchedule(false);
    }
  };

  const runAnalysis = async () => {
    setAiLoading(true);
    setAiResult(null);
    setAiCards([]);
    setCurrentAnalysisTime(new Date().toLocaleString('zh-CN'));
    try {
      const res = await fetch('/api/ai-analysis/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: customPrompt || '分析当前全球安全局势、金融市场和网络威胁。',
          sources: selectedSources,
          infosecLimit: infosecLimit
        })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAiResult(data.result || '分析完成');
      // 对 cards 中的 evidence 进行安全转换
      const safeCards = (data.cards || []).map((card: any) => ({
        ...card,
        evidence: safeEvidence(card.evidence)
      }));
      setAiCards(safeCards);
      loadHistory();
    } catch (err: any) {
      console.error('Analysis error:', err);
      setAiResult(`分析失败：${err.message || '网络错误，请检查后端服务'}`);
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadHistory();
      loadConfig();
      loadSchedule();
    }
  }, [isOpen, loadHistory, loadConfig, loadSchedule]);

  const updateConfigGroup = (group: keyof FullConfig, field: keyof ConfigGroup, value: string) => {
    setConfig(prev => ({
      ...prev,
      [group]: { ...prev[group], [field]: value }
    }));
  };

  const ConfigSection = ({ title, groupKey, priorityNote, hint }: { title: string; groupKey: keyof FullConfig; priorityNote?: string; hint?: string }) => (
    <div className="mb-4 p-2 rounded border border-[#D4AF37]/20 bg-black/20">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[10px] font-mono font-bold text-[#D4AF37]">{title}</span>
        {priorityNote && <span className="text-[8px] font-mono text-[var(--text-muted)]">{priorityNote}</span>}
      </div>
      <div className="space-y-2">
        <input type="text" placeholder="API URL" value={config[groupKey].apiUrl} onChange={e => updateConfigGroup(groupKey, 'apiUrl', e.target.value)} className="w-full bg-black/50 border border-[var(--border-primary)] rounded px-2 py-1 text-[10px] font-mono text-white" />
        <input type="password" placeholder="API Key" value={config[groupKey].apiKey} onChange={e => updateConfigGroup(groupKey, 'apiKey', e.target.value)} className="w-full bg-black/50 border border-[var(--border-primary)] rounded px-2 py-1 text-[10px] font-mono text-white" />
        <input type="text" placeholder="模型名称" value={config[groupKey].model} onChange={e => updateConfigGroup(groupKey, 'model', e.target.value)} className="w-full bg-black/50 border border-[var(--border-primary)] rounded px-2 py-1 text-[10px] font-mono text-white" />
        {hint && <div className="text-[8px] font-mono text-[var(--text-muted)] mt-1">{hint}</div>}
      </div>
    </div>
  );

  const renderCardContent = (card: AnalysisCard, idx: number, time?: string) => {
    const safeEv = safeEvidence(card.evidence);
    return (
      <div key={idx} className="p-2 rounded-lg border-l-4 bg-black/20" style={{ borderLeftColor: confidenceColor(card.confidence) }}>
        <div className="flex justify-between items-start">
          <span className="text-[11px] font-mono font-bold text-[#D4AF37]">{card.conclusion}</span>
          <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: `${confidenceColor(card.confidence)}20`, color: confidenceColor(card.confidence) }}>{card.confidence}</span>
        </div>
        <div className="text-[9px] font-mono text-[var(--text-secondary)] mt-1 whitespace-pre-wrap break-words">
          {safeEv.includes('|') ? <pre className="whitespace-pre-wrap break-words">{safeEv}</pre> : `📌 ${safeEv}`}
        </div>
        <div className="text-[8px] font-mono text-[var(--text-muted)] mt-0.5 flex justify-between items-center">
          <span>🎯 {card.relevance}</span>
          {time && <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{time}</span>}
        </div>
      </div>
    );
  };

  const renderContent = () => (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 border-b border-[var(--border-secondary)] pb-2 flex-wrap">
        <button onClick={() => setActiveTab('manual')} className={`px-3 py-1.5 rounded-md text-[10px] font-mono ${activeTab === 'manual' ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40' : 'text-[var(--text-muted)] hover:bg-white/5'}`}>立即分析</button>
        <button onClick={() => setActiveTab('history')} className={`px-3 py-1.5 rounded-md text-[10px] font-mono ${activeTab === 'history' ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40' : 'text-[var(--text-muted)] hover:bg-white/5'}`}>分析历史</button>
        <button onClick={() => setActiveTab('config')} className={`px-3 py-1.5 rounded-md text-[10px] font-mono ${activeTab === 'config' ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40' : 'text-[var(--text-muted)] hover:bg-white/5'}`}>多AI配置</button>
        <button onClick={() => setActiveTab('schedule')} className={`px-3 py-1.5 rounded-md text-[10px] font-mono ${activeTab === 'schedule' ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40' : 'text-[var(--text-muted)] hover:bg-white/5'}`}>定时设置</button>
      </div>

      {activeTab === 'manual' && (
        <div className="space-y-3">
          <textarea
            value={customPrompt}
            onChange={e => setCustomPrompt(e.target.value)}
            placeholder="可选：输入自定义分析提示词（留空则使用默认提示）"
            className="w-full bg-black/50 border border-[var(--border-primary)] rounded-lg p-2 text-[10px] font-mono resize-none h-20 placeholder:text-[var(--text-muted)]/50"
          />
          <div className="space-y-2">
            <span className="text-[9px] font-mono text-[var(--text-muted)]">选择分析数据源</span>
            <div className="grid grid-cols-2 gap-1">
              <label className="flex items-center gap-1.5 text-[9px] font-mono"><input type="checkbox" checked={selectedSources.news} onChange={e => setSelectedSources(p => ({ ...p, news: e.target.checked }))} /> 新闻</label>
              <label className="flex items-center gap-1.5 text-[9px] font-mono"><input type="checkbox" checked={selectedSources.earthquakes} onChange={e => setSelectedSources(p => ({ ...p, earthquakes: e.target.checked }))} /> 地震</label>
              <label className="flex items-center gap-1.5 text-[9px] font-mono"><input type="checkbox" checked={selectedSources.fires} onChange={e => setSelectedSources(p => ({ ...p, fires: e.target.checked }))} /> 火灾</label>
              <label className="flex items-center gap-1.5 text-[9px] font-mono"><input type="checkbox" checked={selectedSources.flights} onChange={e => setSelectedSources(p => ({ ...p, flights: e.target.checked }))} /> 航班</label>
              <label className="flex items-center gap-1.5 text-[9px] font-mono"><input type="checkbox" checked={selectedSources.maritime} onChange={e => setSelectedSources(p => ({ ...p, maritime: e.target.checked }))} /> 海事</label>
              <label className="flex items-center gap-1.5 text-[9px] font-mono"><input type="checkbox" checked={selectedSources.markets} onChange={e => setSelectedSources(p => ({ ...p, markets: e.target.checked }))} /> 市场</label>
              <label className="flex items-center gap-1.5 text-[9px] font-mono"><input type="checkbox" checked={selectedSources.malware} onChange={e => setSelectedSources(p => ({ ...p, malware: e.target.checked }))} /> 恶意软件</label>
              <label className="flex items-center gap-1.5 text-[9px] font-mono"><input type="checkbox" checked={selectedSources.gdelt} onChange={e => setSelectedSources(p => ({ ...p, gdelt: e.target.checked }))} /> 冲突事件</label>
              <label className="flex items-center gap-1.5 text-[9px] font-mono"><input type="checkbox" checked={selectedSources.infosec} onChange={e => setSelectedSources(p => ({ ...p, infosec: e.target.checked }))} /> 安全情报</label>
            </div>
          </div>
          <button onClick={runAnalysis} disabled={aiLoading} className="w-full py-2 rounded-lg bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#D4AF37] text-[10px] font-mono font-bold flex items-center justify-center gap-2">
            {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {aiLoading ? '分析中...' : '立即分析'}
          </button>
          {aiCards.length > 0 && (
            <div className="space-y-2 max-h-[400px] overflow-y-auto styled-scrollbar">
              {aiCards.map((card, idx) => renderCardContent(card, idx, currentAnalysisTime))}
            </div>
          )}
          {aiResult && aiCards.length === 0 && <div className="bg-black/20 border border-[#D4AF37]/30 rounded-lg p-3 text-[10px] font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">{aiResult}</div>}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-3 max-h-[400px] overflow-y-auto styled-scrollbar">
          {historyLoading && <div className="text-center py-4 text-[10px]">加载中...</div>}
          {!historyLoading && history.length === 0 && <div className="text-center py-4 text-[10px]">暂无分析记录</div>}
          {history.map((item) => (
            <div key={item.id} className="bg-black/20 border border-[var(--border-primary)] rounded-lg p-2">
              <div className="text-[8px] text-[var(--text-muted)] mb-1 flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{new Date(item.timestamp).toLocaleString('zh-CN')}</div>
              {item.cards && item.cards.length > 0 ? (
                <div className="space-y-1.5">
                  {item.cards.map((card, i) => renderCardContent(card, i, new Date(item.timestamp).toLocaleString('zh-CN')))}
                </div>
              ) : (
                <div className="text-[9px] font-mono whitespace-pre-wrap break-words">{item.content}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'config' && (
        <div translate="no" className="space-y-3 max-h-[400px] overflow-y-auto styled-scrollbar">
          <ConfigSection title="🔧 通用模型 (最高优先级)" groupKey="general" priorityNote="用于所有分析（推理、预处理等）" hint="推荐：DeepSeek-V3 / GPT-4o" />
          <ConfigSection title="🛡️ 安全情报专用" groupKey="infosec" priorityNote="优先用于安全情报拉取（提取摘要/分类/评分）" hint="推荐：免费轻量模型，如硅基流动 glm-4-flash" />
          <ConfigSection title="📝 预处理模型" groupKey="preprocess" priorityNote="用于文本清洗/去重压缩" hint="推荐：轻量模型" />
          <ConfigSection title="🧠 推理模型" groupKey="reasoning" priorityNote="用于复杂推理分析（最贵，最后使用）" hint="推荐：DeepSeek-R1 / o1" />
          <div className="flex gap-2 mt-2">
            <button onClick={() => saveConfig(config)} disabled={configSaving} className="flex-1 py-1.5 rounded bg-[#D4AF37]/20 text-[#D4AF37] text-[9px] font-mono flex items-center justify-center gap-1"><Save className="w-3 h-3" /> {configSaving ? '保存中...' : '保存全部配置'}</button>
          </div>
        </div>
      )}

      {activeTab === 'schedule' && (
        <div translate="no" className="space-y-3 p-2 rounded border border-[#D4AF37]/30 bg-black/20">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-[var(--text-primary)]">自动分析间隔（小时）</span>
            <select value={intervalHours} onChange={e => setIntervalHours(Number(e.target.value))} className="bg-black/50 border border-[var(--border-primary)] rounded px-2 py-1 text-[10px] font-mono">
              <option value={1}>1小时</option><option value={3}>3小时</option><option value={6}>6小时</option>
              <option value={12}>12小时</option><option value={24}>24小时</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-[var(--text-primary)]">情报分析条数</span>
            <input type="number" min="1" max="500" value={infosecLimit} onChange={e => setInfosecLimit(Math.min(500, Math.max(1, Number(e.target.value))))} className="bg-black/50 border border-[var(--border-primary)] rounded px-2 py-1 text-[10px] font-mono text-white w-24" />
          </div>
          <div className="space-y-2">
            <span className="text-[10px] font-mono text-[var(--text-primary)]">默认数据源</span>
            <div className="grid grid-cols-2 gap-1">
              <label className="flex items-center gap-1.5 text-[9px] font-mono"><input type="checkbox" checked={selectedSources.news} onChange={e => setSelectedSources(p => ({ ...p, news: e.target.checked }))} /> 新闻</label>
              <label className="flex items-center gap-1.5 text-[9px] font-mono"><input type="checkbox" checked={selectedSources.earthquakes} onChange={e => setSelectedSources(p => ({ ...p, earthquakes: e.target.checked }))} /> 地震</label>
              <label className="flex items-center gap-1.5 text-[9px] font-mono"><input type="checkbox" checked={selectedSources.fires} onChange={e => setSelectedSources(p => ({ ...p, fires: e.target.checked }))} /> 火灾</label>
              <label className="flex items-center gap-1.5 text-[9px] font-mono"><input type="checkbox" checked={selectedSources.flights} onChange={e => setSelectedSources(p => ({ ...p, flights: e.target.checked }))} /> 航班</label>
              <label className="flex items-center gap-1.5 text-[9px] font-mono"><input type="checkbox" checked={selectedSources.maritime} onChange={e => setSelectedSources(p => ({ ...p, maritime: e.target.checked }))} /> 海事</label>
              <label className="flex items-center gap-1.5 text-[9px] font-mono"><input type="checkbox" checked={selectedSources.markets} onChange={e => setSelectedSources(p => ({ ...p, markets: e.target.checked }))} /> 市场</label>
              <label className="flex items-center gap-1.5 text-[9px] font-mono"><input type="checkbox" checked={selectedSources.malware} onChange={e => setSelectedSources(p => ({ ...p, malware: e.target.checked }))} /> 恶意软件</label>
              <label className="flex items-center gap-1.5 text-[9px] font-mono"><input type="checkbox" checked={selectedSources.gdelt} onChange={e => setSelectedSources(p => ({ ...p, gdelt: e.target.checked }))} /> 冲突事件</label>
              <label className="flex items-center gap-1.5 text-[9px] font-mono"><input type="checkbox" checked={selectedSources.infosec} onChange={e => setSelectedSources(p => ({ ...p, infosec: e.target.checked }))} /> 安全情报</label>
            </div>
          </div>
          <button onClick={saveSchedule} disabled={savingSchedule} className="w-full py-1.5 rounded bg-[#D4AF37]/20 text-[#D4AF37] text-[10px] font-mono flex items-center justify-center gap-1">
            <Save className="w-3 h-3" /> {savingSchedule ? '保存中...' : '保存定时设置'}
          </button>
        </div>
      )}
    </div>
  );

  // 移动端浮层
  if (isMobile) {
    if (!isOpen) return null;
    const mobileContent = (
      <div className="notranslate" lang="en" translate="no" style={{ display: 'contents' }}>
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="glass-panel w-[90vw] max-w-[400px] h-[80vh] max-h-[600px] flex flex-col rounded-xl overflow-hidden">
            <div className="flex justify-between items-center px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-[#D4AF37]" /><span className="text-[14px] font-mono font-bold text-white">AI 分析</span></div>
              <button onClick={onClose} className="text-white/60 hover:text-white p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 styled-scrollbar">{renderContent()}</div>
          </div>
        </div>
      </div>
    );
    if (typeof document !== 'undefined') return createPortal(mobileContent, document.body);
    return mobileContent;
  }

  if (!isOpen) return null;

  if (isFullScreen && mounted && typeof document !== 'undefined') {
    const fullContent = (
      <div className="notranslate" lang="en" translate="no" style={{ display: 'contents' }}>
        <div className="fixed top-4 bottom-4 right-4 w-[40vw] min-w-[500px] max-w-[700px] z-[999] glass-panel bg-[#0a0a09]/95 backdrop-blur-2xl border border-[#D4AF37]/40 rounded-xl flex flex-col overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-secondary)] bg-[#111]">
            <div className="flex items-center gap-3"><Sparkles className="w-5 h-5 text-[#D4AF37]" /><span className="text-[16px] font-mono font-bold">AI 智能分析</span></div>
            <div className="flex items-center gap-2"><button onClick={() => setIsFullScreen(false)} className="p-2 hover:bg-white/5 rounded"><Minimize2 className="w-4 h-4" /></button><button onClick={onClose} className="p-2 hover:bg-white/5 rounded"><X className="w-4 h-4" /></button></div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 styled-scrollbar">{renderContent()}</div>
        </div>
      </div>
    );
    return createPortal(fullContent, document.body);
  }

  return (
    <div className="notranslate" lang="en" translate="no">
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="glass-panel flex flex-col w-80 h-[500px] max-h-[80vh] resize-y"
      >
        <div className="flex justify-between items-center px-4 py-3 border-b border-[rgba(255,255,255,0.05)]">
          <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 flex-1">
            <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span className="hud-text text-[12px] text-[var(--text-primary)]">AI 分析</span>
          </button>
          <div className="flex items-center gap-3">
            <button onClick={() => setIsFullScreen(true)} className="text-[var(--text-muted)] hover:text-white transition-colors" title="全屏">
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-osiris-pulse" />
            <button onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="w-3.5 h-3.5 text-[var(--text-muted)]" /> : <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
            </button>
            <button onClick={onClose} className="text-[var(--text-muted)] hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-auto px-3 py-3 flex-1 styled-scrollbar"
            >
              {renderContent()}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
