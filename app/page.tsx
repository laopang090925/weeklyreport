'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { VALID_PROJECT_TYPES, WorkRecord } from '@/lib/report';
import LoginPage from './LoginPage';

interface Toast { msg: string; type: 'success' | 'error' | 'info' }

function getWeekKeyByOffset(offset: number): string {
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
  const mon = new Date(weekKey + 'T00:00:00Z');
  const fri = new Date(mon.getTime() + 4 * 24 * 60 * 60 * 1000);
  const dot = (d: Date) =>
    `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')}`;
  return `${dot(mon)} - ${dot(fri)}`;
}

export default function Page() {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('weeklyreport_user');
    setCurrentUser(stored);
    setAuthChecked(true);
  }, []);

  const [records, setRecords] = useState<WorkRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [weekLoading, setWeekLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const [projectType, setProjectType] = useState<string>(VALID_PROJECT_TYPES[0]);
  const [project, setProject] = useState('');
  const [content, setContent] = useState('');
  const [issue, setIssue] = useState('');

  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);

  const [editingRecord, setEditingRecord] = useState<WorkRecord | null>(null);
  const [editProjectType, setEditProjectType] = useState('');
  const [editProject, setEditProject] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editIssue, setEditIssue] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const weekKey = getWeekKeyByOffset(weekOffset);
  const weekDisplay = getWeekDisplay(weekKey);
  const isCurrentWeek = weekOffset === 0;

  const showToast = useCallback((msg: string, type: Toast['type'] = 'info') => {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchRecords = useCallback(async (showWeekLoading = false) => {
    if (showWeekLoading) setWeekLoading(true);
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
        body: JSON.stringify({ projectType, project, content, issue: issue || '无', author: currentUser ?? undefined }),
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
    setPreviewText('');
    setPreviewLoading(true);
    setShowModal(true);
    try {
      const res = await fetch(`/api/weekly-report?week=${weekKey}`);
      const data = await res.json();
      setPreviewText(data.report || '本周暂无记录');
    } catch {
      showToast('预览失败', 'error');
      setShowModal(false);
    } finally {
      setPreviewLoading(false);
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

  function openEdit(r: WorkRecord) {
    setEditingRecord(r);
    setEditProjectType(r.projectType);
    setEditProject(r.project);
    setEditContent(r.content);
    setEditIssue(r.issue === '无' ? '' : r.issue);
  }

  async function handleEditSave() {
    if (!editingRecord) return;
    if (!editProject.trim() || !editContent.trim()) {
      showToast('所属项目和工作内容不能为空', 'error');
      return;
    }
    setEditSaving(true);
    try {
      const res = await fetch('/api/record', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingRecord.id,
          week: weekKey,
          projectType: editProjectType,
          project: editProject,
          content: editContent,
          issue: editIssue || '无',
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      const { record } = await res.json();
      setRecords(prev => prev.map(r => r.id === record.id ? record : r));
      showToast('记录已更新', 'success');
      setEditingRecord(null);
    } catch (err: unknown) {
      showToast((err as Error).message || '保存失败', 'error');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleImport() {
    if (!isCurrentWeek) {
      showToast('只能在当前周导入记录', 'error');
      return;
    }
    const lines = importText.split('\n').map(l => l.trim()).filter(Boolean);
    const parsed: Array<{ projectType: string; project: string; content: string; issue: string }> = [];
    for (const line of lines) {
      // strip leading "1. " or "1、" numbering
      const stripped = line.replace(/^\d+[.、\s]+/, '');
      const parts = stripped.split('｜');
      if (parts.length < 3) continue;
      const pt = parts[0].trim();
      const proj = parts[1].trim();
      const cont = parts[2].trim();
      const iss = (parts[3] ?? '').trim() || '无';
      if (!proj || !cont) continue;
      parsed.push({ projectType: pt || '其他', project: proj, content: cont, issue: iss });
    }
    if (parsed.length === 0) {
      showToast('未识别到有效记录，请检查格式', 'error');
      return;
    }
    setImporting(true);
    try {
      const results: WorkRecord[] = [];
      for (const item of parsed) {
        const res = await fetch('/api/record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...item, author: currentUser ?? undefined }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error);
        }
        const { record } = await res.json();
        results.push(record);
      }
      setRecords(prev => [...prev, ...results]);
      showToast(`成功导入 ${results.length} 条记录`, 'success');
      setImportText('');
      setShowImportModal(false);
    } catch (err: unknown) {
      showToast((err as Error).message || '导入失败', 'error');
    } finally {
      setImporting(false);
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

  if (!authChecked) return null;
  if (!currentUser) return <LoginPage onLogin={setCurrentUser} />;

  function handleLogout() {
    localStorage.removeItem('weeklyreport_user');
    setCurrentUser(null);
  }

  return (
    <>
      <div className="topbar">
        <span className="topbar-title">企业班车/护驾项目组工作记录</span>
        <div className="topbar-user">
          <span className="topbar-username">{currentUser}</span>
          <button className="btn-logout" onClick={handleLogout}>退出</button>
        </div>
      </div>

      <div className="layout">
        {/* Left: Add form */}
        <div className="card">
          <div className="card-head">添加工作记录</div>
          <form className="form-body" onSubmit={handleAdd}>

            {/* 截止时间提醒 */}
            <div className="deadline-notice">
              <span>⏰</span>
              <span>周期内录入工作记录截止到每周五 17:00</span>
            </div>

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
                className="content-area"
                placeholder="请描述本次工作内容"
                value={content}
                onChange={e => setContent(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">遇到的问题</label>
              <textarea
                className="issue-area"
                placeholder="描述遇到的问题，无则留空"
                value={issue}
                onChange={e => setIssue(e.target.value)}
              />
            </div>
            <div className="form-spacer" />
            {/* 推送逻辑提示 */}
            <div className="push-notice">📅 每周五 18:00 自动推送至企微群</div>
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
              {(weekLoading || deletingId !== null || loading) && (
                <div className="loading-overlay">
                  <div className="loading-dots"><span /><span /><span /></div>
                </div>
              )}
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
                        <span className={`record-issue${r.issue && r.issue !== '无' ? ' has-issue' : ''}`}>
                          {r.issue && r.issue !== '无' ? `⚠ ${r.issue}` : '无问题'}
                        </span>
                      </div>
                      <span className="record-content">{r.content}</span>
                    </div>
                    <div className="record-right">
                      <button
                        className="btn-edit"
                        onClick={() => openEdit(r)}
                        disabled={deletingId !== null}
                        title="编辑"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button
                        className="btn-del"
                        onClick={() => handleDelete(r.id)}
                        disabled={deletingId !== null}
                        title="删除"
                      >
                        <span>✕</span>
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
              <button className="btn-import" onClick={() => { setShowImportModal(true); setImportText(''); }} disabled={!isCurrentWeek}>
                导入
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

      {/* Edit Modal */}
      {editingRecord && (
        <div
          className="modal-mask"
          onClick={e => { if (e.target === e.currentTarget) setEditingRecord(null); }}
        >
          <div className="modal edit-modal">
            <div className="modal-head">
              <span className="modal-title">编辑工作记录</span>
              <button className="modal-close" onClick={() => setEditingRecord(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">项目类型</label>
                <div className="type-tabs">
                  {VALID_PROJECT_TYPES.map(t => (
                    <div
                      key={t}
                      className={`type-tab${editProjectType === t ? ' active' : ''}`}
                      onClick={() => setEditProjectType(t)}
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
                  value={editProject}
                  onChange={e => setEditProject(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">工作内容</label>
                <textarea
                  className="content-area"
                  placeholder="请描述本次工作内容"
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">遇到的问题</label>
                <textarea
                  className="issue-area"
                  placeholder="描述遇到的问题，无则留空"
                  value={editIssue}
                  onChange={e => setEditIssue(e.target.value)}
                />
              </div>
              <button
                className="btn-edit-save"
                onClick={handleEditSave}
                disabled={editSaving}
              >
                {editSaving && <span className="spinner" />}
                保存修改
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div
          className="modal-mask"
          onClick={e => { if (e.target === e.currentTarget) setShowImportModal(false); }}
        >
          <div className="modal import-modal">
            <div className="modal-head">
              <span className="modal-title">批量导入工作记录</span>
              <button className="modal-close" onClick={() => setShowImportModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p className="import-hint">可将多条工作记录文本粘贴在文本框中，一键导入。格式：<code>项目类型｜所属项目｜工作内容｜问题</code>，每行一条，编号可选。</p>
              <textarea
                className="import-textarea"
                placeholder={"1. 企业班车｜吉利吉行｜配合客户做现场测试刷卡｜无\n2. 交通护驾｜淮安公交｜汇总解决现有用户问题｜无"}
                value={importText}
                onChange={e => setImportText(e.target.value)}
                rows={10}
              />
              <button
                className="btn-import-confirm"
                onClick={handleImport}
                disabled={importing || !importText.trim()}
              >
                {importing && <span className="spinner" />}
                确认导入
              </button>
            </div>
          </div>
        </div>
      )}

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
              {previewLoading ? (
                <div className="modal-loading">
                  <div className="modal-spinner" />
                  <span>生成中…</span>
                </div>
              ) : (
                <>
                  <button className="modal-copy-btn" onClick={copyReport}>
                    <span>📋</span> 复制全文
                  </button>
                  <div className="modal-pre">{previewText}</div>
                </>
              )}
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
