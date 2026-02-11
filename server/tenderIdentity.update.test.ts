/**
 * 重要な変更検出ロジックのユニットテスト
 */
import { describe, it, expect } from "vitest";
import { detectImportantChanges, formatChangesMessage } from "./tenderIdentity";
import { Bidding } from "../drizzle/schema";

describe("detectImportantChanges", () => {
  const baseBidding: Bidding = {
    id: 1,
    caseNumber: "TEST-001",
    title: "道路改修工事",
    orderOrganName: "三重県",
    orderOrganCode: "001",
    projectType: "工事",
    categoryCode: "土木一式",
    rating: "A",
    location: "三重県津市",
    constructionPeriod: "2026年4月～2026年9月",
    biddingMethod: "一般競争入札",
    applicationDeadline: new Date("2026-03-15"),
    openingDate: new Date("2026-03-20"),
    estimatedPrice: "50000000",
    minimumPrice: "40000000",
    detailUrl: "https://example.com/detail/001",
    publicationDate: new Date("2026-01-15"),
    updateDate: new Date("2026-01-15"),
    tenderCanonicalId: "TEST-001-canonical",
    firstSeenAt: new Date("2026-01-15"),
    lastSeenAt: new Date("2026-01-15"),
    lastUpdatedAtSource: new Date("2026-01-15"),
    createdAt: new Date("2026-01-15"),
    updatedAt: new Date("2026-01-15"),
  };

  it("締切日の変更を検出する", () => {
    const newBidding = {
      ...baseBidding,
      applicationDeadline: new Date("2026-03-20"), // 5日延長
    };

    const result = detectImportantChanges(baseBidding, newBidding);

    expect(result.hasImportantChanges).toBe(true);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].field).toBe("applicationDeadline");
    expect(result.changes[0].fieldLabel).toBe("締切日");
    expect(result.changes[0].importance).toBe("high");
  });

  it("予定価格の変更を検出する", () => {
    const newBidding = {
      ...baseBidding,
      estimatedPrice: "55000000", // 500万円増額
    };

    const result = detectImportantChanges(baseBidding, newBidding);

    expect(result.hasImportantChanges).toBe(true);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].field).toBe("estimatedPrice");
    expect(result.changes[0].fieldLabel).toBe("予定価格");
    expect(result.changes[0].importance).toBe("high");
  });

  it("開札日の変更を検出する", () => {
    const newBidding = {
      ...baseBidding,
      openingDate: new Date("2026-03-25"),
    };

    const result = detectImportantChanges(baseBidding, newBidding);

    expect(result.hasImportantChanges).toBe(true);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].field).toBe("openingDate");
    expect(result.changes[0].fieldLabel).toBe("開札日");
    expect(result.changes[0].importance).toBe("high");
  });

  it("最低制限価格の変更を検出する", () => {
    const newBidding = {
      ...baseBidding,
      minimumPrice: "42000000",
    };

    const result = detectImportantChanges(baseBidding, newBidding);

    expect(result.hasImportantChanges).toBe(true);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].field).toBe("minimumPrice");
    expect(result.changes[0].fieldLabel).toBe("最低制限価格");
    expect(result.changes[0].importance).toBe("high");
  });

  it("案件名の変更を検出する（中程度の重要度）", () => {
    const newBidding = {
      ...baseBidding,
      title: "道路改修工事（変更）",
    };

    const result = detectImportantChanges(baseBidding, newBidding);

    expect(result.hasImportantChanges).toBe(true);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].field).toBe("title");
    expect(result.changes[0].fieldLabel).toBe("案件名");
    expect(result.changes[0].importance).toBe("medium");
  });

  it("工事場所の変更を検出する（中程度の重要度）", () => {
    const newBidding = {
      ...baseBidding,
      location: "三重県四日市市",
    };

    const result = detectImportantChanges(baseBidding, newBidding);

    expect(result.hasImportantChanges).toBe(true);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].field).toBe("location");
    expect(result.changes[0].fieldLabel).toBe("工事場所");
    expect(result.changes[0].importance).toBe("medium");
  });

  it("工期の変更を検出する（中程度の重要度）", () => {
    const newBidding = {
      ...baseBidding,
      constructionPeriod: "2026年4月～2026年10月", // 1ヶ月延長
    };

    const result = detectImportantChanges(baseBidding, newBidding);

    expect(result.hasImportantChanges).toBe(true);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].field).toBe("constructionPeriod");
    expect(result.changes[0].fieldLabel).toBe("工期");
    expect(result.changes[0].importance).toBe("medium");
  });

  it("格付の変更を検出する（中程度の重要度）", () => {
    const newBidding = {
      ...baseBidding,
      rating: "B",
    };

    const result = detectImportantChanges(baseBidding, newBidding);

    expect(result.hasImportantChanges).toBe(true);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].field).toBe("rating");
    expect(result.changes[0].fieldLabel).toBe("格付");
    expect(result.changes[0].importance).toBe("medium");
  });

  it("複数の項目が同時に変更された場合を検出する", () => {
    const newBidding = {
      ...baseBidding,
      applicationDeadline: new Date("2026-03-20"),
      estimatedPrice: "55000000",
      location: "三重県四日市市",
    };

    const result = detectImportantChanges(baseBidding, newBidding);

    expect(result.hasImportantChanges).toBe(true);
    expect(result.changes).toHaveLength(3);
    
    // 高重要度の変更
    const highImportanceChanges = result.changes.filter(c => c.importance === "high");
    expect(highImportanceChanges).toHaveLength(2);
    
    // 中重要度の変更
    const mediumImportanceChanges = result.changes.filter(c => c.importance === "medium");
    expect(mediumImportanceChanges).toHaveLength(1);
  });

  it("重要でない項目のみが変更された場合は検出しない", () => {
    const newBidding = {
      ...baseBidding,
      detailUrl: "https://example.com/detail/001-updated",
    };

    const result = detectImportantChanges(baseBidding, newBidding);

    expect(result.hasImportantChanges).toBe(false);
    expect(result.changes).toHaveLength(0);
  });

  it("変更がない場合は検出しない", () => {
    const result = detectImportantChanges(baseBidding, baseBidding);

    expect(result.hasImportantChanges).toBe(false);
    expect(result.changes).toHaveLength(0);
  });

  it("nullからnullへの変更は検出しない", () => {
    const biddingWithNull: Bidding = {
      ...baseBidding,
      minimumPrice: null,
    };

    const result = detectImportantChanges(biddingWithNull, { minimumPrice: null });

    expect(result.hasImportantChanges).toBe(false);
    expect(result.changes).toHaveLength(0);
  });

  it("nullから値への変更を検出する", () => {
    const biddingWithNull: Bidding = {
      ...baseBidding,
      minimumPrice: null,
    };

    const newBidding = {
      minimumPrice: "40000000",
    };

    const result = detectImportantChanges(biddingWithNull, newBidding);

    expect(result.hasImportantChanges).toBe(true);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].field).toBe("minimumPrice");
  });

  it("値からnullへの変更を検出する", () => {
    const newBidding = {
      minimumPrice: null,
    };

    const result = detectImportantChanges(baseBidding, newBidding);

    expect(result.hasImportantChanges).toBe(true);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].field).toBe("minimumPrice");
  });
});

