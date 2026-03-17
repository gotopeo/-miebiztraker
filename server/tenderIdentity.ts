/**
 * 案件同一性判定ロジック
 * 新ロジック仕様に基づく実装
 */
import { Bidding } from "../drizzle/schema";

/**
 * 文字列を正規化（全角半角統一、空白統一、大小文字統一）
 */
export function normalizeString(str: string | number | null | undefined): string {
  if (str === null || str === undefined || str === "") return "";
  // 数値が渡された場合は文字列に変換
  const strValue = String(str);
  
  return strValue
    // 全角英数字を半角に変換
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
    // 全角スペースを半角に変換
    .replace(/　/g, " ")
    // 連続する空白を1つに
    .replace(/\s+/g, " ")
    // 前後の空白を削除
    .trim()
    // 小文字に統一
    .toLowerCase();
}

/**
 * 案件同一性キー（tender_canonical_id）を生成
 * 
 * 新ロジック仕様：
 * tenderCanonicalId = 案件番号
 * 
 * 案件番号は三重県入札サイト上で一意かつ不変であることを前提とする
 * ただし、念のため発注機関コードと組み合わせて一意性を保証する
 */
export function generateTenderCanonicalId(bidding: Partial<Bidding>): string {
  // 案件番号が存在する場合
  if (bidding.caseNumber) {
    // 必ずString()で文字列に変換してからnormalizeStringに渡す
    const caseNumberStr = String(bidding.caseNumber);
    // 発注機関コードがある場合は組み合わせて一意性を保証
    if (bidding.orderOrganCode) {
      const organCodeStr = String(bidding.orderOrganCode);
      return `${normalizeString(organCodeStr)}-${normalizeString(caseNumberStr)}`;
    }
    // 案件番号のみの場合
    return normalizeString(caseNumberStr);
  }

  // 案件番号が取得できない場合（エラーケース）
  // 詳細URLをフォールバックとして使用
  if (bidding.detailUrl) {
    return `url-${normalizeString(bidding.detailUrl)}`;
  }

  // 最終手段：案件名＋発注機関名
  const fallbackKey = `${normalizeString(bidding.orderOrganName || "")}-${normalizeString(bidding.title || "")}`;
  return `fallback-${fallbackKey}`;
}

/**
 * キーワードがOR条件で一致するかチェック
 */
export function matchesKeywords(title: string, keywords: string[]): boolean {
  if (!keywords || keywords.length === 0) {
    return true; // キーワード指定なしの場合は全て一致
  }

  const normalizedTitle = normalizeString(title);
  
  // いずれか1つでも含まれればtrue（OR条件）
  return keywords.some((keyword) => {
    const normalizedKeyword = normalizeString(keyword);
    return normalizedTitle.includes(normalizedKeyword);
  });
}

/**
 * 発注機関フィルターに一致するかチェック
 */
export function matchesIssuers(orderOrganName: string, issuerIds: number[], issuerMap: Map<number, string>): boolean {
  if (!issuerIds || issuerIds.length === 0) {
    return true; // 発注機関指定なしの場合は全て一致
  }

  const normalizedIssuer = normalizeString(orderOrganName);
  
  // issuerIdsに対応する発注機関名のいずれかに一致するかチェック
  return issuerIds.some((id) => {
    const issuerName = issuerMap.get(id);
    if (!issuerName) return false;
    
    const normalizedIssuerName = normalizeString(issuerName);
    return normalizedIssuer.includes(normalizedIssuerName) || normalizedIssuerName.includes(normalizedIssuer);
  });
}

/**
 * 工種/委託種別フィルターに一致するかチェック
 */
export function matchesProjectType(constructionType: string, projectType?: string): boolean {
  if (!projectType) {
    return true; // 種別指定なしの場合は全て一致
  }

  const normalizedType = normalizeString(constructionType);
  const normalizedProjectType = normalizeString(projectType);
  
  return normalizedType.includes(normalizedProjectType);
}

/**
 * タイトル（案件名）が変更されたかチェック
 * 新ロジック仕様：更新判定はタイトル差分のみで行う
 */
export function detectTitleChange(oldTitle: string, newTitle: string): boolean {
  const oldNormalized = normalizeString(oldTitle);
  const newNormalized = normalizeString(newTitle);
  
  return oldNormalized !== newNormalized;
}

/**
 * 案件が更新されたかチェック（差分判定）
 * 新ロジック仕様：タイトル変更のみで更新判定
 */
