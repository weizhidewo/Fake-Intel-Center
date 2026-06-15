import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { agent } from '@/lib/proxy';

export const maxDuration = 1800; // 30 分钟

const execAsync = promisify(exec);
const CONFIG_FILE = path.join(process.cwd(), 'data', 'ai_config.json');
const HISTORY_FILE = path.join(process.cwd(), 'data', 'ai_history.json');
const SCHEDULE_FILE = path.join(process.cwd(), 'data', 'ai_schedule.json');
const DB_PATH = '/home/osiris-master/scanner-backend-custom/analysis.db';

let db: any = null;
async function getDB() {
  if (!db) db = await open({ filename: DB_PATH, driver: sqlite3.Database });
  return db;
}

function getEffectiveConfig(cfg: any, specificKey: 'reasoning' | 'preprocess') {
  const general = cfg.general;
  const specific = cfg[specificKey];
  if (general && general.apiUrl && general.apiKey && general.model) {
    const model = general.model || specific?.model || '';
    return { apiUrl: general.apiUrl, apiKey: general.apiKey, model };
  }
  if (specific && specific.apiUrl && specific.apiKey && specific.model) return specific;
  return null;
}

async function callLLMWithRetry(config: any, systemPrompt: string, userPrompt: string, timeoutMs = 1800000, retries = 2) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(config.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 3500,
        }),
        signal: controller.signal,
        agent,
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[AI] LLM 错误 (${config.model}):`, response.status, errorText.slice(0,200));
        if (attempt === retries) return null;
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }
      const result = await response.json();
      return result.choices?.[0]?.message?.content || result.content;
    } catch (err) { console.error(`[AI] 请求失败 attempt ${attempt}:`, err.message); if (attempt===retries) return null; await new Promise(r=>setTimeout(r,5000)); }
  }
  return null;
}

async function curlJson(url: string, timeoutSec = 1800): Promise<any> {
  try {
    const proxy = process.env.HTTP_PROXY || 'http://127.0.0.1:1081';
    const proxyFlag = `-x ${proxy}`;
    const { stdout, stderr } = await execAsync(`curl -s ${proxyFlag} --max-time ${timeoutSec} "${url}"`);
    if (stderr) console.warn(`[curl] stderr from ${url}:`, stderr);
    if (!stdout) return null;
    if (stdout.trim().startsWith('<!DOCTYPE') || stdout.trim().startsWith('<html')) return null;
    return JSON.parse(stdout);
  } catch { return null; }
}

function safeArray(data: any, fallback: any[] = []): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    if (Array.isArray(data.news)) return data.news;
    if (Array.isArray(data.earthquakes)) return data.earthquakes;
    if (Array.isArray(data.hotspots)) return data.hotspots;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.results)) return data.results;
    if (Array.isArray(data.features)) return data.features;
    if (Array.isArray(data.events)) return data.events;
    if (Array.isArray(data.threats)) return data.threats;
  }
  return fallback;
}

async function fetchInfosecFromDB(limit: number): Promise<any[]> {
  try {
    const dbConn = await getDB();
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 86400;
    const rows = await dbConn.all(
      `SELECT summary, raw_content, category, risk_score, source, published, link
       FROM infosec_processed WHERE created_at >= ? ORDER BY created_at DESC LIMIT ?`,
      sevenDaysAgo, limit
    );
    return rows.map((row: any) => ({
      title: row.summary || '未知',
      desc: row.raw_content ? row.raw_content.slice(0,80) : '',
      category: row.category,
      risk_score: row.risk_score,
      source: row.source,
      published: row.published,
      link: row.link,
    }));
  } catch (err) { return []; }
}

async function fetchGlobalData(sources: any, infosecLimit: number) {
  const baseUrl = 'http://localhost:3117';
  const results: Record<string, any> = {};
  const endpoints = [];
  if (sources.news) endpoints.push({ name: 'news', url: '/api/news' });
  if (sources.earthquakes) endpoints.push({ name: 'earthquakes', url: '/api/earthquakes' });
  if (sources.fires) endpoints.push({ name: 'fires', url: '/api/fires' });
  if (sources.flights) endpoints.push({ name: 'flights', url: '/api/flights' });
  if (sources.maritime) endpoints.push({ name: 'maritime', url: '/api/maritime' });
  if (sources.markets) endpoints.push({ name: 'markets', url: '/api/markets' });
  if (sources.malware) endpoints.push({ name: 'malware', url: '/api/malware' });
  if (sources.gdelt) endpoints.push({ name: 'gdelt', url: '/api/gdelt' });
  for (const ep of endpoints) {
    const data = await curlJson(`${baseUrl}${ep.url}`, 1800);
    results[ep.name] = data;
  }
  if (sources.infosec) results.infosec = await fetchInfosecFromDB(infosecLimit);
  return results;
}

function buildRawContext(data: any): string {
  const news = safeArray(data.news, []).map((n: any)=>`${n.title||''} (${n.source||'?'})`).join('\n');
  const earthquakes = safeArray(data.earthquakes, []).map((e: any)=>`M${e.magnitude} ${e.place||''}`).join('\n');
  const fires = safeArray(data.fires?.hotspots||data.fires, []).length;
  const flights = data.flights || {};
  const maritimeShips = data.maritime?.ships?.length || 0;
  const malware = safeArray(data.malware?.threats||data.malware, []).map((m: any)=>`${m.malware||'?'} - ${m.ip||''} (${m.status||''})`).join('\n');
  const gdelt = safeArray(data.gdelt?.events||data.gdelt, []).map((g: any)=>`${g.name||''} (${(g.date||'').slice(0,10)})`).join('\n');
  const infosec = (data.infosec||[]).map((item:any)=>`${item.title}${item.desc?': '+item.desc:''} (${item.source}, 风险${item.risk_score})`).join('\n');
  let stocksSummary = '无', indicesSummary = '无';
  if (data.markets?.stocks) stocksSummary = Object.entries(data.markets.stocks).slice(0,5).map(([k,v]:[string,any])=>`${k}: ${v.price} (${v.change_percent}%)`).join('; ');
  if (data.markets?.indices) indicesSummary = Object.entries(data.markets.indices).slice(0,5).map(([k,v]:[string,any])=>`${k}: ${v.price} (${v.change_percent}%)`).join('; ');
  return `【新闻情报】${news||'无'}\n【股票市场】${stocksSummary}\n【市场指数】${indicesSummary}\n【地震活动】${earthquakes||'无'}\n【火灾热点】${fires} 处\n【航班动态】商用 ${flights.commercial_flights?.length||0}，私人 ${flights.private_flights?.length||0}，军用 ${flights.military_flights?.length||0}\n【海事交通】船舶 ${maritimeShips} 艘\n【恶意软件威胁】${malware||'无'}\n【冲突事件】${gdelt||'无'}\n【安全情报】${infosec||'无'}`;
}

// 修改 chunkSize 默认值从 3000 改为 64000，并在调用时也使用 64000
async function batchProcessContext(context: string, preprocessConfig: any, reasoningConfig: any, chunkSize = 64000): Promise<string> {
  if (context.length <= chunkSize) {
    if (preprocessConfig) {
      const summary = await callLLMWithRetry(preprocessConfig, '数据清洗专家', `清洗压缩数据：\n${context}`, 1800000);
      return summary || context;
    } else if (reasoningConfig) {
      const summary = await callLLMWithRetry(reasoningConfig, '数据清洗专家', `清洗压缩数据：\n${context}`, 1800000);
      return summary || context;
    } else return context;
  }
  const chunks: string[] = [];
  let start = 0;
  while (start < context.length) {
    let end = start + chunkSize;
    if (end < context.length) {
      const lastNewline = context.lastIndexOf('\n', end);
      if (lastNewline > start) end = lastNewline + 1;
    }
    chunks.push(context.slice(start, end));
    start = end;
  }
  console.log(`[AI] 原始上下文长度: ${context.length}, 分为 ${chunks.length} 块`);
  const summarizer = preprocessConfig || reasoningConfig;
  if (!summarizer) return chunks.join('\n\n');
  const chunkSummaries = await Promise.all(chunks.map(async (chunk, idx) => {
    const summary = await callLLMWithRetry(summarizer, '数据清洗专家', `清洗压缩数据块：\n${chunk}`, 1800000);
    return summary || `[第${idx+1}块摘要失败]`;
  }));
  const merged = chunkSummaries.join('\n\n');
  if (merged.length > chunkSize) return await batchProcessContext(merged, preprocessConfig, reasoningConfig, chunkSize);
  return merged;
}

function parseCards(text: string) {
  try {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed) && parsed.every(c => c.conclusion && c.evidence && c.confidence && c.relevance)) return parsed;
    }
  } catch (e) {}
  const cards: any[] = [];
  const lines = text.split('\n');
  let current: any = null;
  for (const line of lines) {
    if (line.match(/^\s*[-•*]\s+(.+)/) || line.match(/^\d+\.\s+(.+)/)) {
      if (current) cards.push(current);
      current = { conclusion: line.replace(/^\s*[-•*\d+\.\s*]/, '').slice(0,80), evidence: '根据数据', confidence: 'MEDIUM', relevance: '综合' };
    } else if (current && line.trim()) current.evidence = line.trim().slice(0,100);
  }
  if (current) cards.push(current);
  if (cards.length===0) cards.push({ conclusion: text.slice(0,80), evidence: '分析结果', confidence: 'LOW', relevance: '综合' });
  return cards;
}

export async function POST(request: Request) {
  try {
    const { prompt, sources: reqSources, infosecLimit: reqInfosecLimit } = await request.json();
    let fullConfig;
    try { fullConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')); } catch { return NextResponse.json({ error: '未找到 AI 配置文件' }, { status: 500 }); }
    const reasoningConfig = getEffectiveConfig(fullConfig, 'reasoning');
    const preprocessConfig = getEffectiveConfig(fullConfig, 'preprocess');
    if (!reasoningConfig) return NextResponse.json({ error: '未配置推理模型' }, { status: 400 });
    let scheduleCfg = { infosecLimit: 50, sources: {} };
    try { scheduleCfg = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf-8')); } catch {}
    const sources = reqSources || scheduleCfg.sources || { news: true, earthquakes: true, fires: true, flights: true, maritime: true, markets: true, malware: true, gdelt: true, infosec: true };
    const infosecLimit = reqInfosecLimit ?? scheduleCfg.infosecLimit ?? 50;
    const globalData = await fetchGlobalData(sources, infosecLimit);
    const rawContext = buildRawContext(globalData);
    const userPrompt = prompt || '分析当前全球安全局势、金融市场和网络威胁。';
    // 使用 64000 分块大小（已修改默认值）
    const finalInput = await batchProcessContext(rawContext, preprocessConfig, reasoningConfig, 64000);
    console.log(`[AI] 最终输入长度: ${finalInput.length}`);
    // 用户要求的新提示词（强制 JSON 数组、具体卡片数量、风险预测表格）
    const reasoningSystem = `你是一个 OSIRIS 情报分析师。基于提供的数据，输出一个 JSON 数组，包含以下卡片：

