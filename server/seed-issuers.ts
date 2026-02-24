/**
 * 発注機関マスターデータの投入スクリプト
 * 三重県の発注機関一覧（23機関）
 */
import { getDb } from "./db.js";
import { issuers } from "../drizzle/schema.js";

const issuerData = [
  // 農政事務所
  { name: "桑名農政事務所", category: "農政事務所", sortOrder: 1 },
  
  // 建設事務所
  { name: "桑名建設事務所", category: "建設事務所", sortOrder: 2 },
  
  // 農林事務所
  { name: "四日市農林事務所", category: "農林事務所", sortOrder: 3 },
  
  // 建設事務所
  { name: "四日市建設事務所", category: "建設事務所", sortOrder: 4 },
  
  // 流域下水道事務所
  { name: "北勢流域下水道事務所", category: "流域下水道事務所", sortOrder: 5 },
  
  // 建設事務所
  { name: "鈴鹿建設事務所", category: "建設事務所", sortOrder: 6 },
  
  // 農林水産事務所
  { name: "津農林水産事務所", category: "農林水産事務所", sortOrder: 7 },
  
  // 建設事務所
  { name: "津建設事務所", category: "建設事務所", sortOrder: 8 },
  
  // 流域下水道事務所
  { name: "中南勢流域下水道事務所", category: "流域下水道事務所", sortOrder: 9 },
  
  // 農林事務所
  { name: "松阪農林事務所", category: "農林事務所", sortOrder: 10 },
  
  // 建設事務所
  { name: "松阪建設事務所", category: "建設事務所", sortOrder: 11 },
  
  // 農林水産事務所
  { name: "伊勢農林水産事務所", category: "農林水産事務所", sortOrder: 12 },
  
  // 建設事務所
  { name: "伊勢建設事務所", category: "建設事務所", sortOrder: 13 },
  { name: "志摩建設事務所", category: "建設事務所", sortOrder: 14 },
  
  // 農林事務所
  { name: "伊賀農林事務所", category: "農林事務所", sortOrder: 15 },
  
  // 建設事務所
  { name: "伊賀建設事務所", category: "建設事務所", sortOrder: 16 },
  
  // 農林水産事務所
  { name: "尾鷲農林水産事務所", category: "農林水産事務所", sortOrder: 17 },
  
  // 建設事務所
  { name: "尾鷲建設事務所", category: "建設事務所", sortOrder: 18 },
  
  // 農林事務所
  { name: "熊野農林事務所", category: "農林事務所", sortOrder: 19 },
  
  // 建設事務所
  { name: "熊野建設事務所", category: "建設事務所", sortOrder: 20 },
  
  // 水道事務所
  { name: "北勢水道事務所", category: "水道事務所", sortOrder: 21 },
  { name: "中勢水道事務所", category: "水道事務所", sortOrder: 22 },
  { name: "南勢水道事務所", category: "水道事務所", sortOrder: 23 },
];

async function seedIssuers() {
  try {
    console.log("発注機関マスターデータを投入します...");
    
    const db = await getDb();
    if (!db) {
      throw new Error("データベース接続に失敗しました");
    }
    
    // 既存データを削除
    await db.delete(issuers);
    console.log("既存データを削除しました");
    
    // 新規データを投入
    for (const issuer of issuerData) {
      await db.insert(issuers).values(issuer);
    }
    
    console.log(`${issuerData.length}件の発注機関を登録しました`);
    process.exit(0);
  } catch (error) {
    console.error("エラーが発生しました:", error);
    process.exit(1);
  }
}

seedIssuers();
