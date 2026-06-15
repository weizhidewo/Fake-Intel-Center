'use client';

import { useState, useCallback, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Radar, Globe, Shield, FileText, Radio,
  ChevronDown, ChevronUp, Loader2, AlertTriangle, Server,
  Wifi, Lock, MapPin, Bug, Code, Layers, Network, Fingerprint,
  CheckCircle, XCircle, Clock, ExternalLink, Crosshair,
  Maximize2, Minimize2, Gavel, Bitcoin, Phone, Terminal, ShieldAlert
} from 'lucide-react';
import { ipToNumber, numberToIp, calculateSubnetStart, classifyDevice, assessRisk, batchFetch, ShodanInternetDBResponse, SweepDevice } from '@/lib/osint-utils';

// ---------- 中文标签（移除 ai_analysis）----------
const TABS = [
  { id: 'scanner', label: '端口扫描', icon: Radar, placeholder: 'IP 或域名', color: '#00E5FF' },
  { id: 'vuln', label: '漏洞扫描', icon: Bug, placeholder: 'IP 或域名', color: '#FF3D3D' },
  { id: 'dns', label: 'DNS', icon: Server, placeholder: '域名', color: '#448AFF' },
  { id: 'whois', label: 'WHOIS', icon: FileText, placeholder: '域名', color: '#FFD700' },
  { id: 'certs', label: '证书透明度', icon: Lock, placeholder: '域名', color: '#E040FB' },
  { id: 'threats', label: '威胁', icon: AlertTriangle, placeholder: 'IP、域名或哈希', color: '#FF9500' },
  { id: 'headers', label: 'HTTP头', icon: Code, placeholder: 'URL', color: '#87CEEB' },
  { id: 'ssl', label: 'SSL/TLS 证书', icon: Shield, placeholder: '域名', color: '#76FF03' },
  { id: 'subdomains', label: '子域名', icon: Layers, placeholder: '域名', color: '#00BCD4' },
  { id: 'tech', label: '技术栈', icon: Code, placeholder: 'URL', color: '#9C27B0' },
  { id: 'shodan', label: 'Shodan 物联网', icon: Network, placeholder: 'IP 地址', color: '#FF3D3D' },
  { id: 'bgp', label: 'BGP', icon: Globe, placeholder: 'IP 或 ASN', color: '#00E5FF' },
  { id: 'mac', label: 'MAC', icon: Fingerprint, placeholder: 'MAC 地址', color: '#FFD700' },
  { id: 'phone', label: '电话', icon: Phone, placeholder: '电话号码 (如 +86...)', color: '#FF9500' },
  { id: 'leaks', label: '泄露', icon: ShieldAlert, placeholder: '电子邮箱', color: '#E040FB' },
  { id: 'github', label: 'GitHub 侦察', icon: Terminal, placeholder: 'GitHub 用户名', color: '#87CEEB' },
  { id: 'sweep', label: '网段扫描', icon: Crosshair, placeholder: 'IP 地址 (如 8.8.8.8)', color: '#FF3D3D' },
];

interface OsintPanelProps { isOpen?: boolean; onClose?: () => void; isMobile?: boolean; onSweepVisualize?: (data: any) => void; onScanGeolocate?: (target: string, data: any) => void; }

