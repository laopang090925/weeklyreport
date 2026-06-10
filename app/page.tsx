'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { VALID_PROJECT_TYPES, WorkRecord, getWeekRange, getWeekKey } from '@/lib/report';

interface Toast { msg: string; type: 'success' | 'error' | 'info' }

export default function Page() {
  const [records, setRecords] = useState<WorkRecord[]>([]);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const weekKey = getWeekKey();
  const { start, end } = getWeekRange(weekKey);

  // form state
  const [projectType, setProjectType] = useState<string>(VALID_PROJECT_TYPES[0]);
  const [project, setProject] = useState('');
  const [content, setContent] = useState('');
  const [issue, setIssue] = useState('');

  const showToast = useCallback((msg: string, type: Toast['type'] = 'info') => {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
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
      setPreview('');
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
      setPreview('');
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
      setPreview(data.report || '本周暂无记录');
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
      setPreview(data.report);
      showToast('周报已发送到企业微信！', 'success');
    } catch (err: unknown) {
      showToast((err as Error).message || '发送失败', 'error');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="container">
      {/* Header */}
      <div className="header">
        <h1>升级运维 · 工作记录</h1>
        <span className="week-badge">本周 {start} ~ {end}</span>
      </div>

      {/* Add record form */}
      <div className="card">
        <div className="card-title">添加工作记录</div>
        <form onSubmit={handleAdd}>
          <div className="form-row">
            <select value={projectType} onChange={e => setProjectType(e.target.value)}>
              {VALID_PROJECT_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="所属项目（必填）"
              value={project}
              onChange={e => setProject(e.target.value)}
            />
          </div>
          <div className="form-row">
            <textarea
              placeholder="工作内容（必填）"
              value={content}
              onChange={e => setContent(e.target.value)}
            />
          </div>
          <div className="form-row">
            <input
              type="text"
              placeholder="遇到的问题（留空则填「无」）"
              value={issue}
              onChange={e => setIssue(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: '0 0 auto' }}>
              {loading && <span className="spinner" />}
              添加
            </button>
          </div>
        </form>
      </div>

      {/* Records list */}
      <div className="card">
        <div className="card-title">本周记录（{records.length} 条）</div>
        {records.length === 0 ? (
          <div className="empty">暂无记录，快来添加今天的工作吧</div>
        ) : (
          <div className="record-list">
            {records.map((r, i) => (
              <div key={r.id} className="record-item">
                <span className="record-index">{i + 1}</span>
                <div className="record-body">
                  <div className="record-meta">
                    <span className="tag tag-type">{r.projectType}</span>
                    <span className="tag tag-project">{r.project}</span>
                    <span className="tag tag-date">{r.date}</span>
                  </div>
                  <div className="record-content">{r.content}</div>
                  {r.issue && r.issue !== '无' && (
                    <div className="record-issue">问题：{r.issue}</div>
                  )}
                </div>
                <button className="btn btn-danger" onClick={() => handleDelete(r.id)}>删除</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview & Send */}
      <div className="card">
        <div className="card-title">周报操作</div>
        {preview && <div className="report-preview">{preview}</div>}
        <div className="action-bar">
          <button className="btn btn-outline" onClick={handlePreview} disabled={records.length === 0}>
            预览周报
          </button>
          <button className="btn btn-green" onClick={handleSend} disabled={sending || records.length === 0}>
            {sending && <span className="spinner" />}
            手动发送到企业微信
          </button>
        </div>
      </div>

      {toast && (
        <div className={`toast ${toast.type}`}>{toast.msg}</div>
      )}
    </div>
  );
}
