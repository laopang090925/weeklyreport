import { NextRequest, NextResponse } from 'next/server';
import { readProjectMap, writeProjectMap, buildProjectMapFromHistory } from '@/lib/server';
import { normalizeProjectName, normalizeProjectType } from '@/lib/report';

export const dynamic = 'force-dynamic';

// GET /api/project-map — 返回「所属项目 -> 项目类型」映射；首次访问时从历史记录聚合并持久化
export async function GET() {
  let map: Record<string, string>;
  try {
    map = await readProjectMap();
  } catch {
    // 读取失败时直接报错，不触发从历史记录重建（否则可能用不完整数据覆盖已有映射）
    return NextResponse.json({ error: '读取项目映射失败，请稍后重试' }, { status: 500 });
  }
  if (Object.keys(map).length === 0) {
    map = await buildProjectMapFromHistory();
    if (Object.keys(map).length > 0) await writeProjectMap(map);
  }
  return NextResponse.json({ map });
}

// POST /api/project-map  body: { project, projectType } — 手动新增/修正一条映射
export async function POST(req: NextRequest) {
  const body = await req.json();
  const project = body.project?.trim();
  const projectType = body.projectType?.trim();

  if (!project || !projectType) {
    return NextResponse.json({ error: 'project 和 projectType 必填' }, { status: 400 });
  }

  const map = await readProjectMap();
  map[normalizeProjectName(project)] = normalizeProjectType(projectType);
  await writeProjectMap(map);

  return NextResponse.json({ map });
}
