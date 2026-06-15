'use client';

import { useState } from 'react';

interface Props {
  onLogin: (username: string) => void;
}

export default function LoginPage({ onLogin }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      localStorage.setItem('weeklyreport_user', data.username);
      onLogin(data.username);
    } catch (err: unknown) {
      setError((err as Error).message || '密码错误');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">

        {/* Left — blue panel */}
        <div className="login-left">
          {/* Decorative dots */}
          <div style={{ position:'absolute', top:'20%', left:'20%', width:12, height:12, background:'#FFB020', borderRadius:'50%', opacity:.8 }} />
          <div style={{ position:'absolute', top:'28%', right:'25%', width:24, height:16, background:'#FF5630', borderRadius:'50%', opacity:.8, transform:'rotate(-12deg)' }} />
          <div style={{ position:'absolute', bottom:'40%', left:'15%', width:16, height:16, background:'#36B37E', borderRadius:'50%', opacity:.8 }} />
          <div style={{ position:'absolute', bottom:'25%', right:'20%', width:32, height:12, background:'#6554C0', borderRadius:6, opacity:.8, transform:'rotate(45deg)' }} />
          <div style={{ position:'absolute', top:'15%', right:'40%', width:8, height:8, background:'#00B8D9', borderRadius:'50%', opacity:.8 }} />

          {/* Float card 1 — glassmorphism, top-left */}
          <div className="login-float-card" style={{ top:'18%', left:'12%', width:192, transform:'rotate(-6deg)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
              <div style={{ width:32, height:32, borderRadius:'50%', background:'rgba(255,255,255,.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </div>
              <div style={{ height:8, width:64, background:'rgba(255,255,255,.3)', borderRadius:4 }} />
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div style={{ height:6, width:'100%', background:'rgba(255,255,255,.2)', borderRadius:3 }} />
              <div style={{ height:6, width:'80%', background:'rgba(255,255,255,.2)', borderRadius:3 }} />
              <div style={{ height:6, width:'65%', background:'rgba(255,255,255,.2)', borderRadius:3 }} />
            </div>
          </div>

          {/* Float card 2 — white, middle-right */}
          <div className="login-float-card-white" style={{ top:'38%', right:'8%', width:176, transform:'rotate(3deg)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
              <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(25,103,210,.1)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1967d2" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              </div>
              <div style={{ height:6, width:56, background:'#E5E7EB', borderRadius:3 }} />
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginTop:20, paddingTop:8, borderTop:'1px solid #F3F4F6' }}>
              <div style={{ height:32, width:'33%', background:'rgba(25,103,210,.15)', borderRadius:6 }} />
              <div style={{ height:20, width:'33%', background:'#F3F4F6', borderRadius:6 }} />
            </div>
          </div>

          {/* Float card 3 — white mini, bottom-left */}
          <div className="login-float-card-white" style={{ bottom:'34%', left:'20%', width:176, transform:'rotate(-3deg)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#36B37E" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
              <div style={{ height:6, width:80, background:'#E5E7EB', borderRadius:3 }} />
            </div>
          </div>

          {/* Bottom text */}
          <div className="login-left-text">
            <h2 className="login-left-title">随时记录工作内容</h2>
            <p className="login-left-subtitle">一键生成标准格式周报，定时推送周报内容</p>
            <div className="login-dots">
              <div className="login-dot-active" />
              <div className="login-dot" />
              <div className="login-dot" />
            </div>
          </div>
        </div>

        {/* Right — form panel */}
        <div className="login-right">
          <div className="login-form-wrap">
            <div className="login-header">
              <div className="login-logo-wrap">
                <img src="/logo.jpg" alt="Logo" />
              </div>
              <h1 className="login-title">升级运维周报</h1>
              <p className="login-subtitle">请输入访问密码</p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="login-input-wrap">
                <input
                  className="login-input"
                  type="password"
                  placeholder="访问密码"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  autoFocus
                  required
                />
                <span className="login-input-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>
              </div>
              {error && <div className="login-error">{error}</div>}
              <button className="login-btn" type="submit" disabled={submitting || !password.trim()}>
                {submitting
                  ? <span className="spinner" style={{ borderColor:'rgba(255,255,255,.3)', borderTopColor:'#fff', width:20, height:20 }} />
                  : '进入系统'}
              </button>
            </form>
          </div>

          <div className="login-footer">© 企业班车/护驾项目组</div>
        </div>
      </div>
    </div>
  );
}
