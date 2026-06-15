import fs from 'fs';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'data', 'infosec_config.json');

interface Config {
  enabled: boolean;
  intervalHours: number;
}

let currentTimer: NodeJS.Timeout | null = null;

function loadConfig(): Config {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { enabled: true, intervalHours: 6 };
  }
}

async function triggerFetch() {
  const apiUrl = `http://localhost:${process.env.PORT || 3000}/api/infosec/fetch`;
  try {
    const res = await fetch(apiUrl, { method: 'POST' });
    const data = await res.json();
    console.log('[Infosec Scheduler] Fetch completed:', data);
  } catch (err) {
    console.error('[Infosec Scheduler] Fetch failed:', err);
  }
}

function schedule(cfg: Config) {
  if (currentTimer) clearInterval(currentTimer);
  if (!cfg.enabled) return;
  const intervalMs = cfg.intervalHours * 60 * 60 * 1000;
  currentTimer = setInterval(triggerFetch, intervalMs);
  // 立即执行一次
  triggerFetch();
}

export function startScheduler() {
  const cfg = loadConfig();
  schedule(cfg);
  globalThis.__infosecSchedulerReload = (newCfg: Config) => {
    schedule(newCfg);
  };
}
