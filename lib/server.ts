import { list, put, del } from '@vercel/blob';
import { WorkRecord } from './report';

const BLOB_PREFIX = 'weekly-records';

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
