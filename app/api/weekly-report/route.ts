import { NextRequest, NextResponse } from 'next/server';
import { formatReport, getWeekKey, readWeekRecords, sendToWecom } from '@/lib/report';

function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

// POST /api/weekly-report — Vercel Cron 每周五自动触发，或前端手动触发
export async function POST(req: NextRequest) {
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
  const records = await readWeekRecords(weekKey);

  if (records.length === 0) {
    return NextResponse.json({ error: '本周暂无工作记录' }, { status: 400 });
  }

  const today = new Date().toISOString().split('T')[0];
  const report = formatReport(records, today);

  await sendToWecom(report);

  return NextResponse.json({ ok: true, report, count: records.length });
}

// GET /api/weekly-report — 预览当前周报（不发送）
export async function GET(req: NextRequest) {
  const week = req.nextUrl.searchParams.get('week') ?? getWeekKey();
  const records = await readWeekRecords(week);
  const today = new Date().toISOString().split('T')[0];
  const report = formatReport(records, today);
  return NextResponse.json({ week, report, count: records.length });
}
