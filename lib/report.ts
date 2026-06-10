export interface WorkRecord {
  id: string;
  date: string;        // YYYY-MM-DD
  projectType: string;
  project: string;
  content: string;
  issue: string;
  createdAt: string;
}

export const VALID_PROJECT_TYPES = ['公交地铁', '企业班车', '交通护驾', '大问号', '其他'] as const;
export type ProjectType = typeof VALID_PROJECT_TYPES[number];

// 返回本周一的 YYYY-MM-DD 作为周标识
export function getWeekKey(date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

// 本周 Mon ~ Fri 日期范围（显示用）
export function getWeekRange(weekKey: string): { start: string; end: string } {
  const monday = new Date(weekKey);
  const friday = new Date(weekKey);
  friday.setDate(monday.getDate() + 4);
  const fmt = (d: Date) =>
    `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, '0')}`;
  return { start: fmt(monday), end: fmt(friday) };
}

export function normalizeProjectType(type: string): string {
  return (VALID_PROJECT_TYPES as readonly string[]).includes(type) ? type : '其他';
}

export function formatReport(records: WorkRecord[], reportDate: string): string {
  if (records.length === 0) return '';
  const lines = [
    `负责人：张达奇｜升级运维项目｜本周工作进展（${reportDate}）`,
    ...records.map((r, i) =>
      `${i + 1}. ${normalizeProjectType(r.projectType)}｜${r.project}｜${r.content}｜${r.issue || '无'}`
    ),
    '@软件团队小助手',
  ];
  return lines.join('\n');
}

export async function readWeekRecords(weekKey: string): Promise<WorkRecord[]> {
  const { list } = await import('@vercel/blob');
  try {
    const { blobs } = await list({ prefix: `weekly-records/${weekKey}.json` });
    if (blobs.length === 0) return [];
    const res = await fetch(blobs[0].downloadUrl, { cache: 'no-store' });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
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
