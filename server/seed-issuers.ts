/**
 * 発注機関マスターデータの投入スクリプト
 * 三重県の発注機関一覧（47機関）
 */
import { getDb } from "./db.js";
import { issuers } from "../drizzle/schema.js";

const issuerData = [
  // 県土整備部
  { name: "県土整備部", category: "県土整備部", sortOrder: 1 },
  { name: "桑名建設事務所", category: "県土整備部", sortOrder: 2 },
  { name: "四日市建設事務所", category: "県土整備部", sortOrder: 3 },
  { name: "鈴鹿建設事務所", category: "県土整備部", sortOrder: 4 },
  { name: "津建設事務所", category: "県土整備部", sortOrder: 5 },
  { name: "松阪建設事務所", category: "県土整備部", sortOrder: 6 },
  { name: "伊勢建設事務所", category: "県土整備部", sortOrder: 7 },
  { name: "伊賀建設事務所", category: "県土整備部", sortOrder: 8 },
  { name: "尾鷲建設事務所", category: "県土整備部", sortOrder: 9 },
  { name: "熊野建設事務所", category: "県土整備部", sortOrder: 10 },
  
  // 農林水産部
  { name: "農林水産部", category: "農林水産部", sortOrder: 11 },
  { name: "桑名農林事務所", category: "農林水産部", sortOrder: 12 },
  { name: "四日市農林事務所", category: "農林水産部", sortOrder: 13 },
  { name: "鈴鹿農林事務所", category: "農林水産部", sortOrder: 14 },
  { name: "津農林水産事務所", category: "農林水産部", sortOrder: 15 },
  { name: "松阪農林事務所", category: "農林水産部", sortOrder: 16 },
  { name: "伊勢農林水産事務所", category: "農林水産部", sortOrder: 17 },
  { name: "伊賀農林事務所", category: "農林水産部", sortOrder: 18 },
  { name: "尾鷲農林水産事務所", category: "農林水産部", sortOrder: 19 },
  { name: "熊野農林事務所", category: "農林水産部", sortOrder: 20 },
  
  // その他の部局
  { name: "地域連携・交通部", category: "その他", sortOrder: 21 },
  { name: "総務部", category: "その他", sortOrder: 22 },
  { name: "環境生活部", category: "その他", sortOrder: 23 },
  { name: "医療保健部", category: "その他", sortOrder: 24 },
  { name: "子ども・福祉部", category: "その他", sortOrder: 25 },
  { name: "雇用経済部", category: "その他", sortOrder: 26 },
  { name: "デジタル社会推進局", category: "その他", sortOrder: 27 },
  { name: "企業庁", category: "その他", sortOrder: 28 },
  { name: "病院事業庁", category: "その他", sortOrder: 29 },
  { name: "教育委員会", category: "その他", sortOrder: 30 },
  { name: "警察本部", category: "その他", sortOrder: 31 },
  
  // 地域機関
  { name: "北勢県民センター", category: "地域機関", sortOrder: 32 },
  { name: "中勢県民センター", category: "地域機関", sortOrder: 33 },
  { name: "南勢志摩県民センター", category: "地域機関", sortOrder: 34 },
  { name: "伊賀県民センター", category: "地域機関", sortOrder: 35 },
  { name: "東紀州県民センター", category: "地域機関", sortOrder: 36 },
  
  // 港湾・空港関連
  { name: "四日市港管理組合", category: "港湾・空港", sortOrder: 37 },
  { name: "津松阪港管理組合", category: "港湾・空港", sortOrder: 38 },
  { name: "尾鷲港管理組合", category: "港湾・空港", sortOrder: 39 },
  
  // 研究機関・施設
  { name: "工業研究所", category: "研究機関", sortOrder: 40 },
  { name: "農業研究所", category: "研究機関", sortOrder: 41 },
  { name: "林業研究所", category: "研究機関", sortOrder: 42 },
  { name: "水産研究所", category: "研究機関", sortOrder: 43 },
  { name: "畜産研究所", category: "研究機関", sortOrder: 44 },
  
  // その他
  { name: "総合博物館", category: "その他", sortOrder: 45 },
  { name: "総合文化センター", category: "その他", sortOrder: 46 },
  { name: "その他", category: "その他", sortOrder: 47 },
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
