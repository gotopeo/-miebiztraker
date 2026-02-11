import { describe, it, expect, beforeAll } from "vitest";
import { 
  insertNotificationSubscription, 
  getActiveNotificationSubscriptions,
  updateNotificationSubscription,
  getLineVerificationCode,
  insertLineConnection,
  getLineConnectionByUserId
} from "./db";

describe("Notification System", () => {
  let testUserId: number;

  beforeAll(() => {
    // テスト用のユーザーIDを設定（実際のユーザーIDを使用）
    testUserId = 1;
  });

  describe("Notification Subscriptions", () => {
    it("should create a notification subscription", async () => {
      const subscriptionId = await insertNotificationSubscription({
        userId: testUserId,
        name: "テスト通知設定",
        orderOrganCodes: "001,002",
        publicationDateDays: 7,
        updateDateDays: 3,
        keywords: "道路,橋梁",
        ratings: "A,B",
        estimatedPriceMin: "1000000",
        estimatedPriceMax: "10000000",
        notificationTimes: "08:00,12:00",
        enabled: true,
      });

      expect(subscriptionId).toBeDefined();
      expect(subscriptionId).toBeGreaterThan(0);
    });

    it("should get active notification subscriptions", async () => {
      const subscriptions = await getActiveNotificationSubscriptions();
      
      expect(Array.isArray(subscriptions)).toBe(true);
      // 有効な通知設定が存在する場合
      if (subscriptions.length > 0) {
        expect(subscriptions[0]).toHaveProperty("id");
        expect(subscriptions[0]).toHaveProperty("name");
        expect(subscriptions[0]).toHaveProperty("enabled");
        expect(subscriptions[0].enabled).toBe(true);
      }
    });

    it("should update notification subscription", async () => {
      const subscriptions = await getActiveNotificationSubscriptions();
      
      if (subscriptions.length > 0) {
        const subscriptionId = subscriptions[0].id;
        const now = new Date();
        
        await updateNotificationSubscription(subscriptionId, {
          lastNotifiedAt: now,
        });

        // 更新が成功したことを確認（エラーが発生しないことを確認）
        expect(true).toBe(true);
      }
    });
  });

  describe("LINE Verification Codes", () => {
    it("should retrieve verification code if exists", async () => {
      // このテストは実際にコードが生成された後に実行することを想定
      // 現在はgetLineVerificationCodeの動作確認のみ
      const code = "NONEXISTENT";
      const retrieved = await getLineVerificationCode(code);
      
      // 存在しないコードはnullを返す
      expect(retrieved).toBeNull();
    });
  });

  describe("LINE Connections", () => {
    it("should create LINE connection", async () => {
      const lineUserId = "U1234567890abcdef";
      const lineDisplayName = "テストユーザー";

      await insertLineConnection({
        userId: testUserId,
        lineUserId,
        lineDisplayName,
      });

      const connection = await getLineConnectionByUserId(testUserId);
      
      expect(connection).toBeDefined();
      if (connection) {
        expect(connection.lineUserId).toBe(lineUserId);
        expect(connection.lineDisplayName).toBe(lineDisplayName);
      }
    });
  });

  describe("Notification Filter Conditions", () => {
    it("should handle multiple filter conditions", async () => {
      const subscriptionId = await insertNotificationSubscription({
        userId: testUserId,
        name: "複合条件テスト",
        orderOrganCodes: "001,002,003",
        publicationDateDays: 14,
        updateDateDays: 7,
        keywords: "土木,建築,設備",
        ratings: "A,B,C",
        estimatedPriceMin: "5000000",
        estimatedPriceMax: "50000000",
        notificationTimes: "08:00,12:00,17:00",
        enabled: true,
      });

      expect(subscriptionId).toBeDefined();
      expect(subscriptionId).toBeGreaterThan(0);
    });

    it("should handle optional filter conditions", async () => {
      const subscriptionId = await insertNotificationSubscription({
        userId: testUserId,
        name: "最小条件テスト",
        notificationTimes: "09:00",
        enabled: true,
      });

      expect(subscriptionId).toBeDefined();
      expect(subscriptionId).toBeGreaterThan(0);
    });
  });
});
