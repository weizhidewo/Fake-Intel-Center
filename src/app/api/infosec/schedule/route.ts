import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'data', 'infosec_config.json');

interface Config {
  enabled: boolean;
  intervalHours: number;
  dataSources: {
    secCrawler: boolean;
    alienVault: boolean;
    threatBook: boolean;
    nvd: boolean;
    bleepingComputer: boolean;
  };
}

const DEFAULT_CONFIG: Config = {
  enabled: true,
  intervalHours: 6,
  dataSources: {
    secCrawler: true,
    alienVault: true,
    threatBook: false,
    nvd: true,
    bleepingComputer: true
  }
};

function loadConfig(): Config {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      enabled: parsed.enabled ?? DEFAULT_CONFIG.enabled,
      intervalHours: parsed.intervalHours ?? DEFAULT_CONFIG.intervalHours,
      dataSources: { ...DEFAULT_CONFIG.dataSources, ...(parsed.dataSources || {}) }
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveConfig(cfg: Config) {
  const dir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

export async function GET() {
  const cfg = loadConfig();
  return NextResponse.json(cfg);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { enabled, intervalHours, dataSources } = body;
  if (typeof enabled !== 'boolean' || typeof intervalHours !== 'number' || intervalHours < 1 || intervalHours > 168) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }
  const newCfg: Config = {
    enabled,
    intervalHours,
    dataSources: { ...DEFAULT_CONFIG.dataSources, ...(dataSources || {}) }
  };
  saveConfig(newCfg);

  if (globalThis.__infosecSchedulerReload) {
    globalThis.__infosecSchedulerReload(newCfg);
  }

  return NextResponse.json({ success: true });
}
