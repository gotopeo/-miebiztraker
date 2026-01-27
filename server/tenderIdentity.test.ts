/**
 * 案件同一性判定ロジックのユニットテスト
 */
import { describe, it, expect } from "vitest";
import {
  normalizeString,
  generateTenderCanonicalId,
  matchesKeywords,
  matchesIssuers,
  matchesProjectType,
  detectChanges,
} from "./tenderIdentity";
import type { Bidding } from "../drizzle/schema";

describe("normalizeString", () => {
  it("should normalize full-width characters to half-width", () => {
    expect(normalizeString("Ａ１２３")).toBe("a123");
  });

  it("should normalize spaces", () => {
    expect(normalizeString("  hello　world  ")).toBe("hello world");
  });

  it("should convert to lowercase", () => {
    expect(normalizeString("HELLO World")).toBe("hello world");
  });

  it("should handle empty string", () => {
    expect(normalizeString("")).toBe("");
  });
});

describe("generateTenderCanonicalId", () => {
  it("should generate ID from detailUrl", () => {
    const bidding = {
      detailUrl: "https://example.com/bidding/12345",
      title: "道路工事",
      orderOrganName: "三重県",
      constructionType: "土木一式",
    };

    const id1 = generateTenderCanonicalId(bidding);
    const id2 = generateTenderCanonicalId(bidding);

    expect(id1).toMatch(/^url-[a-f0-9]{16}$/);
    expect(id1).toBe(id2); // 同じURLなら同じID
  });

  it("should generate ID from composite key when no detailUrl", () => {
    const bidding = {
      title: "道路工事",
      orderOrganName: "三重県",
      constructionType: "土木一式",
    };

    const id1 = generateTenderCanonicalId(bidding);
    const id2 = generateTenderCanonicalId(bidding);

    expect(id1).toMatch(/^composite-[a-f0-9]{16}$/);
    expect(id1).toBe(id2); // 同じ内容なら同じID
  });

  it("should generate different IDs for different biddings", () => {
    const bidding1 = {
      title: "道路工事A",
      orderOrganName: "三重県",
      constructionType: "土木一式",
    };

    const bidding2 = {
      title: "道路工事B",
      orderOrganName: "三重県",
      constructionType: "土木一式",
    };

    const id1 = generateTenderCanonicalId(bidding1);
    const id2 = generateTenderCanonicalId(bidding2);

    expect(id1).not.toBe(id2);
  });
});

describe("matchesKeywords", () => {
  it("should match when keyword is included (OR condition)", () => {
    expect(matchesKeywords("道路工事の案件", ["道路", "橋梁"])).toBe(true);
    expect(matchesKeywords("橋梁補修の案件", ["道路", "橋梁"])).toBe(true);
  });

  it("should not match when no keyword is included", () => {
    expect(matchesKeywords("建築工事の案件", ["道路", "橋梁"])).toBe(false);
  });

  it("should match all when keywords is empty", () => {
    expect(matchesKeywords("任意の案件", [])).toBe(true);
  });

  it("should be case-insensitive", () => {
    expect(matchesKeywords("ROAD工事", ["road"])).toBe(true);
  });

  it("should handle full-width characters", () => {
    expect(matchesKeywords("道路工事", ["道路"])).toBe(true);
  });
});

describe("matchesIssuers", () => {
  const issuerMap = new Map<number, string>([
    [1, "三重県県土整備部"],
    [2, "三重県農林水産部"],
    [3, "津市"],
  ]);

  it("should match when issuer is included", () => {
    expect(matchesIssuers("三重県県土整備部", [1], issuerMap)).toBe(true);
    expect(matchesIssuers("県土整備部", [1], issuerMap)).toBe(true); // 部分一致
  });

  it("should not match when issuer is not included", () => {
    expect(matchesIssuers("三重県教育委員会", [1, 2], issuerMap)).toBe(false);
  });

  it("should match all when issuerIds is empty", () => {
    expect(matchesIssuers("任意の発注機関", [], issuerMap)).toBe(true);
  });
});

describe("matchesProjectType", () => {
  it("should match when project type is included", () => {
    expect(matchesProjectType("土木一式工事", "土木")).toBe(true);
    expect(matchesProjectType("建築一式工事", "建築")).toBe(true);
  });

  it("should not match when project type is not included", () => {
    expect(matchesProjectType("土木一式工事", "建築")).toBe(false);
  });

  it("should match all when projectType is undefined", () => {
    expect(matchesProjectType("任意の工事", undefined)).toBe(true);
  });
});

describe("detectChanges", () => {
  const oldBidding: Bidding = {
    id: 1,
    caseNumber: "12345",
    tenderCanonicalId: "test-id",
    title: "道路工事",
    orderOrganCode: "001",
    orderOrganName: "三重県",
    biddingDate: null,
    openingDate: new Date("2024-01-15"),
    estimatedPrice: null,
    minimumPrice: null,
    biddingMethod: null,
    constructionType: "土木一式",
    location: null,
    constructionPeriod: null,
    rating: null,
    applicationPeriod: null,
    applicationDeadline: new Date("2024-01-10"),
    hasQuestion: null,
    publicationDate: null,
    updateDate: null,
    lastUpdatedAtSource: null,
    performLocation: null,
    remarks: null,
    status: null,
    detailUrl: "https://example.com/1",
    firstSeenAt: new Date(),
    lastSeenAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("should detect title change", () => {
    const newBidding = { ...oldBidding, title: "橋梁工事" };
    const result = detectChanges(oldBidding, newBidding);

    expect(result.hasChanges).toBe(true);
    expect(result.changedFields).toContain("案件名");
  });

  it("should detect deadline change", () => {
    const newBidding = { ...oldBidding, applicationDeadline: new Date("2024-01-12") };
    const result = detectChanges(oldBidding, newBidding);

    expect(result.hasChanges).toBe(true);
    expect(result.changedFields).toContain("締切日");
  });

  it("should detect no changes", () => {
    const newBidding = { ...oldBidding };
    const result = detectChanges(oldBidding, newBidding);

    expect(result.hasChanges).toBe(false);
    expect(result.changedFields).toHaveLength(0);
  });

  it("should detect multiple changes", () => {
    const newBidding = {
      ...oldBidding,
      title: "橋梁工事",
      orderOrganName: "津市",
    };
    const result = detectChanges(oldBidding, newBidding);

    expect(result.hasChanges).toBe(true);
    expect(result.changedFields).toContain("案件名");
    expect(result.changedFields).toContain("発注機関");
  });
});
