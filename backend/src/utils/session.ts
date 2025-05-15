// backend/src/utils/session.ts
import type { Env } from "../types/types";

// セッションデータ型（DB準拠）
export type SessionData = {
  id?: number;
  user_id: number;
  session_token: string;
  expires_at: Date;
  user_agent?: string | null;
  ip_address?: string | null;
};

// クライアント向け型
export type ClientSessionData = {
  userId: number;
  sessionToken: string;
  expiresAt: string; // ISO形式
  userAgent?: string;
  ipAddress?: string;
};

type DatabaseSessionRow = {
  id?: number;
  user_id: number;
  session_token: string;
  expires_at: string;
  user_agent?: string | null;
  ip_address?: string | null;
};

// セッション検証
export async function validateSession(
  sessionToken: string,
  env: Env
): Promise<SessionData> {
  const result = await env.DB.prepare(
    `SELECT * FROM sessions WHERE session_token = ?`
  )
    .bind(sessionToken)
    .first<DatabaseSessionRow>();

  if (!result) {
    throw new Error("Invalid session token");
  }

  const expiresAt = new Date(result.expires_at);
  if (expiresAt < new Date()) {
    throw new Error("Session expired");
  }

  return {
    user_id: result.user_id,
    session_token: result.session_token,
    expires_at: expiresAt,
    user_agent: result.user_agent || undefined,
    ip_address: result.ip_address || undefined,
  };
}

// クライアント向け変換
export function toClientSession(session: SessionData): ClientSessionData {
  return {
    userId: session.user_id,
    sessionToken: session.session_token,
    expiresAt: session.expires_at.toISOString(),
    ...(session.user_agent && { userAgent: session.user_agent }),
    ...(session.ip_address && { ipAddress: session.ip_address }),
  };
}

// 新規セッション作成（DB登録含む）
export async function createNewSession(params: {
  db: Env["DB"];
  user_id: number;
  session_token: string;
  expires_at: Date;
  user_agent?: string;
  ip_address?: string;
}): Promise<SessionData> {
  const { db, ...sessionData } = params;

  await db
    .prepare(
      `INSERT INTO sessions (
        user_id, 
        session_token, 
        expires_at, 
        user_agent, 
        ip_address
      ) VALUES (?, ?, ?, ?, ?)`
    )
    .bind(
      sessionData.user_id,
      sessionData.session_token,
      sessionData.expires_at.toISOString(),
      sessionData.user_agent || null,
      sessionData.ip_address || null
    )
    .run();

  return {
    user_id: sessionData.user_id,
    session_token: sessionData.session_token,
    expires_at: sessionData.expires_at,
    user_agent: sessionData.user_agent,
    ip_address: sessionData.ip_address,
  };
}
