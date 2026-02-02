import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { liffRouter } from "./routers/liff";
import { liffAuthRouter } from "./routers/liffAuth";
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
  getLineConnectionByUserId,
  getLineConnectionByLineUserId,
  insertLineConnection,
  deleteLineConnection,
  createVerificationCode,
  verifyCode,
  deleteUserVerificationCodes,
  getNotificationSubscriptions,
  insertNotificationSubscription,
  updateNotificationSubscription,
  deleteNotificationSubscription,
  getNotificationLogs,
  getAllIssuers,
  getIssuersByIds,
} from "./db";
import type { Issuer } from "../drizzle/schema";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { scrapeMieBiddings, convertToInsertBidding, SearchConditions } from "./scraper";
import { detectNewBiddings } from "./newBiddingDetector.js";
import { updateSchedule, removeSchedule, getActiveScheduleInfo } from "./scheduler";
import { sendLineTextMessage, getLineProfile } from "./_core/line";
import ExcelJS from "exceljs";

export const appRouter = router({
  system: systemRouter,
  liff: liffRouter,
  liffAuth: liffAuthRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    completeOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(users).set({ isOnboarded: true }).where(eq(users.id, ctx.user.id));
      return { success: true };
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
          newItemsFilter: z.enum(["24h", "7d", "30d"]).optional(),
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
            newItemsFilter: input.newItemsFilter,
            limit: input.pageSize,
            offset,
          }),
          countBiddings({
            keyword: input.keyword,
            orderOrganCode: input.orderOrganCode,
            startDate: input.startDate ? new Date(input.startDate) : undefined,
            endDate: input.endDate ? new Date(input.endDate) : undefined,
            status: input.status,
            newItemsFilter: input.newItemsFilter,
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
          newItemsFilter: z.enum(["24h", "7d", "30d"]).optional(),
        })
      )
      .mutation(async ({ input }) => {
        // 全件取得（上限1000件）
        console.log("[exportCsv mutation] Received input:", JSON.stringify(input));
        const items = await searchBiddings({
          keyword: input.keyword,
          orderOrganCode: input.orderOrganCode,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          status: input.status,
          newItemsFilter: input.newItemsFilter,
          limit: 1000,
        });

        return items;
      }),

    // Excelエクスポート
    exportExcel: protectedProcedure
      .input(
        z.object({
          keyword: z.string().optional(),
          orderOrganCode: z.string().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          status: z.string().optional(),
          newItemsFilter: z.enum(["24h", "7d", "30d"]).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // データ取得
        const items = await searchBiddings({
          keyword: input.keyword,
          orderOrganCode: input.orderOrganCode,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          status: input.status,
          newItemsFilter: input.newItemsFilter,
          limit: 10000,
        });

        // Excelワークブック作成
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("入札情報");

        // ヘッダー設定
        worksheet.columns = [
          { header: "No", key: "id", width: 10 },
          { header: "案件番号", key: "caseNumber", width: 15 },
          { header: "案件名", key: "title", width: 50 },
          { header: "発注機関", key: "orderOrganName", width: 30 },
          { header: "入札方式", key: "biddingMethod", width: 20 },
          { header: "工事種別", key: "constructionType", width: 20 },
          { header: "格付", key: "rating", width: 10 },
          { header: "参加申請期間", key: "applicationPeriod", width: 30 },
          { header: "状態", key: "status", width: 15 },
          { header: "入札日", key: "biddingDate", width: 20 },
          { header: "予定価格", key: "estimatedPrice", width: 15 },
          { header: "工事場所", key: "location", width: 30 },
        ];

        // データ追加
        items.forEach((item) => {
          worksheet.addRow({
            id: item.id,
            caseNumber: item.caseNumber,
            title: item.title,
            orderOrganName: item.orderOrganName,
            biddingMethod: item.biddingMethod,
            constructionType: item.constructionType,
            rating: item.rating,
            applicationPeriod: item.applicationPeriod,
            status: item.status,
            biddingDate: item.biddingDate ? new Date(item.biddingDate).toLocaleDateString("ja-JP") : "",
            estimatedPrice: item.estimatedPrice,
            location: item.location,
          });
        });

        // Excelファイルをバッファに変換
        const buffer = await workbook.xlsx.writeBuffer();
        const base64 = Buffer.from(buffer).toString("base64");

        return {
          success: true,
          data: base64,
          filename: `mie_bidding_${new Date().toISOString().split("T")[0]}.xlsx`,
        };
      }),
  }),

  // スクレイピング関連API
  scraping: router({
    // 手動スクレイピング実行（最新公告情報）
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
        const result = await scrapeMieBiddings({ useLatestAnnouncement: true }, false);

        if (!result.success) {
          // 失敗
          await updateScrapingLog(logId, {
            finishedAt: new Date(),
            status: "failed",
            errorMessage: result.errorMessage,
          });

          return {
            success: false,
            error: result.errorMessage,
          };
        }

        // データベースに保存（新規判定あり）
        const convertedItems = result.items.map(convertToInsertBidding);
        const { newBiddings, updatedBiddings } = await detectNewBiddings(convertedItems);

        // ログ更新
        await updateScrapingLog(logId, {
          finishedAt: new Date(),
          status: "success",
          itemsScraped: result.totalCount,
          newItems: newBiddings.length,
        });

        return {
          success: true,
          itemsScraped: result.totalCount,
          newItems: newBiddings.length,
          updatedItems: updatedBiddings.length,
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

    // 詳細検索条件付きスクレイピング実行
    executeWithConditions: protectedProcedure
      .input(
        z.object({
          projectType: z.array(z.string()).optional(),
          titleKeyword: z.string().optional(),
          location: z.string().optional(),
          constructionNo: z.string().optional(),
          estimatedPriceMin: z.number().optional(),
          estimatedPriceMax: z.number().optional(),
          rating: z.array(z.string()).optional(),
          fetchDetails: z.boolean().default(false),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const startedAt = new Date();

        // ログ作成
        const logId = await insertScrapingLog({
          userId: ctx.user.id,
          executionType: "manual",
          startedAt,
          status: "running",
        });

        try {
          // 検索条件を準備
          const conditions: SearchConditions = {
            useLatestAnnouncement: false,
            projectType: input.projectType,
            titleKeyword: input.titleKeyword,
            location: input.location,
            constructionNo: input.constructionNo,
            estimatedPriceMin: input.estimatedPriceMin,
            estimatedPriceMax: input.estimatedPriceMax,
            rating: input.rating,
          };

          // スクレイピング実行
          const result = await scrapeMieBiddings(conditions, input.fetchDetails);

          if (!result.success) {
            // 失敗
            await updateScrapingLog(logId, {
              finishedAt: new Date(),
              status: "failed",
              errorMessage: result.errorMessage,
            });

            return {
              success: false,
              error: result.errorMessage,
            };
          }

          // データベースに保存
          const convertedItems = result.items.map(convertToInsertBidding);
          const { saved, duplicates } = await insertBiddingsBatch(convertedItems);

          // ログ更新
          await updateScrapingLog(logId, {
            finishedAt: new Date(),
            status: "success",
            itemsScraped: result.totalCount,
            newItems: saved,
          });

          return {
            success: true,
            itemsScraped: result.totalCount,
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
        
        // スケジューラーに登録（enabled=trueの場合）
        if (input.enabled) {
          const schedules = await getScheduleSettings();
          const newSchedule = schedules[0]; // 最新のスケジュール
          if (newSchedule) {
            await updateSchedule({
              id: newSchedule.id,
              name: newSchedule.name,
              scheduleType: newSchedule.scheduleType,
              executionTime: newSchedule.executionTime,
              daysOfWeek: newSchedule.daysOfWeek,
              cronExpression: newSchedule.cronExpression,
              enabled: newSchedule.enabled,
            });
          }
        }
        
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
        
        // 更新後のスケジュールを取得
        const schedules = await getScheduleSettings();
        const updatedSchedule = schedules.find(s => s.id === id);
        
        if (updatedSchedule) {
          if (updatedSchedule.enabled) {
            // スケジューラーを更新
            await updateSchedule({
              id: updatedSchedule.id,
              name: updatedSchedule.name,
              scheduleType: updatedSchedule.scheduleType,
              executionTime: updatedSchedule.executionTime,
              daysOfWeek: updatedSchedule.daysOfWeek,
              cronExpression: updatedSchedule.cronExpression,
              enabled: updatedSchedule.enabled,
            });
          } else {
            // 無効化された場合はスケジューラーから削除
            removeSchedule(id);
          }
        }
        
        return { success: true };
      }),

    // スケジュール設定削除
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        // スケジューラーから削除
        removeSchedule(input.id);
        
        // データベースから削除
        await deleteScheduleSetting(input.id);
        
        return { success: true };
      }),
    
    // アクティブなスケジュールの次回実行時刻を取得
    getActiveInfo: protectedProcedure.query(() => {
      return getActiveScheduleInfo();
    }),
  }),

  // LINE通知関連API
  line: router({
    // LINE連携状態を取得
    getConnection: protectedProcedure.query(async ({ ctx }) => {
      const connection = await getLineConnectionByUserId(ctx.user.id);
      return connection;
    }),

    // ワンタイムコードを発行
    generateCode: protectedProcedure.mutation(async ({ ctx }) => {
      // 既存の未使用コードを削除
      await deleteUserVerificationCodes(ctx.user.id);
      
      // 新しいコードを生成
      const code = await createVerificationCode(ctx.user.id);
      
      return { code };
    }),

    // LINE連携を解除
    disconnect: protectedProcedure.mutation(async ({ ctx }) => {
      await deleteLineConnection(ctx.user.id);
      return { success: true };
    }),

    // ワンタイムコードを検証してLINE連携（Webhookから呼ばれる想定）
    verifyAndConnect: publicProcedure
      .input(z.object({
        code: z.string(),
        lineUserId: z.string(),
        lineDisplayName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // コードを検証
        const verification = await verifyCode(input.code);
        
        if (!verification.valid || !verification.userId) {
          throw new Error("無効なコードです");
        }

        // 既存の連携を削除（同じLINE User IDの連携があれば）
        const existingConnection = await getLineConnectionByLineUserId(input.lineUserId);
        if (existingConnection) {
          await deleteLineConnection(existingConnection.userId);
        }

        // 新しい連携を作成
        await insertLineConnection({
          userId: verification.userId,
          lineUserId: input.lineUserId,
          lineDisplayName: input.lineDisplayName,
        });

        return { success: true };
      }),
  }),

  // 通知設定関連API
  notifications: router({
    // 通知設定一覧を取得
    list: protectedProcedure.query(async ({ ctx }) => {
      return await getNotificationSubscriptions(ctx.user.id);
    }),

    // 通知設定を作成
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        issuerIds: z.string().optional(),
        orderOrganCodes: z.string().optional(),
        orderOrganNames: z.string().optional(),
        projectType: z.string().optional(),
        publicationDateDays: z.number().optional(),
        updateDateDays: z.number().optional(),
        keywords: z.string().optional(),
        ratings: z.string().optional(),
        estimatedPriceMin: z.string().optional(),
        estimatedPriceMax: z.string().optional(),
        notificationTimes: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        // issuerIdsが指定されている場合、発注機関名に変換
        let orderOrganNames = input.orderOrganNames;
        if (input.issuerIds && !orderOrganNames) {
          const issuerIdArray = input.issuerIds.split(",").map(Number);
          const issuers = await getAllIssuers();
          const selectedIssuers = issuers.filter((issuer: Issuer) => issuerIdArray.includes(issuer.id));
          orderOrganNames = selectedIssuers.map((issuer: Issuer) => issuer.name).join(",");
        }

        const id = await insertNotificationSubscription({
          userId: ctx.user.id,
          name: input.name,
          orderOrganNames,
          projectType: input.projectType,
          notificationTimes: input.notificationTimes,
          publicationDateDays: input.publicationDateDays,
          updateDateDays: input.updateDateDays,
          keywords: input.keywords,
          ratings: input.ratings,
          estimatedPriceMin: input.estimatedPriceMin,
          estimatedPriceMax: input.estimatedPriceMax,
          lastNotifiedAt: new Date(), // 設定作成時点を基準とし、それ以降の案件のみ通知
        });
        return { success: true, id };
      }),

    // 通知設定を更新
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        issuerIds: z.string().optional(),
        orderOrganCodes: z.string().optional(),
        orderOrganNames: z.string().optional(),
        projectType: z.string().optional(),
        publicationDateDays: z.number().optional(),
        updateDateDays: z.number().optional(),
        keywords: z.string().optional(),
        ratings: z.string().optional(),
        estimatedPriceMin: z.string().optional(),
        estimatedPriceMax: z.string().optional(),
        notificationTimes: z.string().optional(),
        enabled: z.boolean().optional(),
        lastNotifiedAt: z.date().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, issuerIds, ...updates } = input;
        
        // issuerIdsが指定されている場合、発注機関名に変換
        if (issuerIds && !updates.orderOrganNames) {
          const issuerIdArray = issuerIds.split(",").map(Number);
          const issuers = await getAllIssuers();
          const selectedIssuers = issuers.filter((issuer: Issuer) => issuerIdArray.includes(issuer.id));
          updates.orderOrganNames = selectedIssuers.map((issuer: Issuer) => issuer.name).join(",");
        }
        
        // フィルター条件（発注機関、工事種別）が変更された場合、lastNotifiedAtを更新
        if (updates.orderOrganNames !== undefined || updates.projectType !== undefined) {
          updates.lastNotifiedAt = new Date(); // フィルター変更時点を基準とし、それ以降の案件のみ通知
        }
        
        await updateNotificationSubscription(id, updates);
        return { success: true };
      }),

    // 通知設定を削除
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteNotificationSubscription(input.id);
        return { success: true };
      }),

    // 通知履歴を取得
    logs: protectedProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        return await getNotificationLogs(ctx.user.id, input.limit);
      }),

    // 手動テスト通知を送信
    sendTest: protectedProcedure
      .input(z.object({ subscriptionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // 通知設定を取得
        const subscriptions = await getNotificationSubscriptions(ctx.user.id);
        const subscription = subscriptions.find(s => s.id === input.subscriptionId);
        
        if (!subscription) {
          throw new Error("通知設定が見つかりません");
        }

        // LINE連携状態を確認
        const lineConnection = await getLineConnectionByUserId(ctx.user.id);
        if (!lineConnection) {
          throw new Error("LINEアカウントが連携されていません");
        }

        // テストメッセージを送信
        const testMessage = `📢 テスト通知\n\n通知設定: ${subscription.name}\n\nLINE通知が正常に動作しています。\n条件に一致する新着案件が公開されると、このように通知が届きます。`;
        
        await sendLineTextMessage(lineConnection.lineUserId, testMessage);

        // 通知履歴を記録（テスト通知は履歴に記録しない）

        return { success: true, message: "テスト通知を送信しました" };
      }),
  }),

  // 発注機関マスター関連API
  issuers: router({
    // 発注機関一覧取得
    list: protectedProcedure
      .query(async () => {
        return await getAllIssuers();
      }),

    // 複数IDで発注機関を取得
    getByIds: protectedProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .query(async ({ input }) => {
        return await getIssuersByIds(input.ids);
      }),
  }),
});

export type AppRouter = typeof appRouter;
