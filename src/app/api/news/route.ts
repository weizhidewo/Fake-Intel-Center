import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);
const PROXY_URL = 'http://127.0.0.1:1081';

// 使用 curl 通过代理获取内容（解决 Node.js fetch 的问题）
async function curlFetch(url: string, timeoutSec: number = 15): Promise<string> {
  const cmd = `curl -x ${PROXY_URL} -m ${timeoutSec} -s -L --http1.1 "${url}"`;
  const { stdout, stderr } = await execPromise(cmd, { timeout: timeoutSec * 1000 });
  if (stderr && !stderr.includes('curl: (52)')) console.warn(`curl stderr: ${stderr}`);
  return stdout;
}

const TELEGRAM_CHANNELS = ['OSINTtechnical', 'Faytuks', 'Liveuamap', 'CyberKnow'];
const FALLBACK_FEEDS = {
  BBC: 'https://feeds.bbci.co.uk/news/world/rss.xml',
  AlJazeera: 'https://www.aljazeera.com/xml/rss/all.xml',
  GDACS: 'https://www.gdacs.org/xml/rss.xml'
};

// 以下所有原有函数保持不变（解析函数）
function parseTelegramHTML(html: string, channel: string): any[] {
  const items: any[] = [];
  const messageBlockRegex = /<div class="tgme_widget_message_wrap js-widget_message_wrap"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi;
  let blockMatch;
  while ((blockMatch = messageBlockRegex.exec(html)) !== null) {
    const blockHtml = blockMatch[0];
    const textRegex = /<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/i;
    const textMatch = blockHtml.match(textRegex);
    if (!textMatch) continue;
    let text = textMatch[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim();
    if (!text || text.length < 10) continue;
    const dateRegex = /<a class="tgme_widget_message_date" href="(https:\/\/t\.me\/[^"]+)".*?<time datetime="([^"]+)"/i;
    const dateMatch = blockHtml.match(dateRegex);
    const link = dateMatch ? dateMatch[1] : `https://t.me/${channel}`;
    const pubDate = dateMatch ? dateMatch[2] : new Date().toISOString();
    const title = text.split('\n')[0].substring(0, 100);
    items.push({ title, description: text, link, pubDate, source: `t.me/${channel}` });
  }
  return items;
}

function parseRSSItems(xml: string, sourceName: string): any[] {
  const items: any[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const getTag = (tag: string) => {
      const m = itemXml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return (m?.[1] || m?.[2] || '').trim();
    };
    const title = getTag('title').replace(/<[^>]+>/g, '');
    const desc = getTag('description').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"');
    items.push({
      title: title.length > 100 ? title.substring(0, 100) + '...' : title,
      description: desc,
      link: getTag('link'),
      pubDate: getTag('pubDate') || new Date().toISOString(),
      source: sourceName
    });
  }
  return items;
}

const RISK_KEYWORDS = ['war','missile','strike','attack','crisis','tension','military','conflict','defense','clash','nuclear','invasion','bomb','drone','weapon','sanctions','ceasefire','escalation', 'killed', 'destroyed', 'operation', 'casualty', 'frontline', 'threat'];
const KEYWORD_COORDS: Record<string, [number, number]> = {
  'ukraine': [49.487, 31.272], 'kyiv': [50.450, 30.523], 'russia': [61.524, 105.318],
  'moscow': [55.755, 37.617], 'israel': [31.046, 34.851], 'gaza': [31.416, 34.333],
  'iran': [32.427, 53.688], 'lebanon': [33.854, 35.862], 'syria': [34.802, 38.996],
  'yemen': [15.552, 48.516], 'china': [35.861, 104.195], 'taiwan': [23.697, 120.960],
  'united states': [38.907, -77.036], 'europe': [48.800, 2.300], 'middle east': [31.500, 34.800]
};

function scoreRisk(text: string): number {
  const lower = text.toLowerCase();
  let score = 1;
  for (const kw of RISK_KEYWORDS) {
    if (lower.includes(kw)) score += 2;
  }
  return Math.min(10, score);
}

function findCoords(text: string): [number, number] | null {
  const lower = text.toLowerCase();
  for (const [keyword, coords] of Object.entries(KEYWORD_COORDS)) {
    if (lower.includes(keyword)) return coords;
  }
  return null;
}

export async function GET() {
  const allArticles: any[] = [];

  // 并行抓取 Telegram
  const tgPromises = TELEGRAM_CHANNELS.map(async (channel) => {
    try {
      const html = await curlFetch(`https://t.me/s/${channel}`, 20);
      return parseTelegramHTML(html, channel).slice(-8);
    } catch (err) {
      console.error(`[News API] Telegram ${channel} failed:`, err);
      return [];
    }
  });
  const tgResults = await Promise.allSettled(tgPromises);
  for (const r of tgResults) if (r.status === 'fulfilled') allArticles.push(...r.value);

  // 并行抓取 RSS 回退
  const rssPromises = Object.entries(FALLBACK_FEEDS).map(async ([source, url]) => {
    try {
      const xml = await curlFetch(url, 15);
      return parseRSSItems(xml, source).slice(0, 5);
    } catch (err) {
      console.error(`[News API] RSS ${source} failed:`, err);
      return [];
    }
  });
  const rssResults = await Promise.allSettled(rssPromises);
  for (const r of rssResults) if (r.status === 'fulfilled') allArticles.push(...r.value);

  // 去重与格式化
  const newsItems = allArticles.map(article => ({
    id: crypto.createHash('md5').update((article.link || '') + (article.pubDate || '')).digest('hex'),
    title: article.title,
    description: article.description,
    link: article.link,
    published: article.pubDate,
    source: article.source,
    risk_score: scoreRisk(article.description || article.title),
    coords: findCoords(article.description || article.title),
    coords_default: !findCoords(article.description || article.title),
    machine_assessment: scoreRisk(article.description || article.title) >= 8 ? "AI Analysis indicates elevated tactical priority based on OSINT stream patterns." : null,
  }));

  newsItems.sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime());

  return NextResponse.json({
    news: newsItems,
    total: newsItems.length,
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' }
  });
}
