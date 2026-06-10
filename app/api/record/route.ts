import { del, list, put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { getWeekKey, WorkRecord } from '@/lib/report';

const BLOB_PREFIX = 'weekly-records';

function blobPathname(weekKey: string) {
  return `${BLOB_PREFIX}/${weekKey}.json`;
}

async function readRecords(weekKey: string): Promise<WorkRecord[]> {
  try {
    const { blobs } = await list({ prefix: blobPathname(weekKey) });
    if (blobs.length === 0) return [];
    const res = await fetch(blobs[0].downloadUrl, { cache: 'no-store' });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function writeRecords(weekKey: string, records: WorkRecord[]): Promise<void> {
  await put(blobPathname(weekKey), JSON.stringify(records), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
  });
}

// GET /api/record?week=YYYY-MM-DD  (默认本周)
export async function GET(req: NextRequest) {
  const week = req.nextUrl.searchParams.get('week') ?? getWeekKey();
  const records = await readRecords(week);
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
  const records = await readRecords(weekKey);

  const record: WorkRecord = {
    id: crypto.randomUUID(),
    date: new Date().toISOString().split('T')[0],
    projectType: projectType ?? '其他',
    project: project.trim(),
    content: content.trim(),
    issue: issue?.trim() || '无',
    createdAt: new Date().toISOString(),
  };

  records.push(record);
  await writeRecords(weekKey, records);

  return NextResponse.json({ record }, { status: 201 });
}

// DELETE /api/record?id=xxx&week=YYYY-MM-DD
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  const week = req.nextUrl.searchParams.get('week') ?? getWeekKey();

  if (!id) return NextResponse.json({ error: 'id 必填' }, { status: 400 });

  const records = await readRecords(week);
  const filtered = records.filter((r) => r.id !== id);

  if (filtered.length === 0) {
    const { blobs } = await list({ prefix: blobPathname(week) });
    if (blobs.length > 0) await del(blobs[0].url);
  } else {
    await writeRecords(week, filtered);
  }

  return NextResponse.json({ ok: true });
}