【必须包含】：
- 新闻情报：至少 2 条（标题 + 简要影响）
- 股票/金融市场：至少 2 条（具体股票或指数，涨跌原因）
- 网络威胁：至少 2 条（恶意软件名称、目标行业、攻击手法）
- 地震/灾害：1 条（如有数据）
- 海事/供应链：1 条（如有数据）
- 最后一张卡片必须是风险趋势预测表格（格式如下）
- 总卡片数 8-10 条

卡片格式：
{
  "conclusion": "结论（20字内）",
  "evidence": "依据（50字内，必须来自数据）",
  "confidence": "HIGH/MEDIUM/LOW",
  "relevance": "领域（新闻/金融/网络/灾害/供应链/军事/预测）"
}

风险趋势预测卡片的 evidence 字段必须是一个 ASCII 表格，例如：
| 领域 | 短期（1个月） | 中期（3-6个月） |
|------|--------------|----------------|
| 地缘政治 | ... | ... |
| 金融 | ... | ... |
| 网络 | ... | ... |
| 灾害 | ... | ... |

只输出 JSON 数组，不要有任何其他文字。`;
    const reasoningUser = `用户问题：${userPrompt}\n数据：\n${finalInput}`;
    const rawResult = await callLLMWithRetry(reasoningConfig, reasoningSystem, reasoningUser, 1800000);
    if (!rawResult) return NextResponse.json({ error: '推理模型调用失败' }, { status: 500 });
    const cards = parseCards(rawResult);
    const resultText = cards.map(c => `${c.conclusion}: ${c.evidence}`).join('\n');
    let history: any[] = [];
    if (fs.existsSync(HISTORY_FILE)) try { history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8')); } catch {}
    history.unshift({ id: Date.now(), timestamp: Date.now(), content: resultText, cards, preprocessed: finalInput.slice(0,500), context: rawContext.slice(0,500) });
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(0,200), null, 2));
    return NextResponse.json({ result: resultText, cards });
  } catch (error: any) {
    console.error('[AI 分析] 失败:', error);
    return NextResponse.json({ error: error.message || '分析失败' }, { status: 500 });
  }
}
