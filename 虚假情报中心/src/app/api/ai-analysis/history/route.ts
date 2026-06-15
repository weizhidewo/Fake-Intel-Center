import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const HISTORY_FILE = path.join(process.cwd(), 'data', 'ai_history.json');

// 确保文件存在
if (!fs.existsSync(path.dirname(HISTORY_FILE))) {
  fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
}
if (!fs.existsSync(HISTORY_FILE)) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify([]), 'utf-8');
}

export async function GET() {
  try {
    const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
    const history = JSON.parse(raw);
    return NextResponse.json({ history });
  } catch {
    return NextResponse.json({ history: [] });
  }
}

export async function POST(request: Request) {
  try {
    const { content } = await request.json();
    const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
    const history = JSON.parse(raw);
    history.unshift({ id: Date.now(), timestamp: Date.now(), content });
    // 保留最近 200 条，避免文件过大
    const trimmed = history.slice(0, 200);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(trimmed, null, 2), 'utf-8');
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '保存历史失败' }, { status: 500 });
  }
}
