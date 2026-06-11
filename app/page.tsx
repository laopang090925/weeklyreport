'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { VALID_PROJECT_TYPES, WorkRecord, getWeekKey } from '@/lib/report';

interface Toast { msg: string; type: 'success' | 'error' | 'info' }

function getWeekKeyByOffset(offset: number): string {
  // 显式使用 UTC+8（北京时间），与服务端 getWeekKey 保持一致
  const bjMs = Date.now() + 8 * 60 * 60 * 1000 + offset * 7 * 24 * 60 * 60 * 1000;
  const d = new Date(bjMs);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - day + (day === 0 ? -6 : 1));
  const y  = d.getUTCFullYear();
  const m  = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function getWeekDisplay(weekKey: string): string {
  // weekKey 是 YYYY-MM-DD 日历日期，用 UTC midnight 解析后用 UTC 方法取值
  const mon = new Date(weekKey + 'T00:00:00Z');
  const fri = new Date(mon.getTime() + 4 * 24 * 60 * 60 * 1000);
  const dot = (d: Date) =>
    `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')}`;
  return `${dot(mon)} - ${dot(fri)}`;
}

export default function Page() {
  const [records, setRecords] = useState<WorkRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [weekLoading, setWeekLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [weekOffset, setWeekOffset] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(null);

  // form state
  const [projectType, setProjectType] = useState<string>(VALID_PROJECT_TYPES[0]);
  const [project, setProject] = useState('');
  const [content, setContent] = useState('');
  const [issue, setIssue] = useState('');

  const weekKey = getWeekKeyByOffset(weekOffset);
  const weekDisplay = getWeekDisplay(weekKey);
  const isCurrentWeek = weekOffset === 0;
  const currentWeekKey = getWeekKey();
  const currentWeekDisplay = getWeekDisplay(currentWeekKey);

  const showToast = useCallback((msg: string, type: Toast['type'] = 'info') => {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchRecords = useCallback(async (showWeekLoading = false) => {
    if (showWeekLoading) {
      setRecords([]);
      setWeekLoading(true);
    }
    try {
      const res = await fetch(`/api/record?week=${weekKey}`);
      const data = await res.json();
      setRecords(data.records ?? []);
    } catch {
      showToast('加载记录失败', 'error');
    } finally {
      if (showWeekLoading) setWeekLoading(false);
    }
  }, [weekKey, showToast]);

  useEffect(() => { fetchRecords(true); }, [fetchRecords]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!project.trim() || !content.trim()) {
      showToast('所属项目和工作内容不能为空', 'error');
      return;
    }
    if (!isCurrentWeek) {
      showToast('只能在当前周添加记录', 'error');
      setWeekOffset(0);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectType, project, content, issue: issue || '无' }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      const { record } = await res.json();
      setRecords(prev => [...prev, record]);
      setProject('');
      setContent('');
      setIssue('');
      showToast('记录已添加', 'success');
    } catch (err: unknown) {
      showToast((err as Error).message || '添加失败', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/record?id=${id}&week=${weekKey}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setRecords(prev => prev.filter(r => r.id !== id));
      showToast('已删除');
    } catch {
      showToast('删除失败，请重试', 'error');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/record?week=${weekKey}`);
      const data = await res.json();
      setRecords(data.records ?? []);
    } catch {
      showToast('刷新失败', 'error');
    } finally {
      setRefreshing(false);
    }
  }

  async function handlePreview() {
    try {
      const res = await fetch(`/api/weekly-report?week=${weekKey}`);
      const data = await res.json();
      setPreviewText(data.report || '本周暂无记录');
      setShowModal(true);
    } catch {
      showToast('预览失败', 'error');
    }
  }

  async function handleSend() {
    const secret = prompt('请输入发送密钥（CRON_SECRET）：');
    if (!secret) return;
    setSending(true);
    try {
      const res = await fetch('/api/weekly-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPreviewText(data.report);
      setShowModal(true);
      showToast('周报已发送到企业微信！', 'success');
    } catch (err: unknown) {
      showToast((err as Error).message || '发送失败', 'error');
    } finally {
      setSending(false);
    }
  }

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(previewText);
      showToast('已复制到剪贴板', 'success');
    } catch {
      showToast('复制失败', 'error');
    }
  }

  return (
    <>
      <div className="topbar">
        <span className="topbar-title">升级运维 · 工作记录</span>
        <span className="topbar-week">{currentWeekDisplay}</span>
      </div>

      <div className="layout">
        {/* Left: Add form */}
        <div className="card">
          <div className="card-head">添加工作记录</div>
          <form className="form-body" onSubmit={handleAdd}>
            <div className="form-group">
              <label className="form-label">项目类型</label>
              <div className="type-tabs">
                {VALID_PROJECT_TYPES.map(t => (
                  <div
                    key={t}
                    className={`type-tab${projectType === t ? ' active' : ''}`}
                    onClick={() => setProjectType(t)}
                  >
                    {t}
                  </div>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">所属项目</label>
              <input
                type="text"
                placeholder="请输入所属项目名称"
                value={project}
                onChange={e => setProject(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">工作内容</label>
              <textarea
                placeholder="请描述本次工作内容"
                value={content}
                onChange={e => setContent(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                遇到的问题{' '}
                <span className="form-label-hint">（留空则填「无」）</span>
              </label>
              <input
                type="text"
                placeholder="描述遇到的问题，无则留空"
                value={issue}
                onChange={e => setIssue(e.target.value)}
              />
            </div>
            <div className="form-spacer" />
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading && <span className="spinner" />}
              提交记录
            </button>
          </form>
        </div>

        {/* Right: Records */}
        <div className="right-panel">
          <div className="card right-card">
            <div className="week-nav">
              <div className="week-center">
                <span className="week-range">{weekDisplay}</span>
                <span className="week-count">{records.length} 条</span>
              </div>
              <div className="week-pill">
                <button
                  className="pill-btn"
                  onClick={() => setWeekOffset(o => o - 1)}
                  disabled={weekLoading}
                  title="上一周"
                >
                  ‹
                </button>
                <button
                  className="pill-btn"
                  onClick={() => setWeekOffset(o => o + 1)}
                  disabled={weekOffset >= 0 || weekLoading}
                  title="下一周"
                >
                  ›
                </button>
              </div>
            </div>

            <div className="record-list">
              {weekLoading ? (
                <div className="record-empty">
                  <span className="spinner" style={{ borderColor: 'rgba(0,0,0,.15)', borderTopColor: 'var(--blue)', width: 20, height: 20 }} />
                </div>
              ) : records.length === 0 ? (
                <div className="record-empty">暂无记录</div>
              ) : (
                records.map((r, i) => (
                  <div key={r.id} className="record-item">
                    <span className="record-num">{i + 1}</span>
                    <div className="record-fields">
                      <div className="record-bubbles">
                        <span className="bubble bubble-type">{r.projectType}</span>
                        <span className="bubble bubble-project">{r.project}</span>
                        <span className="record-divider">|</span>
                      </div>
                      <span className="record-content">{r.content}</span>
                    </div>
                    <div className="record-right">
                      <span className={`record-issue${r.issue && r.issue !== '无' ? ' has-issue' : ''}`}>
                        {r.issue && r.issue !== '无' ? `⚠ ${r.issue}` : '无问题'}
                      </span>
                      <button
                        className="btn-del"
                        onClick={() => handleDelete(r.id)}
                        disabled={deletingId === r.id}
                        title="删除"
                      >
                        {deletingId === r.id
                          ? <span className="spinner" style={{ borderColor: 'rgba(239,68,68,.3)', borderTopColor: '#EF4444', width: 10, height: 10, borderWidth: 1.5 }} />
                          : <span>✕</span>
                        }
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="action-bar">
              <button
                className="btn-refresh-icon"
                onClick={handleRefresh}
                disabled={refreshing || weekLoading}
                title="刷新记录"
              >
                {refreshing
                  ? <span className="spinner" style={{ borderColor: 'rgba(0,0,0,.15)', borderTopColor: 'var(--blue)', width: 14, height: 14 }} />
                  : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
                }
              </button>
              <button className="btn-preview" onClick={handlePreview} disabled={records.length === 0}>
                预览周报
              </button>
              <button className="btn-send" onClick={handleSend} disabled={sending || records.length === 0}>
                {sending && <span className="spinner" />}
                手动发送到企业微信
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showModal && (
        <div
          className="modal-mask"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="modal">
            <div className="modal-head">
              <span className="modal-title">周报预览</span>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <button className="modal-copy-btn" onClick={copyReport}>
                <span>📋</span> 复制全文
              </button>
              <div className="modal-pre">{previewText}</div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.type}`}>{toast.msg}</div>
      )}
    </>
  );
}
