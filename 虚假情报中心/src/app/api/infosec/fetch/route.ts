import { NextResponse } from 'next/server';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs';
import path from 'path';
import { agent } from '@/lib/proxy';

const DB_PATH = '/home/osiris-master/scanner-backend-custom/analysis.db';
const AI_CONFIG_FILE = path.join(process.cwd(), 'data', 'ai_config.json');
const INFOSEC_CONFIG_FILE = path.join(process.cwd(), 'data', 'infosec_config.json');
let db: any = null;

async function getDB() {
  if (!db) {
    db = await open({ filename: DB_PATH, driver: sqlite3.Database });
    await db.exec(`
      CREATE TABLE IF NOT EXISTS infosec_processed (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        raw_content TEXT,
        summary TEXT,
        category TEXT,
        risk_score INTEGER,
        entities TEXT,
        source TEXT,
        published TEXT,
        link TEXT,
        lat REAL,
        lng REAL,
        created_at INTEGER DEFAULT (strftime('%s','now'))
      );
      CREATE INDEX IF NOT EXISTS idx_unique_source_title ON infosec_processed(source, title);
    `);
  }
  return db;
}

function getLLMConfig() {
  try {
    const raw = fs.readFileSync(AI_CONFIG_FILE, 'utf-8');
    const cfg = JSON.parse(raw);
    if (cfg.infosec?.apiUrl && cfg.infosec?.apiKey && cfg.infosec?.model) return cfg.infosec;
    if (cfg.general?.apiUrl && cfg.general?.apiKey && cfg.general?.model) return cfg.general;
    return null;
  } catch {
    return null;
  }
}

async function callLLMWithRetry(config: any, systemPrompt: string, userPrompt: string, maxRetries = 2) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1800000);
      const res = await fetch(config.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3,
          max_tokens: 1000,
        }),
        signal: controller.signal,
        agent,
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        console.log(`[Infosec] LLM attempt ${attempt}/${maxRetries} failed: HTTP ${res.status}`);
        if (attempt === maxRetries) return null;
        await new Promise(r => setTimeout(r, 1000 * attempt));
        continue;
      }
      const json = await res.json();
      const content = json.choices?.[0]?.message?.content || json.content;
      if (content) return content;
    } catch (err) {
      console.log(`[Infosec] LLM attempt ${attempt}/${maxRetries} error:`, err);
      if (attempt === maxRetries) return null;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
  return null;
}

function getDataSourceConfig() {
  try {
    const raw = fs.readFileSync(INFOSEC_CONFIG_FILE, 'utf-8');
    const cfg = JSON.parse(raw);
    return cfg.dataSources || {
      secCrawler: false,
      alienVault: true,
      nvd: true,
      bleepingComputer: false
    };
  } catch {
    return {
      secCrawler: false,
      alienVault: true,
      nvd: true,
      bleepingComputer: false
    };
  }
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
};

async function fetchSecCrawler(): Promise<any[]> {
  const baseUrl = process.env.SECCRAWLER_API_URL || 'http://127.0.0.1:9999/api/crawler/getArticles/';
  const authKey = process.env.SECCRAWLER_AUTH_KEY || '';
  const sites = ['QiAnXin', 'SeebugPaper', 'Tttang', 'Lab.Nsfocus', 'Lab.TSRCBlog', 'Lab.X1cT34m'];
  const articles: any[] = [];
  const seen = new Set<string>();
  for (const site of sites) {
    try {
      const url = `${baseUrl}${site}`;
      const res = await fetch(url, {
        headers: authKey ? { Authorization: authKey } : {},
        signal: AbortSignal.timeout(10000),
        agent,
      });
      if (!res.ok) continue;
      const json = await res.json();
      if (json.code === 200 && Array.isArray(json.data)) {
        for (const item of json.data) {
          if (!Array.isArray(item) || item.length < 2) continue;
          const link = item[0];
          const title = item[1];
          if (!link || seen.has(link)) continue;
          seen.add(link);
          articles.push({
            title: title,
            content: '',
            source: `SecCrawler-${site}`,
            published: new Date().toISOString(),
            link: link,
            risk_score: 0,
            category: '安全资讯'
          });
        }
      }
    } catch (err) {
      console.error(`[Infosec] SecCrawler ${site} error:`, err);
    }
  }
  return articles;
}

