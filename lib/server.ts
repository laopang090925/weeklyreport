import { list, put, del } from '@vercel/blob';
import { WorkRecord, getBeijingDateStr, normalizeProjectType, normalizeProjectName } from './report';

const BLOB_PREFIX = 'weekly-records';
const PROJECT_MAP_PREFIX = 'project-map';
// 2026-07-03 当天提交的数据存在录入错误，构建项目类型映射时需要剔除
const EXCLUDED_HISTORY_DATE = '2026-07-03';

// 每次写入用带时间戳的新文件名，确保 CDN 无缓存命中（旧 URL 永不复用）
function blobPrefix(weekKey: string): string {
  return `${BLOB_PREFIX}/${weekKey}`;
}

function latestBlob(blobs: { pathname: string; downloadUrl: string }[]) {
  const ts = (b: { pathname: string }) => {
    const m = b.pathname.match(/-(\d{13})\.json$/);
    return m ? parseInt(m[1]) : 0;
  };
  return blobs.reduce((a, b) => (ts(a) >= ts(b) ? a : b));
}

export async function readWeekRecords(weekKey: string): Promise<WorkRecord[]> {
  try {
    const { blobs } = await list({ prefix: blobPrefix(weekKey) });
    if (blobs.length === 0) return [];
    // 取时间戳最大的版本（旧格式无时间戳，视为 0，排在所有新版本之后）
    const blob = latestBlob(blobs);
    const res = await fetch(blob.downloadUrl, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function writeWeekRecords(weekKey: string, records: WorkRecord[]): Promise<void> {
  // 先快照旧版本列表，再写入新版本，最后删除旧版本
  const { blobs: oldBlobs } = await list({ prefix: blobPrefix(weekKey) });
  const newPathname = `${blobPrefix(weekKey)}-${Date.now()}.json`;
  await put(newPathname, JSON.stringify(records), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
  });
  if (oldBlobs.length > 0) await del(oldBlobs.map(b => b.url));
}

async function listAllBlobs(prefix: string): Promise<{ pathname: string; downloadUrl: string }[]> {
  const all: { pathname: string; downloadUrl: string }[] = [];
  let cursor: string | undefined;
  do {
    const res = await list({ prefix, cursor });
    all.push(...res.blobs);
    cursor = res.hasMore ? res.cursor : undefined;
  } while (cursor);
  return all;
}

export async function readAllRecords(): Promise<WorkRecord[]> {
  const blobs = await listAllBlobs(`${BLOB_PREFIX}/`);
  const byWeek = new Map<string, typeof blobs>();
  for (const b of blobs) {
    const m = b.pathname.match(/^weekly-records\/(\d{4}-\d{2}-\d{2})(?:-\d{13})?\.json$/);
    if (!m) continue;
    const arr = byWeek.get(m[1]) ?? [];
    arr.push(b);
    byWeek.set(m[1], arr);
  }
  const all: WorkRecord[] = [];
  for (const arr of byWeek.values()) {
    try {
      const res = await fetch(latestBlob(arr).downloadUrl, { cache: 'no-store' });
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data)) all.push(...data);
    } catch {
      // 跳过读取失败的周
    }
  }
  return all;
}

// 注意：读取失败会抛出异常而不是返回 {}，避免调用方把"读取失败"误判为"映射本来就是空的"
// 进而用只有单条数据的 map 覆盖写入、抹掉历史映射
export async function readProjectMap(): Promise<Record<string, string>> {
  const { blobs } = await list({ prefix: PROJECT_MAP_PREFIX });
  if (blobs.length === 0) return {};
  const res = await fetch(latestBlob(blobs).downloadUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error(`读取项目映射失败: ${res.status}`);
  const data = await res.json();
  return data && typeof data === 'object' ? data : {};
}

export async function writeProjectMap(map: Record<string, string>): Promise<void> {
  // 写入前按归一化后的项目名去重，避免因空白/全半角差异产生的重复 key
  const deduped: Record<string, string> = {};
  for (const [project, type] of Object.entries(map)) {
    const key = normalizeProjectName(project);
    if (key) deduped[key] = type;
  }

  const { blobs: oldBlobs } = await list({ prefix: PROJECT_MAP_PREFIX });
  const newPathname = `${PROJECT_MAP_PREFIX}-${Date.now()}.json`;
  await put(newPathname, JSON.stringify(deduped), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
  });
  if (oldBlobs.length > 0) await del(oldBlobs.map(b => b.url));
}

// 用历史记录聚合出「所属项目 -> 出现次数最多的项目类型」映射，剔除 EXCLUDED_HISTORY_DATE 当天的脏数据
export async function buildProjectMapFromHistory(): Promise<Record<string, string>> {
  const records = await readAllRecords();
  const counts = new Map<string, Map<string, number>>();
  for (const r of records) {
    if (getBeijingDateStr(new Date(r.createdAt)) === EXCLUDED_HISTORY_DATE) continue;
    const project = normalizeProjectName(r.project ?? '');
    if (!project) continue;
    const type = normalizeProjectType(r.projectType);
    const inner = counts.get(project) ?? new Map<string, number>();
    inner.set(type, (inner.get(type) ?? 0) + 1);
    counts.set(project, inner);
  }
  const map: Record<string, string> = {};
  for (const [project, typeCounts] of counts) {
    let bestType = '';
    let bestCount = -1;
    for (const [type, count] of typeCounts) {
      if (count > bestCount) { bestType = type; bestCount = count; }
    }
    map[project] = bestType;
  }
  return map;
}

export async function sendToWecom(text: string): Promise<void> {
  const raw = process.env.WECOM_WEBHOOK_URL;
  if (!raw) throw new Error('WECOM_WEBHOOK_URL 未配置');

  const urls = raw.split(',').map(u => u.trim()).filter(Boolean);
  const payload = JSON.stringify({ msgtype: 'text', text: { content: text } });

  const results = await Promise.allSettled(
    urls.map(url =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      }).then(res => {
        if (!res.ok) return res.text().then(b => Promise.reject(`${res.status} ${b}`));
      })
    )
  );

  const failures = results
    .map((r, i) => (r.status === 'rejected' ? `webhook[${i}]: ${r.reason}` : null))
    .filter(Boolean);

  if (failures.length) throw new Error(`企业微信发送失败: ${failures.join('; ')}`);
}
