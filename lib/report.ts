export interface WorkRecord {
  id: string;
  date: string;
  projectType: string;
  project: string;
  content: string;
  issue: string;
  createdAt: string;
}

export const VALID_PROJECT_TYPES = ['企业班车', '交通护驾', '大问号', '其他', '公交地铁'] as const;
export type ProjectType = typeof VALID_PROJECT_TYPES[number];

export function getWeekKey(date = new Date()): string {
  // 显式偏移到北京时间 UTC+8，确保服务端（UTC）和客户端行为一致
  const bjMs = date.getTime() + 8 * 60 * 60 * 1000;
  const d = new Date(bjMs);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  const y  = d.getUTCFullYear();
  const m  = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// 返回北京当前日期字符串 YYYY-MM-DD
export function getBeijingDateStr(date = new Date()): string {
  const bjMs = date.getTime() + 8 * 60 * 60 * 1000;
  const d = new Date(bjMs);
  const y  = d.getUTCFullYear();
  const m  = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

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