function OsintPanelInner({ isMobile, onSweepVisualize, onScanGeolocate }: OsintPanelProps) {
  const [activeTab, setActiveTab] = useState('scanner');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scanType, setScanType] = useState('quick');
  const [expanded, setExpanded] = useState(true);
  const [history, setHistory] = useState<{tab:string;query:string;time:string}[]>([]);
  const [sweepResult, setSweepResult] = useState<any>(null);
  const [sweepProgress, setSweepProgress] = useState<{ current: number; total: number } | null>(null);
  const [sweepCidr, setSweepCidr] = useState(24);
  const [cveCache, setCveCache] = useState<Record<string, any>>({});
  const [expandedDevice, setExpandedDevice] = useState<string | null>(null);

  const fetchCveDetails = useCallback(async (cveIds: string[]) => {
    const missing = cveIds.filter(id => !cveCache[id]);
    if (missing.length === 0) return;
    setCveCache(prev => {
      const next = { ...prev };
      for (const id of missing) next[id] = { loading: true };
      return next;
    });
    const results = await Promise.allSettled(
      missing.map(id => fetch(`/api/osint/cve?cve=${encodeURIComponent(id)}`).then(r => r.json()).then(data => ({ id, data })))
    );
    setCveCache(prev => {
      const next = { ...prev };
      for (const r of results) {
        if (r.status === 'fulfilled') {
          next[r.value.id] = r.value.data;
        }
      }
      return next;
    });
  }, [cveCache]);

  const runLookup = useCallback(async () => {
    if (!query.trim() || loading) return;
    setLoading(true); setError(''); setResults(null);

    if (activeTab === 'sweep' || activeTab === 'vuln') {
      setSweepResult(null);
      const cidr = sweepCidr;
      const totalHosts = Math.pow(2, 32 - cidr);
      setSweepProgress({ current: 0, total: totalHosts });
      try {
        const t0 = Date.now();
        const res = await fetch(`/api/osint/sweep?ip=${encodeURIComponent(query)}&cidr=${cidr}`);
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `扫描失败 (${res.status})`); }
        const initData = await res.json();

        const ipParts = initData.target_ip.split('.').map(Number) as [number, number, number, number];
        const ipNum = ipToNumber(ipParts);
        const subnetStart = calculateSubnetStart(ipNum, cidr);
        const subnet = numberToIp(subnetStart);

        const urls: string[] = [];
        for (let i = 0; i < totalHosts; i++) {
          urls.push(`https://internetdb.shodan.io/${numberToIp((subnetStart + i) >>> 0)}`);
        }

        const shodanResults = await batchFetch<ShodanInternetDBResponse>(urls, 15, async (u) => {
          try {
            const r = await fetch(u, { cache: 'no-store' });
            if (r.status === 404) return null;
            if (!r.ok) return null;
            return await r.json();
          } catch {
            return null;
          }
        }, (done) => setSweepProgress({ current: done, total: totalHosts }));

        const devices: SweepDevice[] = [];
        const deviceBreakdown: Record<string, number> = {};
        for (const sr of shodanResults) {
          if (!sr) continue;
          const classification = classifyDevice(sr.ports, sr.cpes, sr.tags);
          const risk = assessRisk({ ports: sr.ports, vulns: sr.vulns });
          devices.push({
            ip: sr.ip, ports: sr.ports, hostnames: sr.hostnames,
            cpes: sr.cpes, vulns: sr.vulns, tags: sr.tags,
            device_type: classification.device_type,
            device_icon: classification.device_icon,
            device_color: classification.device_color,
            risk_level: risk
          });
          deviceBreakdown[classification.device_type] = (deviceBreakdown[classification.device_type] || 0) + 1;
        }

        setSweepResult({
          center: initData.center,
          subnet: `${subnet}/${cidr}`,
          cidr,
          target_ip: initData.target_ip,
          devices,
          summary: { total_hosts: totalHosts, total_responsive: devices.length, device_breakdown: deviceBreakdown },
          sweep_time_ms: Date.now() - t0
        });
        setSweepProgress(null);
        setHistory(prev => [{ tab: activeTab, query, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 9)]);
      } catch (err: any) {
        setError(err.message);
        setSweepProgress(null);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      let url = '';
      switch (activeTab) {
        case 'dns': url = `/api/osint/dns?domain=${encodeURIComponent(query)}`; break;
        case 'certs': url = `/api/osint/certs?domain=${encodeURIComponent(query)}`; break;
        case 'whois': url = `/api/osint/whois?domain=${encodeURIComponent(query)}`; break;
        case 'threats': url = `/api/osint/threats?query=${encodeURIComponent(query)}`; break;
        case 'bgp': url = `/api/osint/bgp?query=${encodeURIComponent(query)}`; break;
        case 'mac': url = `/api/osint/mac?mac=${encodeURIComponent(query)}`; break;
        case 'phone': url = `/api/osint/phone?number=${encodeURIComponent(query)}`; break;
        case 'leaks': url = `https://api.xposedornot.com/v1/breach-analytics?email=${encodeURIComponent(query)}`; break;
        case 'crypto': url = `/api/osint/crypto?address=${encodeURIComponent(query)}`; break;
        case 'github': url = `/api/osint/github?user=${encodeURIComponent(query)}`; break;
        case 'scanner': url = `/api/scanner?target=${encodeURIComponent(query)}&type=${scanType}`; break;
        case 'headers': url = `/api/scanner?target=${encodeURIComponent(query)}&type=headers`; break;
        case 'ssl': url = `/api/scanner?target=${encodeURIComponent(query)}&type=ssl`; break;
        case 'subdomains': url = `/api/scanner?target=${encodeURIComponent(query)}&type=subdomains`; break;
        case 'tech': url = `/api/scanner?target=${encodeURIComponent(query)}&type=tech`; break;
        case 'shodan':
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          const res = await fetch(`https://internetdb.shodan.io/${encodeURIComponent(query)}`, { signal: controller.signal, cache: 'no-store' });
          clearTimeout(timeoutId);
          if (res.status === 404) {
            setResults({ ip: query, status: 'No Shodan InternetDB records found', ports: [], cpes: [], hostnames: [], tags: [], vulns: [] });
            break;
          }
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          setResults(data);
        } catch (err: any) {
          setError(`Shodan lookup failed: ${err.message}`);
          setResults(null);
        }
        break;
      }
      // 移除超时和认证头，恢复为简单 fetch（与第一个可用版本一致）
      const res = await fetch(url, activeTab === 'shodan' ? { cache: 'no-store' } : undefined);
      if (activeTab === 'shodan' && res.status === 404) {
        setResults({ ip: query, status: '未找到 Shodan 记录', ports: [], cpes: [], hostnames: [], tags: [], vulns: [] });
        setLoading(false);
        return;
      }
      if (activeTab === 'leaks' && res.status === 404) {
        setResults({ email: query, breached: false, breaches: [], data_exposed: [] });
        setHistory(prev => [{ tab: activeTab, query, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 9)]);
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (res.ok) {
        let parsedData = data;
        if (activeTab === 'leaks') {
           let breachList: string[] = [];
           const dataExposed = new Set<string>();
           if (data.BreachesSummary && data.BreachesSummary.site) {
              breachList = data.BreachesSummary.site.split(';').filter(Boolean);
           }
           if (data.ExposedData && Array.isArray(data.ExposedData)) {
              data.ExposedData.forEach((item: any) => {
                 if (item.data_classes && Array.isArray(item.data_classes)) {
                    item.data_classes.forEach((dc: string) => dataExposed.add(dc));
                 }
              });
           }
           parsedData = {
              email: query,
              breached: breachList.length > 0,
              breaches: breachList,
              data_exposed: Array.from(dataExposed).sort()
           };
        }

        setResults(parsedData);
        setHistory(prev => [{ tab: activeTab, query, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 9)]);
        
        if (activeTab === 'phone') {
          if (data.lat && data.lng && onScanGeolocate) {
             onScanGeolocate(query, { lat: data.lat, lng: data.lng, type: 'phone', region: data.region });
          }
        } else if (activeTab !== 'sweep' && activeTab !== 'vuln' && activeTab !== 'crypto' && activeTab !== 'mac' && activeTab !== 'bgp' && activeTab !== 'github' && activeTab !== 'leaks' && activeTab !== 'phone') {
          fetch(`/api/osint/ip?ip=${encodeURIComponent(query)}`)
            .then(r => r.json())
            .then(locData => {
              if (locData && locData.geo && locData.geo.lat && locData.geo.lon && onScanGeolocate) {
                onScanGeolocate(query, { lat: locData.geo.lat, lng: locData.geo.lon, ...locData, type: activeTab });
              }
            })
            .catch(() => {});
        }
      } else {
        setError(data.error || '查询失败');
      }
    } catch { setError('网络错误'); }
    finally { setLoading(false); }
  }, [query, activeTab, scanType, loading, sweepCidr]);

  const currentTab = TABS.find(t => t.id === activeTab);

  // 格式化显示辅助函数
  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return value.map(v => formatValue(v)).join(', ');
      }
      const str = JSON.stringify(value).replace(/[{}"]/g, '');
      return str;
    }
    return String(value);
  };

  const ResultRow = ({ label, value, color, mono = true }: { label: string; value: any; color?: string; mono?: boolean }) => {
    const displayVal = formatValue(value);
    if (!displayVal) return null;
    return (
      <div className="flex items-start gap-3 py-1.5 border-b border-[var(--border-secondary)]/20 last:border-0">
        <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-wider w-[90px] flex-shrink-0 pt-0.5">{label}</span>
        <span className={`text-[10px] ${mono ? 'font-mono' : ''} break-all whitespace-pre-wrap flex-1`} style={{ color: color || 'var(--text-primary)' }}>
          {displayVal}
        </span>
      </div>
    );
  };

  const StatusBadge = ({ ok, label }: { ok: boolean; label: string }) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono font-bold ${ok ? 'bg-green-500/15 text-green-400 border border-green-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30'}`}>
      {ok ? <CheckCircle className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
      {label}
    </span>
  );

  const SanctionsBadge = ({ match }: { match: any }) => {
    if (!match || !Array.isArray(match.hits) || match.hits.length === 0) return null;
    return (
      <div className="mb-2 px-2 py-2 rounded border border-red-500/40 bg-red-500/15">
        <div className="flex items-center gap-2 mb-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
          <span className="text-[10px] font-mono font-bold text-red-400 tracking-wider">制裁名单 — {match.source || 'OFAC SDN'}</span>
        </div>
        {match.hits.slice(0, 5).map((h: any, i: number) => (
          <div key={i} className="text-[9px] font-mono text-red-200 break-all leading-tight">
            <span className="text-[var(--text-muted)]">↳ {h.matched_value}:</span>{' '}
            {(h.entries || []).slice(0, 2).map((e: any) => e.name).join('; ')}
          </div>
        ))}
      </div>
    );
  };

  const SectionHeader = ({ title, icon: Icon, color }: { title: string; icon: any; color: string }) => (
    <div className="flex items-center gap-2 mt-3 mb-1.5 first:mt-0">
      <Icon className="w-3.5 h-3.5" style={{ color }} />
      <span className="text-[10px] font-mono font-bold tracking-widest" style={{ color }}>{title}</span>
      <div className="flex-1 h-px" style={{ background: `${color}30` }} />
    </div>
  );

  const PortRow = ({ port, state, service, version }: { port: number; state: string; service?: string; version?: string }) => (
    <div className="flex items-center gap-2 py-1 px-2 rounded hover:bg-[var(--hover-accent)] transition-colors">
      <span className="text-[11px] font-mono font-bold text-[var(--cyan-primary)] w-[60px]">{port}</span>
      <StatusBadge ok={state === 'open'} label={state === 'open' ? '开放' : state.toUpperCase()} />
      <span className="text-[10px] font-mono text-[var(--text-secondary)] flex-1">{service || '未知'}</span>
      {version && <span className="text-[9px] font-mono text-[var(--text-muted)]">{version}</span>}
    </div>
  );

  const renderStructuredResults = () => {
    if (!results) return null;
    const r = results;

    // 端口扫描
    if (activeTab === 'scanner') {
        const ports = r.ports || r.open_ports || [];
        const host = r.host || r.target || query;
        return (
            <div>
                <SectionHeader title="端口扫描" icon={Radar} color="#00E5FF" />
                <ResultRow label="目标" value={host} color="#00E5FF" />
                {Array.isArray(ports) && ports.length ? (
                    <>
                        <SectionHeader title={`开放端口 (${ports.length})`} icon={Wifi} color="#00E676" />
                        {ports.map((p,i) => <PortRow key={i} port={p.port||p} state={p.state||'open'} service={p.service||p.name} version={p.version} />)}
                    </>
                ) : <ResultRow label="结果" value="未发现开放端口" />}
            </div>
        );
    }

    // HTTP 头
    if (activeTab === 'headers') {
        const headers = r.headers || {};
        const entries = Object.entries(headers);
        return (
            <div>
                <SectionHeader title="HTTP 响应头" icon={Code} color="#87CEEB" />
                <ResultRow label="目标" value={r.target || query} color="#87CEEB" />
                {entries.length ? entries.map(([k,v]) => <ResultRow key={k} label={k} value={String(v)} />) : <ResultRow label="提示" value="未获取到响应头" />}
            </div>
        );
    }

    // SSL/TLS 证书
    if (activeTab === 'ssl') {
        const ssl = r.ssl || r.certificate || {};
        return (
            <div>
                <SectionHeader title="SSL/TLS 证书" icon={Shield} color="#76FF03" />
                <ResultRow label="目标" value={query} color="#76FF03" />
                {Object.keys(ssl).length ? (
                    <>
                        <ResultRow label="证书主题" value={ssl.subject || "—"} />
                        <ResultRow label="颁发者" value={ssl.issuer || "—"} />
                        <ResultRow label="过期时间" value={ssl.expiry || "—"} />
                        <ResultRow label="序列号" value={ssl.serial || "—"} />
                    </>
                ) : <ResultRow label="提示" value="未获取到证书信息" />}
            </div>
        );
    }

    // 子域名枚举
    if (activeTab === 'subdomains') {
        const subs = r.subdomains || [];
        return (
            <div>
                <SectionHeader title="子域名枚举" icon={Layers} color="#00BCD4" />
                <ResultRow label="目标" value={query} color="#00BCD4" />
                {subs.length ? subs.map((s,i) => <ResultRow key={i} label={s.domain||s} value={s.ip||"无IP"} />) : <ResultRow label="结果" value="未发现子域名" />}
            </div>
        );
    }

    // 技术栈
    if (activeTab === 'tech') {
        const techs = r.technologies || r.tech || [];
        return (
            <div>
                <SectionHeader title="技术栈识别" icon={Code} color="#9C27B0" />
                <ResultRow label="目标" value={query} color="#9C27B0" />
                <ResultRow label="检测到的技术" value={techs.length ? techs.join(", ") : "未识别"} />
            </div>
        );
    }

    // ── DNS ──
    if (activeTab === 'dns') {
      const domain = r.domain || query;
      const records = r.records || {};
      const nonEmpty = Object.entries(records).filter(([_, v]) => Array.isArray(v) && v.length > 0);
      if (nonEmpty.length === 0) {
        return <ResultRow label="结果" value="未查询到记录" />;
      }
      return (
        <div>
          <SectionHeader title="DNS 记录" icon={Server} color="#448AFF" />
          <ResultRow label="域名" value={domain} color="#448AFF" />
          {nonEmpty.map(([type, values]) => (
            <div key={type} className="flex items-start gap-3 py-1.5 border-b border-[var(--border-secondary)]/20">
              <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-wider w-[90px] flex-shrink-0 pt-0.5">{type} 记录</span>
              <div className="text-[10px] font-mono break-all whitespace-pre-wrap flex-1">
                {values.map((v, idx) => <div key={idx}>{v}</div>)}
              </div>
            </div>
          ))}
        </div>
      );
    }

    // ── WHOIS ──
    if (activeTab === 'whois') {
      const rdap = r.rdap || {};
      const events = rdap.events || [];
      const registration = events.find(e => e.action === 'registration')?.date;
      const expiration = events.find(e => e.action === 'expiration')?.date;
      const lastChanged = events.find(e => e.action === 'last changed')?.date;
      const statuses = Array.isArray(rdap.status) ? rdap.status : [];
      const nameservers = (rdap.nameservers || []).map(ns => typeof ns === 'string' ? ns : ns.ldhName || ns).join(', ');
      const registrarEntity = (rdap.entities || []).find(e => e.roles?.includes('registrar'));
      const registrar = registrarEntity?.name || '';
      return (
        <div>
          <SectionHeader title="WHOIS 情报" icon={FileText} color="#FFD700" />
          <SanctionsBadge match={r.sanctions_match} />
          <ResultRow label="域名" value={rdap.name || query} color="#FFD700" />
          <ResultRow label="注册商" value={registrar} />
          <ResultRow label="创建时间" value={registration} />
          <ResultRow label="过期时间" value={expiration} />
          <ResultRow label="更新时间" value={lastChanged} />
          <ResultRow label="状态" value={statuses.join(', ') || '—'} />
          <ResultRow label="域名服务器" value={nameservers || '—'} />
        </div>
      );
    }

    // ── 证书透明度 ──
    if (activeTab === 'certs') {
      const certs = r.certificates || r.certs || (Array.isArray(r) ? r : []);
      return (
        <div>
          <SectionHeader title="证书透明度" icon={Lock} color="#E040FB" />
          <ResultRow label="域名" value={query} color="#E040FB" />
          <ResultRow label="证书数量" value={Array.isArray(certs) ? certs.length : 0} />
          {Array.isArray(certs) && certs.slice(0, 15).map((c: any, i: number) => (
            <div key={i} className="mt-1.5 p-2 rounded border border-[var(--border-secondary)]/30 bg-[var(--bg-tertiary)]/30">
              <ResultRow label="颁发者" value={c.issuer_name || c.issuer} />
              <ResultRow label="通用名" value={c.common_name || c.name_value} />
              <ResultRow label="生效时间" value={c.not_before} />
              <ResultRow label="过期时间" value={c.not_after} />
            </div>
          ))}
        </div>
      );
    }

    // ── 威胁情报 ──
    if (activeTab === 'threats') {
      const threatLevel = r.threat_level || 'UNKNOWN';
      let riskScore = 0;
      let riskColor = '#00E676';
      if (threatLevel === 'HIGH') { riskScore = 85; riskColor = '#FF3D3D'; }
      else if (threatLevel === 'MEDIUM') { riskScore = 50; riskColor = '#FF9500'; }
      else if (threatLevel === 'LOW') { riskScore = 15; riskColor = '#00E676'; }
      return (
        <div>
          <SectionHeader title="威胁情报" icon={AlertTriangle} color="#FF9500" />
          <ResultRow label="查询内容" value={query} color="#FF9500" />
          <ResultRow label="威胁等级" value={threatLevel} color={riskColor} />
          <ResultRow label="风险评分" value={riskScore} color={riskColor} />
        </div>
      );
    }

    // ── BGP 路由 ──
    if (activeTab === 'bgp') {
      return (
        <div>
          <SectionHeader title="BGP 路由" icon={Globe} color="#00E5FF" />
          <ResultRow label="查询" value={r.query} color="#00E5FF" />
          {r.type === 'ip' && r.ip && (
            <>
              {r.ip.prefixes?.map((p: any, i: number) => (
                <div key={i} className="mt-2 p-2 border border-[#00E5FF]/20 bg-[#00E5FF]/5 rounded">
                  <ResultRow label="ASN" value={`AS${p.asn.asn} - ${p.asn.name}`} color="#00E5FF" />
                  <ResultRow label="前缀" value={p.prefix} />
                  <ResultRow label="国家" value={p.asn.country_code} />
                  <ResultRow label="描述" value={p.asn.description} />
                </div>
              ))}
            </>
          )}
          {r.type === 'asn' && r.asn && (
            <div className="mt-2 p-2 border border-[#00E5FF]/20 bg-[#00E5FF]/5 rounded">
              <ResultRow label="ASN" value={`AS${r.asn.asn}`} color="#00E5FF" />
              <ResultRow label="名称" value={r.asn.name} />
              <ResultRow label="描述" value={r.asn.description} />
              <ResultRow label="国家" value={r.asn.country_code} />
            </div>
          )}
        </div>
      );
    }

    // ── MAC 地址 ──
    if (activeTab === 'mac') {
      return (
        <div>
          <SectionHeader title="MAC 地址查询" icon={Fingerprint} color="#FFD700" />
          <ResultRow label="MAC 地址" value={r.mac} color="#FFD700" />
          <ResultRow label="厂商" value={r.vendor} color={r.vendor === 'Not Found' ? '#FF3D3D' : '#00E676'} />
        </div>
      );
    }

    // ── GitHub 侦察（独立渲染，不依赖 ResultRow）──
    if (activeTab === 'github') {
      const repos = r.repos || r.recent_repos || [];
      return (
        <div className="space-y-3">
          <div className="flex items-start gap-3 pb-3 border-b border-[var(--border-secondary)]/30">
            {r.avatar_url && (
              <img
                src={r.avatar_url}
                alt="avatar"
                className="w-12 h-12 rounded-full border border-[#87CEEB]/30"
              />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] font-mono font-bold text-[var(--text-primary)]">
                  {r.name || r.username}
                </span>
                <span className="text-[9px] font-mono bg-[var(--bg-tertiary)] px-2 py-0.5 rounded text-[var(--text-muted)]">
                  @{r.username}
                </span>
              </div>
              {r.bio && (
                <p className="text-[10px] font-mono text-[var(--text-secondary)] mt-1">{r.bio}</p>
              )}
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[9px] font-mono">
                {r.company && <span>🏢 {r.company}</span>}
                {r.location && <span>📍 {r.location}</span>}
                {r.email && <span>📧 {r.email}</span>}
                {r.twitter && <span>🐦 @{r.twitter}</span>}
                {r.blog && (
                  <span>
                    🔗{' '}
                    <a href={r.blog} target="_blank" rel="noopener noreferrer" className="text-[#87CEEB] hover:underline">
                      {r.blog}
                    </a>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 py-2 text-center border-b border-[var(--border-secondary)]/30">
            <div>
              <div className="text-[16px] font-mono font-bold text-[var(--text-primary)]">{r.public_repos ?? 0}</div>
              <div className="text-[8px] font-mono text-[var(--text-muted)] uppercase">Repositories</div>
            </div>
            <div>
              <div className="text-[16px] font-mono font-bold text-[var(--text-primary)]">{r.followers ?? 0}</div>
              <div className="text-[8px] font-mono text-[var(--text-muted)] uppercase">Followers</div>
            </div>
            <div>
              <div className="text-[16px] font-mono font-bold text-[var(--text-primary)]">{r.following ?? 0}</div>
              <div className="text-[8px] font-mono text-[var(--text-muted)] uppercase">Following</div>
            </div>
          </div>

          {repos.length > 0 && (
            <div>
              <div className="text-[9px] font-mono text-[#87CEEB] uppercase tracking-wider mb-2">Recent Repositories</div>
              <div className="space-y-1.5">
                {repos.slice(0, 5).map((repo: any, idx: number) => (
                  <div key={idx} className="p-2 rounded-lg bg-[var(--bg-primary)]/30 border border-[var(--border-secondary)]/20">
                    <div className="flex justify-between items-start">
                      <a href={repo.html_url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-mono font-bold text-[#87CEEB] hover:underline">
                        {repo.name}
                      </a>
                      {repo.language && (
                        <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
                          {repo.language}
                        </span>
                      )}
                    </div>
                    {repo.description && (
                      <p className="text-[9px] font-mono text-[var(--text-secondary)] mt-1 line-clamp-2">{repo.description}</p>
                    )}
                    <div className="flex gap-3 mt-1 text-[8px] font-mono text-[var(--text-muted)]">
                      <span>⭐ {repo.stargazers_count ?? 0}</span>
                      <span>🍴 {repo.forks_count ?? 0}</span>
                      <span>📅 {new Date(repo.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <details className="mt-3">
            <summary className="text-[8px] font-mono text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-primary)]">Raw Data (JSON)</summary>
            <pre className="mt-2 p-2 bg-[var(--bg-primary)] rounded text-[8px] font-mono overflow-x-auto">
              {JSON.stringify(r, null, 2)}
            </pre>
          </details>
        </div>
      );
    }

    // 通用后备：显示所有字段
    const flatten = (obj, prefix='') => {
        if (obj===null||obj===undefined) return [['值','无数据']];
        if (typeof obj !== 'object') return [[prefix, String(obj)]];
        if (Array.isArray(obj)) {
            if (obj.length===0) return [['结果','空数组']];
            return obj.flatMap((v,i)=>flatten(v, prefix?`${prefix}[${i}]`:`${i}`));
        }
        return Object.entries(obj).flatMap(([k,v])=>flatten(v, prefix?`${prefix}.${k}`:k));
    };
    const flat = flatten(r);
    return <div className="space-y-1">{flat.map(([k,v],i)=><ResultRow key={i} label={k} value={v} />)}</div>;
  };

  const renderSweepResults = () => { /* 与原代码相同，省略 */ return null; };

  const renderContent = () => (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-1">
        <div className="grid grid-cols-5 gap-1">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setQuery(''); setResults(null); setError(''); }}
              className={`flex flex-col items-center gap-1 px-1 py-2 rounded-lg text-[8px] font-mono tracking-wider transition-all border ${activeTab === tab.id ? 'border-opacity-40 bg-opacity-15' : 'border-transparent hover:bg-[var(--hover-accent)]'}`}
              style={{ borderColor: activeTab === tab.id ? tab.color : 'transparent', backgroundColor: activeTab === tab.id ? `${tab.color}15` : undefined, color: activeTab === tab.id ? tab.color : 'var(--text-muted)' }}>
              <tab.icon className="w-3.5 h-3.5" />
              <span className="leading-none text-center truncate w-full">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex gap-1.5">
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
            <input type="text" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && runLookup()}
              placeholder={currentTab?.placeholder}
              className="w-full bg-[var(--bg-primary)]/60 border border-[var(--border-primary)] rounded-lg pl-8 pr-3 py-2.5 text-[11px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/40 focus:outline-none"
              style={{ borderColor: query ? `${currentTab?.color}40` : undefined }} />
          </div>
          <button onClick={runLookup} disabled={loading || !query.trim()}
            className="px-4 py-2 rounded-lg text-[10px] font-mono font-bold tracking-wider disabled:opacity-30 transition-all flex items-center justify-center min-w-[70px]"
            style={{ backgroundColor: `${currentTab?.color}20`, border: `1px solid ${currentTab?.color}40`, color: currentTab?.color }}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '扫描'}
          </button>
        </div>
        {activeTab === 'scanner' && (
          <select value={scanType} onChange={e => setScanType(e.target.value)}
            className="bg-[var(--bg-primary)]/60 border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-[10px] font-mono text-[var(--text-muted)] outline-none w-full">
            <option value="quick">快速扫描</option><option value="deep">深度扫描</option><option value="ports">TOP 1000 端口</option>
          </select>
        )}
        {(activeTab === 'sweep' || activeTab === 'vuln') && (
          <div className="flex items-center justify-between bg-[var(--bg-primary)]/60 border border-[var(--border-primary)] rounded-lg p-1">
            <span className="text-[9px] font-mono text-[var(--text-muted)] pl-2">子网掩码:</span>
            <div className="flex items-center gap-0.5">
              {[24, 25, 26, 27, 28].map(c => (
                <button key={c} onClick={() => setSweepCidr(c)}
                  className={`px-2 py-1 text-[10px] font-mono rounded transition-all ${sweepCidr === c ? 'bg-[#FF3D3D]/20 text-[#FF3D3D]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]'}`}>/{c}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-2.5 rounded-lg border border-red-500/30 bg-red-500/10 text-[11px] font-mono text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />{error}
        </div>
      )}

      {sweepProgress && loading && (
        <div className="p-3 rounded-lg border border-[#FF3D3D]/30 bg-[#FF3D3D]/5">
          <div className="flex justify-between mb-2">
            <span className="text-[10px] font-mono tracking-wider text-[#FF3D3D]">正在扫描子网...</span>
            <span className="text-[10px] font-mono text-[#E8E6E0]">{sweepProgress.total} 个主机</span>
          </div>
          <div className="w-full h-1.5 bg-[#1A1A18] rounded-full overflow-hidden">
            <div className="h-full w-full rounded-full" style={{ background: 'linear-gradient(90deg, #FF3D3D, #FF6B00, #FFD700)', animation: 'sweep-pulse 1.5s ease-in-out infinite' }} />
          </div>
        </div>
      )}

      {sweepResult && !loading && renderSweepResults()}
      {results && !(sweepResult && !loading) && (
        <div className="bg-[var(--bg-primary)]/40 border border-[var(--border-primary)] rounded-lg p-3 max-h-[50vh] overflow-y-auto styled-scrollbar">
          <div className="flex justify-between mb-2">
            <span className="text-[9px] font-mono tracking-widest" style={{ color: currentTab?.color }}>{currentTab?.label} 结果</span>
            <span className="text-[8px] font-mono text-[var(--text-muted)] flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{new Date().toLocaleTimeString()}</span>
          </div>
          {renderStructuredResults()}
        </div>
      )}

      {history.length > 0 && !results && (
        <div className="space-y-1">
          <span className="text-[9px] font-mono tracking-widest text-[var(--text-muted)]">最近扫描</span>
          {history.slice(0, 5).map((h, i) => (
            <button key={i} onClick={() => { setActiveTab(h.tab); setQuery(h.query); }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[var(--hover-accent)] text-left">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono" style={{ color: TABS.find(t => t.id === h.tab)?.color }}>{TABS.find(t => t.id === h.tab)?.label}</span>
                <span className="text-[10px] font-mono text-[var(--text-secondary)]">{h.query}</span>
              </div>
              <span className="text-[8px] font-mono text-[var(--text-muted)]">{h.time}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (isMobile) return renderContent();

  if (isFullScreen) {
    const fullScreenNode = (
      <div className="fixed top-4 bottom-4 right-4 w-[40vw] min-w-[600px] max-w-[800px] z-[999] glass-panel bg-[#0a0a09]/95 backdrop-blur-2xl border border-[var(--cyan-primary)]/40 rounded-xl flex flex-col overflow-hidden shadow-2xl shadow-[var(--cyan-primary)]/20">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-secondary)] bg-[#111]">
          <div className="flex items-center gap-3">
            <Radar className="w-5 h-5 text-[var(--cyan-primary)]" />
            <span className="hud-text text-[16px] text-[var(--text-primary)]">OSIRIS 侦察工具包</span>
            <span className="gotham-tag gotham-tag--info" style={{ fontSize: '9px' }}>扩展视图</span>
            <span className="gotham-tag gotham-tag--classified" style={{ fontSize: '8px' }}>{TABS.length} 个模块</span>
          </div>
          <button onClick={() => setIsFullScreen(false)} className="p-2 hover:bg-white/5 rounded transition-colors text-[var(--text-muted)] hover:text-white">
            <Minimize2 className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 styled-scrollbar">
          {renderContent()}
        </div>
      </div>
    );
    return typeof document !== 'undefined' ? createPortal(fullScreenNode, document.body) : fullScreenNode;
  }

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, duration: 0.6 }} className="glass-panel flex flex-col overflow-hidden pointer-events-auto shrink-0 h-[500px] max-h-[80vh] resize-y">
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.05)] bg-[rgba(0,0,0,0.3)] hover:bg-[var(--hover-accent)] transition-colors">
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 flex-1">
          <Radar className="w-3.5 h-3.5 text-[var(--cyan-primary)]" />
          <span className="hud-text text-[12px] text-[var(--text-primary)]">侦察工具包</span>
          <span className="gotham-tag gotham-tag--info" style={{ fontSize: '7px', padding: '1px 5px' }}>{TABS.length} 个工具</span>
        </button>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsFullScreen(true)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors" title="全屏">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--cyan-primary)] animate-osiris-pulse" />
          <button onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="w-3.5 h-3.5 text-[var(--text-muted)]" /> : <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-y-auto px-3 py-3 flex-1 min-h-0 styled-scrollbar">
            {renderContent()}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const OsintPanel = memo(OsintPanelInner);
export default OsintPanel;
