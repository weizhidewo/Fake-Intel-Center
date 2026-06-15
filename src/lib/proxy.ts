import { HttpsProxyAgent } from 'https-proxy-agent';

// 从环境变量读取代理地址，支持 .env 中的配置
const PROXY_URL = process.env.HTTP_PROXY || process.env.GLOBAL_AGENT_HTTP_PROXY || 'http://127.0.0.1:1081';
export const agent = new HttpsProxyAgent(PROXY_URL);

// 可选：包装 fetch，自动添加 agent
export async function proxiedFetch(url: string, init?: RequestInit): Promise<Response> {
    return fetch(url, { ...init, agent } as any);
}
