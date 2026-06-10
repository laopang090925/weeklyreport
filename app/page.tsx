'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { VALID_PROJECT_TYPES, WorkRecord, getWeekKey } from '@/lib/report';

interface Toast { msg: string; type: 'success' | 'error' | 'info' }

function getWeekKeyByOffset(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset * 7);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return d.toISOString().split('T')[0];
}

function getWeekDisplay(weekKey: string): string {
  const mon = new Date(weekKey + 'T00:00:00');
  const fri = new Date(weekKey + 'T00:00:00');
  fri.setDate(mon.getDate() + 4);
  const dot = (d: Date) =>
    `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  return `${dot(mon)} - ${dot(fri)}`;
}

export default function Page() {
  const [records, setRecords] = useState<WorkRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [weekOffset, setWeekOffset] = useState(0);
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
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  const fetchRecords = useCallback(async () => {
    try {
      const res = await fetch(`/api/record?week=${weekKey}`);
      const data = await res.json();
      setRecords(data.records ?? []);
    } catch {
      showToast('加载记录失败', 'error');
    }
  }, [weekKey, showToast]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

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
      setProject('');
      setContent('');
      setIssue('');
      await fetchRecords();
      showToast('记录已添加', 'success');
    } catch (err: unknown) {
      showToast((err as Error).message || '添加失败', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/record?id=${id}&week=${weekKey}`, { method: 'DELETE' });
      await fetchRecords();
      showToast('已删除');
    } catch {
      showToast('删除失败', 'error');
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
                  title="上一周"
                >
                  ‹
                </button>
                <button
                  className="pill-btn"
                  onClick={() => setWeekOffset(o => o + 1)}
                  disabled={weekOffset >= 0}
                  title="下一周"
                >
                  ›
                </button>
              </div>
            </div>

            <div className="record-list">
              {records.length === 0 ? (
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
                      <button className="btn-del" onClick={() => handleDelete(r.id)} title="删除">
                        <span>✕</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="action-bar">
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
