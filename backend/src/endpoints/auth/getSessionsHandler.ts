// // backend/src/endpoints/auth/getSessionsHandler.ts
// import { Context } from "hono";
// import { Bindings, ErrorResponse, SuccessResponse } from "../../types/types";
// import type { SessionData } from "../../utils/session";

// export const getSessionsHandler = async (
//   c: Context<{ Bindings: Bindings; Variables: { session: SessionData } }>
// ): Promise<Response> => {
//   const startTime = Date.now();
//   const traceId = crypto.randomUUID();
//   const session = c.get("session");

//   try {
//     console.log(`[${traceId}] セッション取得処理開始`, {
//       userId: session.user_id,
//       ip: c.req.header("CF-Connecting-IP"),
//     });

//     if (!session) {
//       const errorResponse: ErrorResponse = {
//         error: {
//           code: "INVALID_SESSION",
//           message: "セッションが無効です",
//           solution: "再ログインしてください",
//           meta: { traceId },
//         },
//       };
//       return c.json(errorResponse, 401);
//     }

//     const query = `
//       SELECT
//         id,
//         session_token,
//         expires_at,
//         user_agent,
//         ip_address,
//         created_at
//       FROM sessions
//       WHERE user_id = ?
//       ORDER BY created_at DESC
//       LIMIT 50
//     `;

//     const dbResult = await c.env.DB.prepare(query).bind(session.user_id).all<{
//       id: number;
//       session_token: string;
//       expires_at: string;
//       user_agent: string | null;
//       ip_address: string | null;
//       created_at: string;
//     }>();

//     if (!dbResult.success) {
//       const errorResponse: ErrorResponse = {
//         error: {
//           code: "DB_ERROR",
//           message: "データベースエラー",
//           meta: { traceId },
//         },
//       };
//       return c.json(errorResponse, 500);
//     }

//     const formattedSessions = (dbResult.results || []).map((s) => ({
//       id: s.id,
//       sessionToken: s.session_token,
//       expiresAt: s.expires_at,
//       userAgent: s.user_agent,
//       ipAddress: s.ip_address,
//       createdAt: s.created_at,
//       isCurrent: s.session_token === session.session_token, // 現在のセッションかどうか
//     }));

//     const successResponse: SuccessResponse<typeof formattedSessions> = {
//       data: formattedSessions,
//       meta: {
//         currentSessionId: session.session_token,
//         traceId,
//         duration: `${Date.now() - startTime}ms`,
//       },
//     };

//     return c.json(successResponse, 200);
//   } catch (error) {
//     const errorResponse: ErrorResponse = {
//       error: {
//         code: "INTERNAL_ERROR",
//         message: "セッション履歴の取得に失敗しました",
//         meta: {
//           errorId: `ERR_${Date.now()}`,
//           traceId,
//         },
//       },
//     };
//     return c.json(errorResponse, 500);
//   }
// };
