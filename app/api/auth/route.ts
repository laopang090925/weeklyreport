import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// POST /api/auth  body: { password: string }
// USER_PASSWORDS env format: "pass1:Name1,pass2:Name2"
export async function POST(req: NextRequest) {
  const { password } = await req.json();
  if (!password?.trim()) {
    return NextResponse.json({ error: '请输入密码' }, { status: 400 });
  }

  const raw = process.env.USER_PASSWORDS ?? '';
  const map: Record<string, string> = {};
  for (const entry of raw.split(',')) {
    const colonIdx = entry.indexOf(':');
    if (colonIdx === -1) continue;
    const p = entry.slice(0, colonIdx).trim();
    const u = entry.slice(colonIdx + 1).trim();
    if (p && u) map[p] = u;
  }

  const username = map[password.trim()];
  if (!username) {
    return NextResponse.json({ error: '密码错误' }, { status: 401 });
  }

  return NextResponse.json({ username });
}
