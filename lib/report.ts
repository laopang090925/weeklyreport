export interface WorkRecord {
  id: string;
  date: string;
  projectType: string;
  project: string;
  content: string;
  issue: string;
  createdAt: string;
}

export const VALID_PROJECT_TYPES = ['公交地铁', '企业班车', '交通护驾', '大问号', '其他'] as const;
export type ProjectType = typeof VALID_PROJECT_TYPES[number];

export function getWeekKey(date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
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
