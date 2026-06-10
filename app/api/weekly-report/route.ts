import { NextRequest, NextResponse } from 'next/server';
import { formatReport, getWeekKey, sendToWecom, WorkRecord } from '@/lib/report';

async function readRecords(weekKey: string): Promise<WorkRecord[]> {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/record?week=${weekKey}`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.records ?? [];
  } catch {
    return [];
  }
}

function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

// POST /api/weekly-report
// - Vercel Cron 每周五自动触发（携带 Authorization: Bearer <CRON_SECRET>）
// - 前端手动触发同样走此接口（需在 body 带 { secret }）
export async function POST(req: NextRequest) {
  // 验证来源：Vercel Cron header 或手动传 secret
  let authorized = isCronAuthorized(req);
  if (!authorized) {
    try {
      const body = await req.json();
      authorized = body.secret === process.env.CRON_SECRET;
    } catch {}
  }
  if (!authorized) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const weekKey = getWeekKey();
  const records = await readRecords(weekKey);

  if (records.length === 0) {
    return NextResponse.json({ error: '本周暂无工作记录' }, { status: 400 });
  }

  const today = new Date().toISOString().split('T')[0];
  const report = formatReport(records, today);

  await sendToWecom(report);

  return NextResponse.json({ ok: true, report, count: records.length });
}

// GET /api/weekly-report  预览当前周报（不发送）
export async function GET(req: NextRequest) {
  const week = req.nextUrl.searchParams.get('week') ?? getWeekKey();
  const records = await readRecords(week);
  const today = new Date().toISOString().split('T')[0];
  const report = formatReport(records, today);
  return NextResponse.json({ week, report, count: records.length });
}
