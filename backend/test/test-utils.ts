// backend/test/test-utils.ts
import { createId } from "@paralleldrive/cuid2";

export const generateTestUser = () => {
  const id = createId(); // createIdを直接呼び出して一意のIDを生成
  return {
    username: `testuser_${id}`,
    password: `TestPass123!${id}`,
    email: `test_${id}@example.com`,
  };
};

export const cleanupTestUsers = async () => {
  // テストユーザー削除ロジック（例: DBから削除）
};
