import { NextResponse } from 'next/server';
import { HttpsProxyAgent } from 'https-proxy-agent';

const PROXY_URL = 'http://127.0.0.1:1081';
const proxyAgent = new HttpsProxyAgent(PROXY_URL);

// 静态备用数据（当实时获取失败时使用）
const STATIC_DATA = {
  stocks: {
    RTX: { price: 456.78, change_percent: 1.23, up: true },
    LMT: { price: 345.67, change_percent: -0.45, up: false },
    NOC: { price: 234.56, change_percent: 0.78, up: true },
    GD: { price: 123.45, change_percent: 1.01, up: true },
    BA: { price: 567.89, change_percent: -2.34, up: false },
    PLTR: { price: 67.89, change_percent: 3.21, up: true }
  },
  oil: {
    'WTI Crude': { price: 82.15, change_percent: 1.5, up: true },
    'Brent Crude': { price: 86.30, change_percent: 1.2, up: true }
  },
  commodities: {
    Gold: { price: 2350.20, change_percent: 0.3, up: true },
    Silver: { price: 28.50, change_percent: -0.1, up: false },
    Copper: { price: 4.52, change_percent: 0.5, up: true },
    'Natural Gas': { price: 2.81, change_percent: -2.77, up: false },
    Wheat: { price: 6.05, change_percent: 0.2, up: true },
    Corn: { price: 4.45, change_percent: -0.1, up: false }
  },
  crypto: {
    Bitcoin: { price: 68500, change_percent: 2.1, up: true },
    Ethereum: { price: 3450, change_percent: 1.8, up: true }
  },
  indices: {
    'S&P 500': { price: 5432.10, change_percent: 0.8, up: true },
    'Nasdaq 100': { price: 17234.56, change_percent: 1.2, up: true }
  },
  scm_alerts: []
};

// 增强的请求头（模拟真实浏览器）
const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Origin': 'https://finance.yahoo.com',
  'Referer': 'https://finance.yahoo.com/',
  'Sec-Fetch-Site': 'same-site',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Dest': 'empty',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
};

