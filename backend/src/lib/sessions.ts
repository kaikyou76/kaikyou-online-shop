// backend/src/lib/sessions.ts
export const generateSessionToken = (): string => {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
};

// セッション検証用ユーティリティ（変更なし）
export const validateSession = async (
  db: D1Database,
  sessionToken: string
): Promise<{ isValid: boolean; userId?: number }> => {
  const result = await db
    .prepare(
      "SELECT user_id FROM sessions WHERE session_token = ? AND expires_at > datetime('now')"
    )
    .bind(sessionToken)
    .first<{ user_id: number }>();

  return { isValid: !!result, userId: result?.user_id };
};
