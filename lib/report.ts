export interface WorkRecord {
  id: string;
  date: string;
  projectType: string;
  project: string;
  content: string;
  issue: string;
  author?: string;
  createdAt: string;
}

export const VALID_PROJECT_TYPES = ['企业班车', '交通护驾', '大问号', '数字员工', '公交地铁', '其他'] as const;
export type ProjectType = typeof VALID_PROJECT_TYPES[number];

export const PROJECT_TYPE_COLORS: Record<string, string> = {
  '企业班车': '#06B6D4',
  '交通护驾': '#2563EB',
  '大问号': '#FF6B35',
  '数字员工': '#7C3AED',
  '公交地铁': '#EC4899',
  '其他': '#0D9488',
};

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

// 归一化所属项目名称用作映射的去重 key：去首尾空白、全角空格转半角、合并连续空白
export function normalizeProjectName(name: string): string {
  return name.trim().replace(/　/g, ' ').replace(/\s+/g, ' ');
}

export function formatReport(records: WorkRecord[], reportDate: string): string {
  if (records.length === 0) return '';
  const lines = [
    `负责人：张达奇|升级运维项目|本周工作进展（${reportDate}）`,
    ...records.map((r, i) =>
      `${i + 1}. ${normalizeProjectType(r.projectType)}|${r.project}|${r.content}|${r.issue || '无'}`
    ),
  ];
  return lines.join('\n');
}
