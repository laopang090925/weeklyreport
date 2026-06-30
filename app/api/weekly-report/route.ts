import { NextRequest, NextResponse } from 'next/server';
import { formatReport, getWeekKey, getBeijingDateStr } from '@/lib/report';
import { readWeekRecords, sendToWecom } from '@/lib/server';

export const dynamic = 'force-dynamic';

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

  const today = getBeijingDateStr();
  const report = formatReport(records, today);

  await sendToWecom(report);

  return NextResponse.json({ ok: true, report, count: records.length });
}

// GET /api/weekly-report
// - Vercel Cron 触发时带 Authorization 头，自动发送周报
// - 普通请求（前端预览）不带 Authorization，只返回内容不发送
export async function GET(req: NextRequest) {
  if (isCronAuthorized(req)) {
    const weekKey = getWeekKey();
    const records = await readWeekRecords(weekKey);
    if (records.length === 0) {
      return NextResponse.json({ error: '本周暂无工作记录' }, { status: 400 });
    }
    const today = getBeijingDateStr();
    const report = formatReport(records, today);
    await sendToWecom(report);
    return NextResponse.json({ ok: true, report, count: records.length });
  }

  const week = req.nextUrl.searchParams.get('week') ?? getWeekKey();
  const records = await readWeekRecords(week);
  const today = getBeijingDateStr();
  const report = formatReport(records, today);
  return NextResponse.json({ week, report, count: records.length });
}
