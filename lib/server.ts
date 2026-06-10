import { list, put, del } from '@vercel/blob';
import { WorkRecord } from './report';

const BLOB_PREFIX = 'weekly-records';

export function blobPathname(weekKey: string) {
  return `${BLOB_PREFIX}/${weekKey}.json`;
}

export async function readWeekRecords(weekKey: string): Promise<WorkRecord[]> {
  try {
    const prefix = blobPathname(weekKey);
    const { blobs } = await list({ prefix });
    console.log(`[readWeekRecords] prefix=${prefix} found=${blobs.length}`);
    if (blobs.length === 0) return [];
    const res = await fetch(blobs[0].downloadUrl, { cache: 'no-store' });
    console.log(`[readWeekRecords] fetch status=${res.status}`);
    if (!res.ok) return [];
    const data = await res.json();
    console.log(`[readWeekRecords] records=${data.length}`);
    return data;
  } catch (e) {
    console.error('[readWeekRecords] error:', e);
    return [];
  }
}

export async function writeWeekRecords(weekKey: string, records: WorkRecord[]): Promise<void> {
  await put(blobPathname(weekKey), JSON.stringify(records), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
  });
}

export async function deleteWeekBlob(weekKey: string): Promise<void> {
  const { blobs } = await list({ prefix: blobPathname(weekKey) });
  if (blobs.length > 0) await del(blobs[0].url);
}

export async function sendToWecom(text: string): Promise<void> {
  const webhookUrl = process.env.WECOM_WEBHOOK_URL;
  if (!webhookUrl) throw new Error('WECOM_WEBHOOK_URL 未配置');
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ msgtype: 'text', text: { content: text } }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`企业微信发送失败: ${res.status} ${body}`);
  }
}
