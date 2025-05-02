//backend/src/worker.ts
import app from "@/routes/index";
import type { Env } from "@/types/types";

const worker: ExportedHandler<Env> = {
  // 通常のリクエスト処理（GET/POST など）
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    return app.fetch(request, env, ctx);
  },

  // Scheduled イベントが必要な場合（例: cron バッチ処理）
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    // ここに定期実行タスクなどを実装可能
    // 例: データの自動バックアップ、キャッシュのクリアなど
  },
};

export default worker;