async function fetchAlienVaultOTX(): Promise<any[]> {
  const apiKey = process.env.OTX_API_KEY || "b2c4c7f9b52e921e2403971e6e3bd3d504fe119723e89c95a12fa0197ae89092";
  const url = "https://otx.alienvault.com/api/v1/pulses/subscribed?limit=20";
  try {
    const res = await fetch(url, {
      headers: { ...HEADERS, 'X-OTX-API-KEY': apiKey },
      signal: AbortSignal.timeout(15000),
      agent,
    });
    if (!res.ok) return [];
    const data = await res.json();
    const pulses = data.results || [];
    return pulses.map((pulse: any) => ({
      title: pulse.name,
      content: pulse.description || '',
      source: 'AlienVault OTX',
      published: pulse.modified || pulse.created,
      link: `https://otx.alienvault.com/pulse/${pulse.id}`,
      risk_score: pulse.tlp === 'red' ? 90 : (pulse.tlp === 'amber' ? 70 : 50),
      category: '威胁情报'
    }));
  } catch (err) {
    console.error('[OTX] error:', err);
    return [];
  }
}

async function fetchNVD(): Promise<any[]> {
  const daysBack = 7;
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - daysBack);
  const startIso = start.toISOString().split('.')[0] + 'Z';
  const endIso = end.toISOString().split('.')[0] + 'Z';
  const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?pubStartDate=${encodeURIComponent(startIso)}&pubEndDate=${encodeURIComponent(endIso)}&resultsPerPage=20`;
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000), agent });
    if (!res.ok) return [];
    const data = await res.json();
    const vulnerabilities = data.vulnerabilities || [];
    return vulnerabilities.map((v: any) => {
      const cve = v.cve;
      const metrics = cve.metrics?.cvssMetricV31?.[0]?.cvssData;
      const baseScore = metrics?.baseScore || 0;
      const desc = cve.descriptions.find((d: any) => d.lang === 'en')?.value || '';
      return {
        title: cve.id,
        content: desc,
        source: 'NVD',
        published: cve.published,
        link: `https://nvd.nist.gov/vuln/detail/${cve.id}`,
        risk_score: baseScore * 10,
        category: '漏洞'
      };
    });
  } catch (err) {
    console.error('[NVD] error:', err);
    return [];
  }
}

async function fetchBleepingComputer(): Promise<any[]> {
  const url = 'https://www.bleepingcomputer.com/feed/';
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000), agent });
    if (!res.ok) return [];
    const text = await res.text();
    const titleMatches = [...text.matchAll(/<title>(.*?)<\/title>/gi)];
    const linkMatches = [...text.matchAll(/<link>(.*?)<\/link>/gi)];
    const articles = [];
    for (let i = 1; i < Math.min(titleMatches.length, linkMatches.length, 10); i++) {
      let title = titleMatches[i][1];
      title = title.replace(/<!\[CDATA\[|\]\]>/g, '');
      let link = linkMatches[i][1];
      link = link.replace(/<!\[CDATA\[|\]\]>/g, '');
      articles.push({
        title: title,
        content: '',
        source: 'BleepingComputer',
        published: new Date().toISOString(),
        link: link,
        risk_score: 0,
        category: '安全资讯'
      });
    }
    return articles;
  } catch (err) {
    console.error('[BleepingComputer] error:', err);
    return [];
  }
}

