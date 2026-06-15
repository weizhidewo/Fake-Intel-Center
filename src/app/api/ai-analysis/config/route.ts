import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'data', 'ai_config.json');

const DEFAULT_CONFIG = {
  general: { apiUrl: '', apiKey: '', model: '' },
  reasoning: { apiUrl: '', apiKey: '', model: '' },
  preprocess: { apiUrl: '', apiKey: '', model: '' },
  infosec: { apiUrl: '', apiKey: '', model: '' }
};

// 确保目录存在
if (!fs.existsSync(path.dirname(CONFIG_FILE))) {
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
}
if (!fs.existsSync(CONFIG_FILE)) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
}

export async function GET() {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(raw);
    // 兼容旧格式（如果没有 infosec 则补充）
    if (!config.infosec) {
      config.infosec = DEFAULT_CONFIG.infosec;
    }
    return NextResponse.json(config);
  } catch (err) {
    console.error('[Config] 读取失败:', err);
    return NextResponse.json(DEFAULT_CONFIG);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const newConfig = {
      general: body.general || DEFAULT_CONFIG.general,
      reasoning: body.reasoning || DEFAULT_CONFIG.reasoning,
      preprocess: body.preprocess || DEFAULT_CONFIG.preprocess,
      infosec: body.infosec || DEFAULT_CONFIG.infosec
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2));
    console.log('[Config] 配置已保存');
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Config] 保存失败:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
