//backend/test/auth.test.ts
import { SELF } from "cloudflare:test";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { generateTestUser, cleanupTestUsers } from "./test-utils";

describe("認証フロー統合テスト", () => {
  const testUser = generateTestUser();

  beforeAll(async () => {
    // テスト開始前にテストユーザーを削除（重複登録防止）
    await cleanupTestUsers();
  });

  afterAll(async () => {
    // テスト終了後にテストユーザーを削除
    await cleanupTestUsers();
  });

  // 正常系テストケース
  it("ステップ1: 新規ユーザー登録", async () => {
    const response = await SELF.fetch("http://localhost/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testUser),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      success: true,
      data: {
        id: expect.any(String),
        username: testUser.username,
      },
    });
  });

  it("ステップ2: 重複ユーザー登録防止", async () => {
    const response = await SELF.fetch("http://localhost/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testUser),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "USER_ALREADY_EXISTS",
    });
  });

  it("ステップ3: ログイン成功", async () => {
    const response = await SELF.fetch("http://localhost/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: testUser.username,
        password: testUser.password,
      }),
    });

    expect(response.status).toBe(200);
    const cookies = response.headers.get("Set-Cookie");
    expect(cookies).toContain("session_token");
  });

  it("ステップ4: 認証済みユーザー情報取得", async () => {
    const loginResponse = await SELF.fetch("http://localhost/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: testUser.username,
        password: testUser.password,
      }),
    });

    const sessionCookie = loginResponse.headers.get("Set-Cookie");
    const userResponse = await SELF.fetch("http://localhost/auth/user", {
      headers: {
        Cookie: sessionCookie,
      },
    });

    expect(userResponse.status).toBe(200);
    expect(await userResponse.json()).toMatchObject({
      id: expect.any(String),
      username: testUser.username,
    });
  });

  it("ステップ5: ログアウト処理", async () => {
    const loginResponse = await SELF.fetch("http://localhost/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: testUser.username,
        password: testUser.password,
      }),
    });

    const sessionCookie = loginResponse.headers.get("Set-Cookie");
    const logoutResponse = await SELF.fetch("http://localhost/auth/logout", {
      method: "POST",
      headers: {
        Cookie: sessionCookie,
      },
    });

    expect(logoutResponse.status).toBe(204);
    expect(logoutResponse.headers.get("Set-Cookie")).toMatch(/session_token=;/);
  });

  // 異常系テストケース
  it("異常系1: 無効なメールアドレス形式での登録", async () => {
    const response = await SELF.fetch("http://localhost/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: testUser.username,
        password: testUser.password,
        email: "invalid-email",
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("異常系2: パスワードが最小長未満での登録", async () => {
    const response = await SELF.fetch("http://localhost/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: testUser.username,
        password: "123",
        email: testUser.email,
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("異常系3: 無効な認証情報でのログイン", async () => {
    const response = await SELF.fetch("http://localhost/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: testUser.username,
        password: "wrong_password",
      }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
  });

  it("異常系4: トークンなしでのユーザー情報取得", async () => {
    const response = await SELF.fetch("http://localhost/auth/user");
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("異常系5: 無効トークンでのユーザー情報取得", async () => {
    const response = await SELF.fetch("http://localhost/auth/user", {
      headers: {
        Cookie: "session_token=invalid_token",
      },
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  // セキュリティテスト
  it("セキュリティ1: SQLインジェクション攻撃の防止", async () => {
    const response = await SELF.fetch("http://localhost/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "admin' OR 1=1 --",
        password: "password123",
      }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
  });

  it("セキュリティ2: トークンの有効期限切れ", async () => {
    const expiredToken = "expired_token"; // 有効期限切れのトークンをシミュレート
    const response = await SELF.fetch("http://localhost/auth/user", {
      headers: {
        Cookie: `session_token=${expiredToken}`,
      },
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      code: "TOKEN_EXPIRED",
    });
  });
});
