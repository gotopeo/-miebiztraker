/**
 * LIFF認証用のtRPCルーター
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { authenticateWithLiff } from "../liffAuth.js";
import { COOKIE_NAME } from "../../shared/const";

export const liffRouter = router({
  /**
   * LIFF経由でLINEユーザーIDを使用して認証
   */
  authenticate: publicProcedure
    .input(
      z.object({
        lineUserId: z.string().min(1, "LINE User ID is required"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { sessionToken, user } = await authenticateWithLiff(input.lineUserId);

        // セッションクッキーを設定
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 365 * 24 * 60 * 60 * 1000, // 1年
          path: "/",
        });

        return {
          success: true,
          user,
        };
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === "LINE_CONNECTION_NOT_FOUND") {
            return {
              success: false,
              error: "LINE_CONNECTION_NOT_FOUND",
              message: "LINE連携が完了していません。先にLINE連携を行ってください。",
            };
          }
          if (error.message === "USER_NOT_FOUND") {
            return {
              success: false,
              error: "USER_NOT_FOUND",
              message: "ユーザーが見つかりません。",
            };
          }
        }

        console.error("[LIFF Auth] Authentication failed:", error);
        return {
          success: false,
          error: "AUTHENTICATION_FAILED",
          message: "認証に失敗しました。",
        };
      }
    }),
});