export function detectChanges(oldBidding: Bidding, newBidding: Partial<Bidding>): {
  hasChanges: boolean;
  changedFields: string[];
} {
  const changedFields: string[] = [];

  // タイトル変更のみチェック
  if (newBidding.title && detectTitleChange(oldBidding.title, newBidding.title)) {
    changedFields.push("案件名");
  }

  return {
    hasChanges: changedFields.length > 0,
    changedFields,
  };
}

/**
 * 重要な変更を検出
 * 締切日、予定価格、開札日などの重要な項目の変更を検出する
 * （参考情報として保持、通知判定には使用しない）
 */
export interface ImportantChange {
  field: string;
  fieldLabel: string;
  oldValue: string | null;
  newValue: string | null;
  importance: "high" | "medium";
}

export interface ImportantChangesResult {
  hasImportantChanges: boolean;
  changes: ImportantChange[];
}

export function detectImportantChanges(
  oldBidding: Bidding,
  newBidding: Partial<Bidding>
): ImportantChangesResult {
  const changes: ImportantChange[] = [];

  // 重要度: 高
  const highImportanceFields = [
    { key: "applicationDeadline" as keyof Bidding, label: "締切日", formatter: formatDate },
    { key: "openingDate" as keyof Bidding, label: "開札日", formatter: formatDate },
    { key: "estimatedPrice" as keyof Bidding, label: "予定価格", formatter: formatPrice },
    { key: "minimumPrice" as keyof Bidding, label: "最低制限価格", formatter: formatPrice },
  ];

  // 重要度: 中
  const mediumImportanceFields = [
    { key: "title" as keyof Bidding, label: "案件名", formatter: (v: any) => String(v || "") },
    { key: "location" as keyof Bidding, label: "工事場所", formatter: (v: any) => String(v || "") },
    { key: "constructionPeriod" as keyof Bidding, label: "工期", formatter: (v: any) => String(v || "") },
    { key: "rating" as keyof Bidding, label: "格付", formatter: (v: any) => String(v || "") },
  ];

  // 重要度: 高の変更をチェック
  for (const field of highImportanceFields) {
    const oldValue = oldBidding[field.key];
    const newValue = newBidding[field.key];

    if (hasChanged(oldValue, newValue)) {
      changes.push({
        field: field.key,
        fieldLabel: field.label,
        oldValue: field.formatter(oldValue),
        newValue: field.formatter(newValue),
        importance: "high",
      });
    }
  }

  // 重要度: 中の変更をチェック
  for (const field of mediumImportanceFields) {
    const oldValue = oldBidding[field.key];
    const newValue = newBidding[field.key];

    if (hasChanged(oldValue, newValue)) {
      changes.push({
        field: field.key,
        fieldLabel: field.label,
        oldValue: field.formatter(oldValue),
        newValue: field.formatter(newValue),
        importance: "medium",
      });
    }
  }

  return {
    hasImportantChanges: changes.length > 0,
    changes,
  };
}

/**
 * 値が変更されたかチェック
 */
function hasChanged(oldValue: any, newValue: any): boolean {
  // 両方nullまたはundefinedの場合は変更なし
  if ((oldValue == null) && (newValue == null)) {
    return false;
  }

  // 一方だけnullまたはundefinedの場合は変更あり
  if ((oldValue == null) !== (newValue == null)) {
    return true;
  }

  // 日付の場合
  if (oldValue instanceof Date && newValue instanceof Date) {
    return oldValue.getTime() !== newValue.getTime();
  }

  // 文字列の場合は正規化して比較
  if (typeof oldValue === "string" && typeof newValue === "string") {
    return normalizeString(oldValue) !== normalizeString(newValue);
  }

  // その他の場合は厳密等価で比較
  return oldValue !== newValue;
}

/**
 * 日付をフォーマット
 */
function formatDate(value: any): string {
  if (!value) return "";
  if (value instanceof Date) {
    return value.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }
  return String(value);
}

/**
 * 価格をフォーマット
 */
function formatPrice(value: any): string {
  if (!value) return "";
  const num = Number(value);
  if (isNaN(num)) return String(value);
  return `¥${num.toLocaleString("ja-JP")}`;
}

/**
 * 変更内容をメッセージ形式にフォーマット
 */
export function formatChangesMessage(changes: ImportantChange[]): string {
  if (changes.length === 0) return "";

  let message = "🔄 以下の項目が変更されました:\n\n";

  for (const change of changes) {
    const oldVal = change.oldValue || "(未設定)";
    const newVal = change.newValue || "(未設定)";
    message += `• ${change.fieldLabel}: ${oldVal} → ${newVal}\n`;
  }

  return message;
}
