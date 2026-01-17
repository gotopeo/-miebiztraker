import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  searchBiddings,
  countBiddings,
  getBiddingById,
  insertBiddingsBatch,
  getScrapingLogs,
  insertScrapingLog,
  updateScrapingLog,
  getKeywordWatchesByUser,
  insertKeywordWatch,
  deleteKeywordWatch,
  updateKeywordWatch,
  getScheduleSettings,
  insertScheduleSetting,
  updateScheduleSetting,
  deleteScheduleSetting,
} from "./db";
import { scrapeMieBiddingSite } from "./scraper";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // 入札情報関連API
  biddings: router({
    // 入札情報検索・一覧取得
    search: protectedProcedure
      .input(
        z.object({
          keyword: z.string().optional(),
          orderOrganCode: z.string().optional(),
          startDate: z.string().optional(), // ISO date string
          endDate: z.string().optional(),
          status: z.string().optional(),
          page: z.number().default(1),
          pageSize: z.number().default(50),
        })
      )
      .query(async ({ input }) => {
        const offset = (input.page - 1) * input.pageSize;

        const [items, total] = await Promise.all([
          searchBiddings({
            keyword: input.keyword,
            orderOrganCode: input.orderOrganCode,
            startDate: input.startDate ? new Date(input.startDate) : undefined,
            endDate: input.endDate ? new Date(input.endDate) : undefined,
            status: input.status,
            limit: input.pageSize,
            offset,
          }),
          countBiddings({
            keyword: input.keyword,
            orderOrganCode: input.orderOrganCode,
            startDate: input.startDate ? new Date(input.startDate) : undefined,
            endDate: input.endDate ? new Date(input.endDate) : undefined,
            status: input.status,
          }),
        ]);

        return {
          items,
          total,
          page: input.page,
          pageSize: input.pageSize,
          totalPages: Math.ceil(total / input.pageSize),
        };
      }),

    // 入札情報詳細取得
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getBiddingById(input.id);
      }),

    // CSVエクスポート用データ取得
    exportCsv: protectedProcedure
      .input(
        z.object({
          keyword: z.string().optional(),
          orderOrganCode: z.string().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          status: z.string().optional(),
        })
      )
      .query(async ({ input }) => {
        // 全件取得（上限1000件）
        const items = await searchBiddings({
          keyword: input.keyword,
          orderOrganCode: input.orderOrganCode,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          status: input.status,
          limit: 1000,
        });

        return items;
      }),
  }),

  // スクレイピング関連API
  scraping: router({
    // 手動スクレイピング実行
    execute: protectedProcedure.mutation(async ({ ctx }) => {
      const startedAt = new Date();

      // ログ作成
      const logId = await insertScrapingLog({
        userId: ctx.user.id,
        executionType: "manual",
        startedAt,
        status: "running",
      });

      try {
        // スクレイピング実行
        const result = await scrapeMieBiddingSite();

        if (!result.success) {
          // 失敗
          await updateScrapingLog(logId, {
            finishedAt: new Date(),
            status: "failed",
            errorMessage: result.error,
            errorDetails: result.errorDetails,
          });

          return {
            success: false,
            error: result.error,
          };
        }

        // データベースに保存
        const { saved, duplicates } = await insertBiddingsBatch(result.biddings);

        // ログ更新
        await updateScrapingLog(logId, {
          finishedAt: new Date(),
          status: "success",
          itemsScraped: result.itemsScraped,
          newItems: saved,
        });

        return {
          success: true,
          itemsScraped: result.itemsScraped,
          newItems: saved,
          duplicates,
        };
      } catch (error) {
        // 予期しないエラー
        await updateScrapingLog(logId, {
          finishedAt: new Date(),
          status: "failed",
          errorMessage: error instanceof Error ? error.message : String(error),
          errorDetails: error instanceof Error ? error.stack : undefined,
        });

        throw error;
      }
    }),

    // スクレイピング履歴取得
    getLogs: protectedProcedure
      .input(z.object({ limit: z.number().default(50) }))
      .query(async ({ input }) => {
        return await getScrapingLogs(input.limit);
      }),
  }),

  // キーワード監視関連API
  keywords: router({
    // ユーザーのキーワード監視一覧取得
    list: protectedProcedure.query(async ({ ctx }) => {
      return await getKeywordWatchesByUser(ctx.user.id);
    }),

    // キーワード監視追加
    add: protectedProcedure
      .input(
        z.object({
          keyword: z.string().min(1),
          enabled: z.boolean().default(true),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await insertKeywordWatch({
          userId: ctx.user.id,
          keyword: input.keyword,
          enabled: input.enabled,
        });

        return { success: true };
      }),

    // キーワード監視削除
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteKeywordWatch(input.id);
        return { success: true };
      }),

    // キーワード監視更新
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          keyword: z.string().optional(),
          enabled: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        await updateKeywordWatch(id, updates);
        return { success: true };
      }),
  }),

  // スケジュール設定関連API
  schedules: router({
    // スケジュール設定一覧取得
    list: protectedProcedure.query(async () => {
      return await getScheduleSettings();
    }),

    // スケジュール設定追加
    add: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          scheduleType: z.enum(["daily", "weekly", "custom"]),
          executionTime: z.string(), // HH:mm
          daysOfWeek: z.string().optional(),
          cronExpression: z.string().optional(),
          enabled: z.boolean().default(true),
        })
      )
      .mutation(async ({ input }) => {
        await insertScheduleSetting(input);
        return { success: true };
      }),

    // スケジュール設定更新
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          scheduleType: z.enum(["daily", "weekly", "custom"]).optional(),
          executionTime: z.string().optional(),
          daysOfWeek: z.string().optional(),
          cronExpression: z.string().optional(),
          enabled: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        await updateScheduleSetting(id, updates);
        return { success: true };
      }),

    // スケジュール設定削除
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteScheduleSetting(input.id);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
