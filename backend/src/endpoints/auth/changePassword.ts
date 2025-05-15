// // backend/src/endpoints/auth/changePassword.ts
// import { Context } from "hono";
// import { Bindings, ErrorResponse, SuccessResponse } from "../../types/types";
// import { verifyPassword, hashPassword } from "../../lib/auth";
// import { z } from "zod";

// const changePasswordSchema = z.object({
//   currentPassword: z.string().min(1, "現在のパスワードが必要です"),
//   newPassword: z
//     .string()
//     .min(8, "8文字以上のパスワードが必要です")
//     .regex(/[A-Z]/, "大文字を含めてください")
//     .regex(/[0-9]/, "数字を含めてください"),
// });

// export const changePasswordHandler = async (
//   c: Context<{ Bindings: Bindings; Variables: { userId: number } }>
// ): Promise<Response> => {
//   const startTime = Date.now();
//   const traceId = crypto.randomUUID();
//   const userId = c.get("userId");

//   console.info(`[${traceId}] パスワード変更処理開始`, {
//     userId,
//     ip: c.req.header("CF-Connecting-IP"),
//     timestamp: new Date().toISOString(),
//   });

//   try {
//     const { currentPassword, newPassword } = await changePasswordSchema
//       .parseAsync(await c.req.json())
//       .catch((err: z.ZodError) => {
//         console.warn(`[${traceId}] バリデーションエラー`, {
//           details: err.flatten(),
//           userId,
//         });
//         throw err;
//       });

//     const user = await c.env.DB.prepare(
//       "SELECT password_hash, email FROM users WHERE id = ?"
//     )
//       .bind(userId)
//       .first<{ password_hash: string; email: string }>();

//     if (!user) {
//       const errorResponse: ErrorResponse = {
//         error: {
//           code: "USER_NOT_FOUND",
//           message: "アカウントが存在しません",
//           solution: "サポートへ問い合わせください",
//           meta: {
//             traceId,
//             timestamp: new Date().toISOString(),
//           },
//         },
//       };

//       console.error(`[${traceId}] ユーザー不存在`, errorResponse);
//       return c.json(errorResponse, 404);
//     }

//     const isMatch = await verifyPassword(currentPassword, user.password_hash);
//     if (!isMatch) {
//       const errorResponse: ErrorResponse = {
//         error: {
//           code: "INVALID_CREDENTIALS",
//           message: "現在のパスワードが違います",
//           solution: "パスワードリセットを利用してください",
//           meta: {
//             attemptsRemaining: 4,
//             traceId,
//             timestamp: new Date().toISOString(),
//           },
//         },
//       };

//       console.warn(`[${traceId}] パスワード不一致`, errorResponse);
//       return c.json(errorResponse, 401);
//     }

//     const newHash = await hashPassword(newPassword);
//     const result = await c.env.DB.prepare(
//       "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"
//     )
//       .bind(newHash, userId)
//       .run();

//     if (!result.success) {
//       throw new Error("DB更新に失敗しました");
//     }

//     // セッション無効化処理
//     try {
//       if (c.env.KV_SESSIONS) {
//         await c.env.KV_SESSIONS.delete(`user_${userId}_sessions`);
//         console.info(`[${traceId}] セッション無効化完了`, { userId });
//       }
//     } catch (e) {
//       console.error(`[${traceId}] セッション削除エラー`, {
//         error: e instanceof Error ? e.message : "Unknown error",
//       });
//     }

//     const successResponse: SuccessResponse<{ message: string }> = {
//       data: {
//         message: "パスワードが正常に更新されました",
//       },
//       meta: {
//         securityNotice: "他のデバイスから自動的にログアウトされました",
//         updatedAt: new Date().toISOString(),
//         traceId,
//         duration: `${Date.now() - startTime}ms`,
//       },
//     };

//     console.info(`[${traceId}] パスワード更新成功`, successResponse);
//     return c.json(successResponse, 200);
//   } catch (error) {
//     if (error instanceof z.ZodError) {
//       const errorResponse: ErrorResponse = {
//         error: {
//           code: "VALIDATION_ERROR",
//           message: "入力内容に問題があります",
//           details: error.flatten(),
//           solution: "入力ガイドを確認してください",
//           meta: {
//             traceId,
//             timestamp: new Date().toISOString(),
//           },
//         },
//       };

//       return c.json(errorResponse, 400);
//     }

//     const errorResponse: ErrorResponse = {
//       error: {
//         code: "SERVER_ERROR",
//         message: "システムエラーが発生しました",
//         solution: "時間をおいて再度お試しください",
//         meta: {
//           errorId: `ERR_${Date.now().toString(36)}`,
//           traceId,
//           timestamp: new Date().toISOString(),
//           duration: `${Date.now() - startTime}ms`,
//         },
//       },
//     };

//     console.error(`[${traceId}] パスワード変更エラー`, {
//       error: error instanceof Error ? error.stack : "Unknown error",
//       response: errorResponse,
//     });

//     return c.json(errorResponse, 500);
//   }
// };