async function preprocessItem(raw: any, llmConfig: any) {
  const fallback = {
    title: raw.title,
    raw_content: raw.content || raw.title,
    summary: raw.title,
    category: raw.category || '其他',
    risk_score: raw.risk_score || 0,
    entities: '',
    source: raw.source,
    published: raw.published,
    link: raw.link,
    lat: null,
    lng: null,
  };

  if (!llmConfig) return fallback;

  if (raw.source === 'NVD') {
    return {
      title: raw.title,
      raw_content: raw.content || raw.title,
      summary: raw.content ? raw.content.substring(0, 150) : raw.title,
      category: raw.category || '漏洞',
      risk_score: raw.risk_score,
      entities: '',
      source: raw.source,
      published: raw.published,
      link: raw.link,
      lat: null,
      lng: null,
    };
  }

  const prompt = `你是一个安全情报分析专家。根据以下原始情报，提取结构化信息，输出 JSON 格式，不要有其他文字。其中 "title_zh" 必须是简洁的中文标题（15字以内），"summary_zh" 是中文简介（50字以内），概括情报核心内容。
{
  "title_zh": "中文标题（15字内）",
  "summary_zh": "中文简介（50字内）",
  "category": "威胁类型（如：黑客组织/漏洞/恶意软件/攻击事件/安全工具/其他）",
  "risk_score": ${raw.risk_score},
  "entities": "提取的关键实体（如APT组织名、CVE编号、IP地址等，逗号分隔）",
  "lat": 纬度（浮点数，如果无法确定则为 null），
  "lng": 经度（浮点数，无法确定则为 null）
}
原始情报：
标题：${raw.title}
正文：${raw.content || raw.title}
来源：${raw.source}
时间：${raw.published}`;

  const result = await callLLMWithRetry(llmConfig, '你是一个情报结构化提取助手，输出JSON。', prompt);
  if (!result) return fallback;

  try {
    let cleaned = result.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(cleaned);
    // 关键：使用 title_zh 和 summary_zh
    return {
      title: raw.title,
      raw_content: parsed.summary_zh || raw.title,   // 中文简介存入 raw_content
      summary: parsed.title_zh || raw.title,         // 中文标题存入 summary
      category: parsed.category || raw.category || '其他',
      risk_score: parsed.risk_score ?? raw.risk_score ?? 0,
      entities: parsed.entities || '',
      source: raw.source,
      published: raw.published,
      link: raw.link,
      lat: parsed.lat ?? null,
      lng: parsed.lng ?? null,
    };
  } catch (err) {
    console.log(`[Infosec] JSON parse error for ${raw.title}:`, err);
    return fallback;
  }
}

export async function POST() {
  const dataSourceConfig = getDataSourceConfig();
  const llmConfig = getLLMConfig();
  const dbConn = await getDB();

  console.log('[Infosec] Data sources:', dataSourceConfig);
  if (llmConfig) console.log('[Infosec] AI enabled');

  const fetchTasks: Promise<any[]>[] = [];
  if (dataSourceConfig.secCrawler) fetchTasks.push(fetchSecCrawler());
  if (dataSourceConfig.alienVault) fetchTasks.push(fetchAlienVaultOTX());
  if (dataSourceConfig.nvd) fetchTasks.push(fetchNVD());
  if (dataSourceConfig.bleepingComputer) fetchTasks.push(fetchBleepingComputer());

  const results = await Promise.all(fetchTasks);
  let allRaw = results.flat();
  console.log(`[Infosec] Fetched ${allRaw.length} raw items`);

  const limit = 50;
  if (allRaw.length > limit) {
    allRaw = allRaw.slice(0, limit);
    console.log(`[Infosec] Limited to ${limit} items`);
  }

  if (allRaw.length === 0) {
    return NextResponse.json({ success: true, inserted: 0, total_raw: 0 });
  }

  const existing = new Set();
  const rows = await dbConn.all('SELECT source, title FROM infosec_processed');
  for (const row of rows) existing.add(`${row.source}|${row.title}`);

  let inserted = 0;
  let processedCount = 0;
  const processLimit = Math.min(allRaw.length, limit);

  for (let i = 0; i < processLimit; i++) {
    const item = allRaw[i];
    const key = `${item.source}|${item.title}`;
    if (existing.has(key)) {
      processedCount++;
      continue;
    }
    const proc = await preprocessItem(item, llmConfig);
    if (proc) {
      await dbConn.run(
        `INSERT INTO infosec_processed (title, raw_content, summary, category, risk_score, entities, source, published, link, lat, lng, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s','now'))`,
        proc.title, proc.raw_content, proc.summary, proc.category, proc.risk_score,
        proc.entities, proc.source, proc.published, proc.link, proc.lat, proc.lng
      );
      inserted++;
    }
    processedCount++;
  }

  console.log(`[Infosec] Done. Inserted ${inserted} new records.`);
  return NextResponse.json({ success: true, inserted, total_raw: allRaw.length });
}
