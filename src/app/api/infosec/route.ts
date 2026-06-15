import { NextResponse } from 'next/server';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

const DB_PATH = '/home/osiris-master/scanner-backend-custom/analysis.db';
let db: any = null;

async function getDB() {
  if (!db) {
    db = await open({ filename: DB_PATH, driver: sqlite3.Database });
  }
  return db;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');
  const db = await getDB();
  // 增加 raw_content 和 link 字段
  const rows = await db.all(
    `SELECT id, title, summary, raw_content, category, risk_score, source, published, lat, lng, created_at, link
     FROM infosec_processed
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    limit, offset
  );
  return NextResponse.json({ items: rows, total: rows.length });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get('clear') !== 'true') {
    return NextResponse.json({ error: 'Missing clear=true parameter' }, { status: 400 });
  }
  const db = await getDB();
  await db.run('DELETE FROM infosec_processed');
  return NextResponse.json({ success: true });
}
