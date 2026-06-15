'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2, History, Play, Settings, ChevronDown, ChevronUp, Maximize2, Minimize2 } from 'lucide-react';

interface AiAnalysisPanelProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function AiAnalysisPanel({ isOpen, onClose }: AiAnalysisPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [maximized, setMaximized] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'history' | 'manual' | 'config'>('history');
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [configSaving, setConfigSaving] = useState(false);
  const [history, setHistory] = useState<{ id: number; timestamp: number; content: string }[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/ai-analysis/history');
      const data = await res.json();
      setHistory(data.history || []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const runAi = async () => {
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await fetch('/api/ai-analysis', { method: 'POST' });
      const data = await res.json();
      setAiResult(data.content);
    } catch (err: any) {
      setAiResult('分析失败: ' + err.message);
    } finally {
      setAiLoading(false);
    }
    loadHistory();
  };

  const loadConfig = async () => {
    setApiUrl('');
    setApiKey('');
    setModel('');
  };

  const saveConfig = async () => {
    setConfigSaving(true);
    try {
      await fetch('/api/ai-analysis/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiUrl, apiKey, model })
      });
      alert('配置已保存');
    } finally {
      setConfigSaving(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadHistory();
      loadConfig();
    }
  }, [isOpen]);

  const content = (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ delay: 0.3, duration: 0.6 }}
      className={`glass-panel flex flex-col overflow-hidden pointer-events-auto shrink-0 h-[500px] max-h-[80vh] resize-y ${maximized ? 'fixed inset-4 z-[9999] bg-[#0a0a09]/95 backdrop-blur-3xl' : ''}`}
      style={{ width: maximized ? 'auto' : '320px' }}
    >
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.05)] bg-[rgba(0,0,0,0.3)] hover:bg-[var(--hover-accent)] transition-colors">
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 flex-1">
          <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
          <span className="hud-text text-[12px] text-[var(--text-primary)]">AI 智能分析</span>
        </button>
        <div className="flex items-center gap-3">
          <button onClick={() => setMaximized(!maximized)} className="text-[var(--text-muted)] hover:text-white transition-colors" title={maximized ? "还原" : "最大化"}>
            {maximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-osiris-pulse" />
          <button onClick={onClose}>
            {expanded ? <ChevronUp className="w-3.5 h-3.5 text-[var(--text-muted)]" /> : <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
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
            className="overflow-y-auto px-3 py-3 flex-1 min-h-0 styled-scrollbar"
          >
            <div className="flex gap-1 mb-3">
              <button
                onClick={() => setActiveSubTab('history')}
                className={`px-3 py-1.5 rounded text-[10px] font-mono font-bold tracking-wider ${activeSubTab === 'history' ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30' : 'text-[var(--text-muted)] hover:text-white'}`}
              >
                分析历史
              </button>
              <button
                onClick={() => setActiveSubTab('manual')}
                className={`px-3 py-1.5 rounded text-[10px] font-mono font-bold tracking-wider ${activeSubTab === 'manual' ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30' : 'text-[var(--text-muted)] hover:text-white'}`}
              >
                立即分析
              </button>
              <button
                onClick={() => setActiveSubTab('config')}
                className={`px-3 py-1.5 rounded text-[10px] font-mono font-bold tracking-wider ${activeSubTab === 'config' ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30' : 'text-[var(--text-muted)] hover:text-white'}`}
              >
                API 设置
              </button>
            </div>
            {activeSubTab === 'history' && (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {historyLoading && <div className="text-center py-4 text-[10px] font-mono text-[var(--text-muted)]">加载历史中...</div>}
                {!historyLoading && history.length === 0 && <div className="text-center py-4 text-[10px] font-mono text-[var(--text-muted)]">暂无分析历史</div>}
                {history.map((item) => (
                  <div key={item.id} className="bg-black/20 border border-[var(--border-primary)] rounded-lg p-3">
                    <div className="text-[9px] font-mono text-[var(--text-muted)] mb-2">{new Date(item.timestamp).toLocaleString()}</div>
                    <div className="text-[10px] font-mono whitespace-pre-wrap leading-relaxed">{item.content}</div>
                  </div>
                ))}
              </div>
            )}
            {activeSubTab === 'manual' && (
              <div>
                <button onClick={runAi} disabled={aiLoading} className="px-4 py-1.5 rounded bg-[#D4AF37]/15 text-[#D4AF37] hover:bg-[#D4AF37]/30 text-[10px] font-mono font-bold flex items-center gap-1 mb-3">
                  {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  {aiLoading ? '分析中...' : '立即分析'}
                </button>
                {aiResult && <div className="bg-black/20 p-3 rounded border border-[#D4AF37]/30 text-[11px] font-mono whitespace-pre-wrap leading-relaxed">{aiResult}</div>}
              </div>
            )}
            {activeSubTab === 'config' && (
              <div className="space-y-2 p-2 rounded border border-[#D4AF37]/30 bg-black/20">
                <div><label className="text-[9px] font-mono text-[var(--text-muted)] block mb-1">API URL</label>
                  <input type="text" value={apiUrl} onChange={e => setApiUrl(e.target.value)} className="w-full bg-black/50 border border-[var(--border-primary)] rounded px-2 py-1 text-[10px] font-mono text-white" placeholder="https://api.siliconflow.cn/v1/chat/completions" />
                </div>
                <div><label className="text-[9px] font-mono text-[var(--text-muted)] block mb-1">API Key</label>
                  <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} className="w-full bg-black/50 border border-[var(--border-primary)] rounded px-2 py-1 text-[10px] font-mono text-white" placeholder="sk-..." />
                </div>
                <div><label className="text-[9px] font-mono text-[var(--text-muted)] block mb-1">模型名称</label>
                  <input type="text" value={model} onChange={e => setModel(e.target.value)} className="w-full bg-black/50 border border-[var(--border-primary)] rounded px-2 py-1 text-[10px] font-mono text-white" placeholder="deepseek-ai/DeepSeek-V3" />
                </div>
                <button onClick={saveConfig} disabled={configSaving} className="px-3 py-1 rounded bg-[#D4AF37]/20 text-[#D4AF37] hover:bg-[#D4AF37]/40 text-[10px] font-mono">{configSaving ? '保存中...' : '保存配置'}</button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );

  if (!isOpen) return null;
  if (maximized && mounted && typeof document !== 'undefined') {
    const { createPortal } = require('react-dom');
    return createPortal(content, document.body);
  }
  return content;
}
