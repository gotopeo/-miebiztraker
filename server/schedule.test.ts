import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { Context } from "./_core/context";

// モックユーザー（管理者）
const mockAdminUser = {
  id: 1,
  openId: "test-admin-openid",
  name: "Test Admin",
  email: "admin@test.com",
  role: "admin" as const,
  loginMethod: "oauth",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

// モックコンテキストを作成
function createMockContext(user: typeof mockAdminUser | undefined): Context {
  return {
    user,
    req: {} as any,
    res: {} as any,
  };
}

describe("Schedule API Tests", () => {
  let createdScheduleId: number | null = null;

  beforeAll(async () => {
    // テスト前の準備（必要に応じて）
  });

  afterAll(async () => {
    // テスト後のクリーンアップ
    if (createdScheduleId) {
      try {
        const caller = appRouter.createCaller(createMockContext(mockAdminUser));
        await caller.schedules.delete({ id: createdScheduleId });
      } catch (error) {
        console.log("Cleanup error (expected if already deleted):", error);
      }
    }
  });

  it("認証済みユーザーがスケジュール一覧を取得できる", async () => {
    const caller = appRouter.createCaller(createMockContext(mockAdminUser));
    const schedules = await caller.schedules.list();

    expect(Array.isArray(schedules)).toBe(true);
  });

  it("認証済みユーザーが新しいスケジュールを追加できる", async () => {
    const caller = appRouter.createCaller(createMockContext(mockAdminUser));

    const result = await caller.schedules.add({
      name: "テストスケジュール（毎日午前10時）",
      scheduleType: "daily",
      executionTime: "10:00",
      enabled: true,
    });

    expect(result.success).toBe(true);

    // 追加されたスケジュールを確認
    const schedules = await caller.schedules.list();
    const addedSchedule = schedules.find(
      (s) => s.name === "テストスケジュール（毎日午前10時）"
    );

    expect(addedSchedule).toBeDefined();
    expect(addedSchedule?.scheduleType).toBe("daily");
    expect(addedSchedule?.executionTime).toBe("10:00");
    expect(addedSchedule?.enabled).toBe(true);

    if (addedSchedule) {
      createdScheduleId = addedSchedule.id;
    }
  });

  it("認証済みユーザーがスケジュールを更新できる", async () => {
    if (!createdScheduleId) {
      throw new Error("テスト用スケジュールが作成されていません");
    }

    const caller = appRouter.createCaller(createMockContext(mockAdminUser));

    const result = await caller.schedules.update({
      id: createdScheduleId,
      executionTime: "11:00",
      enabled: false,
    });

    expect(result.success).toBe(true);

    // 更新されたスケジュールを確認
    const schedules = await caller.schedules.list();
    const updatedSchedule = schedules.find((s) => s.id === createdScheduleId);

    expect(updatedSchedule).toBeDefined();
    expect(updatedSchedule?.executionTime).toBe("11:00");
    expect(updatedSchedule?.enabled).toBe(false);
  });

  it("認証済みユーザーがスケジュールを削除できる", async () => {
    if (!createdScheduleId) {
      throw new Error("テスト用スケジュールが作成されていません");
    }

    const caller = appRouter.createCaller(createMockContext(mockAdminUser));

    const result = await caller.schedules.delete({ id: createdScheduleId });

    expect(result.success).toBe(true);

    // 削除されたことを確認
    const schedules = await caller.schedules.list();
    const deletedSchedule = schedules.find((s) => s.id === createdScheduleId);

    expect(deletedSchedule).toBeUndefined();

    // クリーンアップ済みなのでIDをリセット
    createdScheduleId = null;
  });

  it("週次スケジュールを追加できる", async () => {
    const caller = appRouter.createCaller(createMockContext(mockAdminUser));

    const result = await caller.schedules.add({
      name: "テストスケジュール（毎週月・水・金）",
      scheduleType: "weekly",
      executionTime: "14:00",
      daysOfWeek: "1,3,5",
      enabled: true,
    });

    expect(result.success).toBe(true);

    // 追加されたスケジュールを確認
    const schedules = await caller.schedules.list();
    const addedSchedule = schedules.find(
      (s) => s.name === "テストスケジュール（毎週月・水・金）"
    );

    expect(addedSchedule).toBeDefined();
    expect(addedSchedule?.scheduleType).toBe("weekly");
    expect(addedSchedule?.daysOfWeek).toBe("1,3,5");

    // クリーンアップ
    if (addedSchedule) {
      await caller.schedules.delete({ id: addedSchedule.id });
    }
  });

  it("未認証ユーザーはスケジュールにアクセスできない", async () => {
    const caller = appRouter.createCaller(createMockContext(undefined));

    await expect(caller.schedules.list()).rejects.toThrow();
  });
});
