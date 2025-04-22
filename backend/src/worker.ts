import app from "routes/index";
import type { Bindings, Variables } from "types/types";

export interface Env extends Bindings {
  // Cloudflare環境用の追加バインドが必要な場合ここに定義
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    // 本番/開発環境の切り替え
    if (process.env.NODE_ENV === "production") {
      env.ENVIRONMENT = "production";
    }

    // Honoアプリケーションに処理を委譲
    return app.fetch(request, env, ctx);
  },

  // Scheduledイベントが必要な場合
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    // バッチ処理などを実装
  },
} satisfies ExportedHandler<Env>;