describe("formatChangesMessage", () => {
  it("単一の変更をフォーマットする", () => {
    const changes = [
      {
        field: "applicationDeadline",
        fieldLabel: "締切日",
        oldValue: "2026/03/15",
        newValue: "2026/03/20",
        importance: "high" as const,
      },
    ];

    const message = formatChangesMessage(changes);

    expect(message).toContain("🔄 以下の項目が変更されました:");
    expect(message).toContain("• 締切日: 2026/03/15 → 2026/03/20");
  });

  it("複数の変更をフォーマットする", () => {
    const changes = [
      {
        field: "applicationDeadline",
        fieldLabel: "締切日",
        oldValue: "2026/03/15",
        newValue: "2026/03/20",
        importance: "high" as const,
      },
      {
        field: "estimatedPrice",
        fieldLabel: "予定価格",
        oldValue: "¥50,000,000",
        newValue: "¥55,000,000",
        importance: "high" as const,
      },
    ];

    const message = formatChangesMessage(changes);

    expect(message).toContain("🔄 以下の項目が変更されました:");
    expect(message).toContain("• 締切日: 2026/03/15 → 2026/03/20");
    expect(message).toContain("• 予定価格: ¥50,000,000 → ¥55,000,000");
  });

  it("変更がない場合は空文字列を返す", () => {
    const message = formatChangesMessage([]);

    expect(message).toBe("");
  });

  it("nullから値への変更をフォーマットする", () => {
    const changes = [
      {
        field: "minimumPrice",
        fieldLabel: "最低制限価格",
        oldValue: null,
        newValue: "¥40,000,000",
        importance: "high" as const,
      },
    ];

    const message = formatChangesMessage(changes);

    expect(message).toContain("• 最低制限価格: (未設定) → ¥40,000,000");
  });

  it("値からnullへの変更をフォーマットする", () => {
    const changes = [
      {
        field: "minimumPrice",
        fieldLabel: "最低制限価格",
        oldValue: "¥40,000,000",
        newValue: null,
        importance: "high" as const,
      },
    ];

    const message = formatChangesMessage(changes);

    expect(message).toContain("• 最低制限価格: ¥40,000,000 → (未設定)");
  });
});
