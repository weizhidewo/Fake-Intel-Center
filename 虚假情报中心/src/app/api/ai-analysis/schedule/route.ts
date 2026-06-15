import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const SCHEDULE_FILE = path.join(process.cwd(), 'data', 'ai_schedule.json');
const DEFAULT_SOURCES = {
  news: true,
  earthquakes: true,
  fires: true,
  flights: true,
  maritime: true,
  markets: true,
  malware: true,
  gdelt: true,
  infosec: true
};

if (!fs.existsSync(path.dirname(SCHEDULE_FILE))) {
  fs.mkdirSync(path.dirname(SCHEDULE_FILE), { recursive: true });
}
if (!fs.existsSync(SCHEDULE_FILE)) {
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify({
    intervalHours: 9,
    infosecLimit: 50,
    sources: DEFAULT_SOURCES
  }, null, 2));
}

export async function GET() {
  try {
    const raw = fs.readFileSync(SCHEDULE_FILE, 'utf-8');
    const data = JSON.parse(raw);
    return NextResponse.json({
      intervalHours: data.intervalHours || 9,
      infosecLimit: data.infosecLimit || 50,
      sources: data.sources || DEFAULT_SOURCES
    });
  } catch {
    return NextResponse.json({
      intervalHours: 9,
      infosecLimit: 50,
      sources: DEFAULT_SOURCES
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const existingRaw = fs.existsSync(SCHEDULE_FILE) ? fs.readFileSync(SCHEDULE_FILE, 'utf-8') : '{}';
    const existing = JSON.parse(existingRaw);
    const newConfig = {
      intervalHours: body.intervalHours !== undefined ? body.intervalHours : (existing.intervalHours ?? 9),
      infosecLimit: body.infosecLimit !== undefined ? body.infosecLimit : (existing.infosecLimit ?? 50),
      sources: body.sources !== undefined ? body.sources : (existing.sources ?? DEFAULT_SOURCES)
    };
    if (typeof newConfig.intervalHours !== 'number' || newConfig.intervalHours < 1 || newConfig.intervalHours > 168) {
      return NextResponse.json({ error: '间隔时间必须是 1-168 之间的整数（小时）' }, { status: 400 });
    }
    if (typeof newConfig.infosecLimit !== 'number' || newConfig.infosecLimit < 1 || newConfig.infosecLimit > 500) {
      return NextResponse.json({ error: '情报条数必须是 1-500 之间的整数' }, { status: 400 });
    }
    fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(newConfig, null, 2));
    if (globalThis.__aiSchedulerReload) globalThis.__aiSchedulerReload(newConfig.intervalHours, newConfig.infosecLimit, newConfig.sources);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
