import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getLineProfile } from "../_core/line";
import { getLineConnectionByLineUserId, insertLineConnection } from "../db";
import { getDb } from "../db";
import { users as userTable } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { sdk } from "../_core/sdk";

/**
 * LIFF自動ログイン・ユーザー登録ルーター
 */
export const liffAuthRouter = router({
  /**
   * LIFFからのログイン・自動ユーザー登録
   * 
   * 処理フロー:
   * 1. LINEユーザーIDで既存の連携を検索
   * 2. 連携が存在する場合: セッショントークンを発行して返す
   * 3. 連携が存在しない場合: 新規ユーザーを作成 → LINE連携 → セッショントークンを発行
   */
  loginOrRegister: publicProcedure
    .input(
      z.object({
        lineUserId: z.string(),
        lineAccessToken: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { lineUserId, lineAccessToken } = input;

      try {
        // LINEプロフィール情報を取得
        const profile = await getLineProfile(lineUserId);
        const displayName = profile.displayName;

        // 既存の連携を検索
        const existingConnection = await getLineConnectionByLineUserId(lineUserId);

        let userId: number;

        if (existingConnection) {
          // 既存ユーザー
          userId = existingConnection.userId;
        } else {
          // 新規ユーザーを作成
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          const [newUser] = await db
            .insert(userTable)
            .values({
              name: displayName || "LINE User",
              openId: `line_${lineUserId}`, // LINE専用のopenId
              role: "user",
            })
            .$returningId();

          userId = newUser.id;

          // LINE連携を作成
          await insertLineConnection({
            userId,
            lineUserId,
            lineDisplayName: displayName,
          });

          console.log(`[LIFF Auth] New user created: userId=${userId}, lineUserId=${lineUserId}`);
        }

        // セッショントークンを作成
        // LINEユーザーのopenIdを使用
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const [userRecord] = await db.select().from(userTable).where(eq(userTable.id, userId));
        if (!userRecord) throw new Error("User not found");
        
        const sessionToken = await sdk.createSessionToken(userRecord.openId, { name: displayName });

        return {
          success: true,
          sessionToken,
          isNewUser: !existingConnection,
        };
      } catch (error) {
        console.error("[LIFF Auth] Error:", error);
        throw new Error("ログイン処理中にエラーが発生しました");
      }
    }),
});
