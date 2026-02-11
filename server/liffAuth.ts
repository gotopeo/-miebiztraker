/**
 * LIFF認証処理
 * LINEユーザーIDからシステムユーザーを特定し、セッショントークンを発行する
 */

import { getDb } from "./db";
import { lineConnections, users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { sdk } from "./_core/sdk";

/**
 * LINEユーザーIDからシステムユーザーを特定し、セッショントークンを発行
 * 
 * @param lineUserId - LINEユーザーID
 * @returns セッショントークンとユーザー情報
 * @throws LINE連携が完了していない場合はエラー
 */
export async function authenticateWithLiff(lineUserId: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("DATABASE_NOT_AVAILABLE");
  }

  // LINE連携情報を取得
  const connection = await db
    .select()
    .from(lineConnections)
    .where(eq(lineConnections.lineUserId, lineUserId))
    .limit(1);

  if (connection.length === 0) {
    throw new Error("LINE_CONNECTION_NOT_FOUND");
  }

  const userId = connection[0].userId;

  // ユーザー情報を取得
  const userResult = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (userResult.length === 0) {
    throw new Error("USER_NOT_FOUND");
  }

  const user = userResult[0];

  // セッショントークンを発行
  // Manus SDKのcreateSessionTokenを使用してセッションを作成
  const sessionToken = await sdk.createSessionToken(user.openId, {
    name: user.name || "",
  });

  return {
    sessionToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      openId: user.openId,
      isOnboarded: user.isOnboarded,
    },
  };
}
