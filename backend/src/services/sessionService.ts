// backend/src/services/sessionService.ts
interface Session {
  user_id: number;
  email: string;
  expires_at: string;
  autoRenew?: boolean;
}

const sessions = new Map<string, Session>(); // 実際はRedis等を使用

export async function verifySession(sessionId: string): Promise<Session> {
  const session = sessions.get(sessionId);
  if (!session) throw new Error("セッションが見つかりません");
  return session;
}

export async function createSession(params: {
  userId: number;
  email: string;
  expiresIn: string;
}): Promise<string> {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 2); // 有効期限設定

  sessions.set(sessionId, {
    user_id: params.userId,
    email: params.email,
    expires_at: expiresAt.toISOString(),
    autoRenew: true,
  });

  return sessionId;
}
