import { NextRequest, NextResponse } from 'next/server';
import { getWeekKey, getBeijingDateStr, WorkRecord } from '@/lib/report';
import { readWeekRecords, writeWeekRecords } from '@/lib/server';

export const dynamic = 'force-dynamic';

// GET /api/record?week=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const week = req.nextUrl.searchParams.get('week') ?? getWeekKey();
  const records = await readWeekRecords(week);
  return NextResponse.json({ week, records });
}

// POST /api/record  body: { projectType, project, content, issue }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { projectType, project, content, issue } = body;

  if (!project?.trim() || !content?.trim()) {
    return NextResponse.json({ error: '所属项目和工作内容不能为空' }, { status: 400 });
  }

  const weekKey = getWeekKey();
  const records = await readWeekRecords(weekKey);

  const record: WorkRecord = {
    id: crypto.randomUUID(),
    date: getBeijingDateStr(),
    projectType: projectType ?? '其他',
    project: project.trim(),
    content: content.trim(),
    issue: issue?.trim() || '无',
    createdAt: new Date().toISOString(),
  };

  records.push(record);
  await writeWeekRecords(weekKey, records);

  return NextResponse.json({ record }, { status: 201 });
}

// DELETE /api/record?id=xxx&week=YYYY-MM-DD
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  const week = req.nextUrl.searchParams.get('week') ?? getWeekKey();

  if (!id) return NextResponse.json({ error: 'id 必填' }, { status: 400 });

  const records = await readWeekRecords(week);
  const filtered = records.filter((r) => r.id !== id);

  await writeWeekRecords(week, filtered);

  return NextResponse.json({ ok: true });
}