// 带重试的请求函数（仅使用 V8 端点）
async function fetchYahoo(symbol: string, retries = 2): Promise<any | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(url, {
        signal: controller.signal,
        agent: proxyAgent,
        headers: YAHOO_HEADERS,
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const result = data.chart?.result?.[0];
      if (!result) return null;
      const meta = result.meta;
      const closes = result.indicators?.quote?.[0]?.close || [];
      const currentPrice = meta.regularMarketPrice || closes[closes.length - 1];
      const prevClose = meta.chartPreviousClose || closes[0];
      if (!currentPrice || !prevClose) return null;
      const changePercent = ((currentPrice - prevClose) / prevClose) * 100;
      console.log(`[Markets] Success: ${symbol}`);
      return {
        price: Math.round(currentPrice * 100) / 100,
        change_percent: Math.round(changePercent * 100) / 100,
        up: changePercent >= 0,
      };
    } catch (err: any) {
      console.error(`[Markets] Attempt ${i+1} failed for ${symbol}:`, err.message);
      if (i === retries - 1) return null;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  return null;
}

async function fetchCoinGecko(): Promise<Record<string, any>> {
  try {
    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      signal: controller.signal,
      agent: proxyAgent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const result: Record<string, any> = {};
    if (data.bitcoin) {
      result['Bitcoin'] = {
        price: Math.round(data.bitcoin.usd * 100) / 100,
        change_percent: Math.round((data.bitcoin.usd_24h_change || 0) * 100) / 100,
        up: (data.bitcoin.usd_24h_change || 0) >= 0,
      };
    }
    if (data.ethereum) {
      result['Ethereum'] = {
        price: Math.round(data.ethereum.usd * 100) / 100,
        change_percent: Math.round((data.ethereum.usd_24h_change || 0) * 100) / 100,
        up: (data.ethereum.usd_24h_change || 0) >= 0,
      };
    }
    return result;
  } catch (err) {
    console.error('[Markets] CoinGecko failed:', err);
    return {};
  }
}

const DEFENSE_STOCKS = ['RTX', 'LMT', 'NOC', 'GD', 'BA', 'PLTR'];
const OIL_TICKERS = ['CL=F', 'BZ=F'];
const COMMODITY_TICKERS = ['GC=F', 'SI=F', 'HG=F', 'NG=F', 'ZW=F', 'ZC=F'];
const CRYPTO_TICKERS = ['BTC-USD', 'ETH-USD'];
const INDEX_TICKERS = ['ES=F', 'NQ=F'];

const COMMODITY_NAMES: Record<string, string> = {
  'GC=F': 'Gold', 'SI=F': 'Silver', 'HG=F': 'Copper',
  'NG=F': 'Natural Gas', 'ZW=F': 'Wheat', 'ZC=F': 'Corn',
};
const OIL_NAMES: Record<string, string> = { 'CL=F': 'WTI Crude', 'BZ=F': 'Brent Crude' };
const CRYPTO_NAMES: Record<string, string> = { 'BTC-USD': 'Bitcoin', 'ETH-USD': 'Ethereum' };
const INDEX_NAMES: Record<string, string> = { 'ES=F': 'S&P 500', 'NQ=F': 'Nasdaq 100' };

export async function GET() {
  let stocks: Record<string, any> = {};
  let oil: Record<string, any> = {};
  let commodities: Record<string, any> = {};
  let crypto: Record<string, any> = {};
  let indices: Record<string, any> = {};
  let scm_alerts: string[] = [];

  try {
    // 并行获取所有数据（仅 V8 端点）
    const [stockResults, oilResults, commodityResults, cryptoResults, indexResults, geckoData] = await Promise.all([
      Promise.all(DEFENSE_STOCKS.map(async t => ({ symbol: t, data: await fetchYahoo(t) }))),
      Promise.all(OIL_TICKERS.map(async t => ({ symbol: t, data: await fetchYahoo(t) }))),
      Promise.all(COMMODITY_TICKERS.map(async t => ({ symbol: t, data: await fetchYahoo(t) }))),
      Promise.all(CRYPTO_TICKERS.map(async t => ({ symbol: t, data: await fetchYahoo(t) }))),
      Promise.all(INDEX_TICKERS.map(async t => ({ symbol: t, data: await fetchYahoo(t) }))),
      fetchCoinGecko(),
    ]);

    for (const { symbol, data } of stockResults) if (data) stocks[symbol] = data;
    for (const { symbol, data } of oilResults) if (data) oil[OIL_NAMES[symbol] || symbol] = data;
    for (const { symbol, data } of commodityResults) if (data) commodities[COMMODITY_NAMES[symbol] || symbol] = data;
    for (const { symbol, data } of cryptoResults) if (data) crypto[CRYPTO_NAMES[symbol] || symbol] = data;
    for (const { symbol, data } of indexResults) if (data) indices[INDEX_NAMES[symbol] || symbol] = data;
    for (const [name, data] of Object.entries(geckoData)) if (!crypto[name]) crypto[name] = data;

    // 如果没有获取到任何实时数据，使用静态备用
    if (Object.keys(stocks).length === 0 && Object.keys(oil).length === 0 &&
        Object.keys(commodities).length === 0 && Object.keys(crypto).length === 0 &&
        Object.keys(indices).length === 0) {
      console.log('[Markets] No live data, using static fallback');
      stocks = STATIC_DATA.stocks;
      oil = STATIC_DATA.oil;
      commodities = STATIC_DATA.commodities;
      crypto = STATIC_DATA.crypto;
      indices = STATIC_DATA.indices;
    }
  } catch (err) {
    console.error('[Markets] Error in fetch, using static fallback:', err);
    stocks = STATIC_DATA.stocks;
    oil = STATIC_DATA.oil;
    commodities = STATIC_DATA.commodities;
    crypto = STATIC_DATA.crypto;
    indices = STATIC_DATA.indices;
  }

  return NextResponse.json({
    stocks, oil, commodities, crypto, indices, scm_alerts,
    timestamp: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
