import { NextResponse } from 'next/server';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs';

const DB_PATH = '/home/osiris-master/scanner-backend-custom/analysis.db';
const CONFIG_FILE = '/home/osiris-master/scanner-backend-custom/llm_config.json';
let db: any = null;

async function getDB() {
  if (!db) {
    db = await open({ filename: DB_PATH, driver: sqlite3.Database });
    await db.exec(`
      CREATE TABLE IF NOT EXISTS analysis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        content TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_timestamp ON analysis(timestamp);
    `);
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    await db.run('DELETE FROM analysis WHERE timestamp < ?', sevenDaysAgo);
  }
  return db;
}

async function getLatest() {
  const db = await getDB();
  return db.get('SELECT content, timestamp FROM analysis ORDER BY timestamp DESC LIMIT 1');
}

async function save(content: string) {
  const db = await getDB();
  await db.run('INSERT INTO analysis (timestamp, content) VALUES (?, ?)', Date.now(), content);
}

function getLLMConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return { apiUrl: '', apiKey: '', model: '' };
  }
}

async function fetchWithTimeout(url: string, timeout = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(`http://localhost:3117${url}`, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) return await res.json();
  } catch { return null; }
  return null;
}

async function aggregateData() {
  const [markets, news, earthquakes, fires, flights, malware, space, cyber] = await Promise.all([
    fetchWithTimeout('/api/markets', 5000),
    fetchWithTimeout('/api/news', 5000),
    fetchWithTimeout('/api/earthquakes', 5000),
    fetchWithTimeout('/api/fires', 5000),
    fetchWithTimeout('/api/flights', 5000),
    fetchWithTimeout('/api/malware', 5000),
    fetchWithTimeout('/api/space-weather', 5000),
    fetchWithTimeout('/api/cyber-threats', 5000),
  ]);

  let marketSummary = '无数据';
  if (markets) {
    const stocks = markets.stocks ? Object.entries(markets.stocks).map(([k,v]) => `${k}: ${v.price} (${v.change_percent}%)`).join(', ') : '';
    const indices = markets.indices ? Object.entries(markets.indices).map(([k,v]) => `${k}: ${v.price} (${v.change_percent}%)`).join(', ') : '';
    marketSummary = `股票: ${stocks}; 指数: ${indices}; 能源: ${JSON.stringify(markets.oil)}; 大宗商品: ${JSON.stringify(markets.commodities)}; 加密货币: ${JSON.stringify(markets.crypto)}`;
  }
  const newsSummary = news?.news ? news.news.slice(0,10).map(n=>`${n.source}: ${n.title}`).join('\n') : '无';
  const quakeSummary = earthquakes ? earthquakes.slice(0,5).map(eq=>`M${eq.magnitude} ${eq.place}`).join('\n') : '无';
  const fireSummary = fires?.hotspots ? fires.hotspots.map(h=>`${h.region}: ${h.detections} fires`).join('; ') : '无';
  const flightSummary = flights?.states ? `${flights.states.length} active flights` : '无';
  const malwareSummary = malware?.threats ? `${malware.threats.length} malware threats` : '无';
  const spaceSummary = space ? `Kp ${space.kp_index} ${space.storm_level}` : '无';
  const cyberSummary = cyber ? `${cyber.total} cyber threats` : '无';
  return { marketSummary, newsSummary, quakeSummary, fireSummary, flightSummary, malwareSummary, spaceSummary, cyberSummary };
}

async function generateAnalysis() {
  const cfg = getLLMConfig();
  if (!cfg.apiUrl || !cfg.apiKey) return '❌ 请先在 AI 分析面板中配置 API URL 和 Key。';

  const data = await aggregateData();
  const systemPrompt = `你是一个专业的全球情报与市场分析师。基于以下实时数据，提供10条有用的信息，包括但不限于：股票投资建议、全球风险预警、地缘政治信息、自然灾害影响、网络安全趋势、太空天气影响等。每条信息简洁明了，用中文输出，编号1-10。`;
  const userPrompt = `市场与金融：${data.marketSummary}\n新闻摘要：${data.newsSummary}\n地震活动：${data.quakeSummary}\n火灾热点：${data.fireSummary}\n航班动态：${data.flightSummary}\n恶意软件威胁：${data.malwareSummary}\n空间天气：${data.spaceSummary}\n网络威胁：${data.cyberSummary}`;
  
  try {
    const requestBody = {
      model: cfg.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    };
    console.log('[AI] 请求 LLM:', cfg.apiUrl);
    const response = await fetch(cfg.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.apiKey}`
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AI] LLM 错误 (${response.status}):`, errorText);
      return `分析失败: API 返回 ${response.status} - ${errorText.slice(0, 200)}`;
    }
    const result = await response.json();
    // 适配 OpenAI / DeepSeek 格式
    const content = result.choices?.[0]?.message?.content || result.content || '无返回内容';
    if (!content || content.length < 10) return '分析失败: LLM 返回内容为空';
    return content;
  } catch (err: any) {
    console.error('[AI] 请求异常:', err);
    return `分析失败: ${err.message}`;
  }
}

let timer: NodeJS.Timeout | null = null;
let running = false;
async function auto() {
  if (running) return;
  running = true;
  console.log('[AI] 自动分析中...');
  try {
    const analysis = await generateAnalysis();
    await save(analysis);
    console.log('[AI] 分析完成并已缓存');
  } catch (err) {
    console.error('[AI] 自动分析失败:', err);
  } finally {
    running = false;
  }
}
function startAuto() {
  if (timer) return;
  setTimeout(auto, 5000);
  timer = setInterval(auto, 15 * 60 * 1000);
}
startAuto();

export async function GET() {
  const latest = await getLatest();
  if (latest) return NextResponse.json({ content: latest.content, timestamp: latest.timestamp, cached: true });
  return NextResponse.json({ content: '暂无分析数据，请点击“立即分析”生成。', cached: false });
}

export async function POST() {
  const analysis = await generateAnalysis();
  await save(analysis);
  return NextResponse.json({ content: analysis, timestamp: Date.now(), cached: false });
}
