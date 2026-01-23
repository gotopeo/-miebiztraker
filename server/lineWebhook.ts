import { Router } from "express";
import { WebhookEvent } from "@line/bot-sdk";
import { verifyLineSignature, sendLineTextMessage, getLineProfile } from "./_core/line";
import { 
  getLineConnectionByLineUserId, 
  verifyCode, 
  insertLineConnection,
  deleteLineConnection 
} from "./db";

export const lineWebhookRouter = Router();

/**
 * LINE Webhook エンドポイント
 */
lineWebhookRouter.post("/webhook", async (req, res) => {
  try {
    const signature = req.headers["x-line-signature"] as string;
    
    if (!signature) {
      console.error("[LINE Webhook] Missing signature");
      return res.status(400).json({ error: "Missing signature" });
    }

    // 生のリクエストボディを取得（express.raw()でBufferとして保存されている）
    const rawBody = (req.body as Buffer).toString('utf8');
    
    // 署名を検証
    const isValid = verifyLineSignature(rawBody, signature);
    
    if (!isValid) {
      console.error("[LINE Webhook] Invalid signature");
      return res.status(401).json({ error: "Invalid signature" });
    }

    // JSONをパース
    const body = JSON.parse(rawBody);
    const events: WebhookEvent[] = body.events || [];

    // 各イベントを処理
    for (const event of events) {
      await handleWebhookEvent(event);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("[LINE Webhook] Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Webhookイベントを処理
 */
async function handleWebhookEvent(event: WebhookEvent) {
  try {
    // メッセージイベント
    if (event.type === "message" && event.message.type === "text") {
      const lineUserId = event.source.userId;
      if (!lineUserId) return;

      const messageText = event.message.text.trim();
      
      // 6桁の数字かチェック
      if (/^\d{6}$/.test(messageText)) {
        await handleVerificationCode(lineUserId, messageText);
      } else {
        // その他のメッセージ
        await sendLineTextMessage(
          lineUserId,
          "認証コードを送信してください。\n\n設定画面で表示された6桁のコードを入力してください。"
        );
      }
    }
    
    // フォローイベント（友だち追加）
    else if (event.type === "follow") {
      const lineUserId = event.source.userId;
      if (!lineUserId) return;

      await sendLineTextMessage(
        lineUserId,
        "MieBid Trackerへようこそ！\n\n" +
        "アカウント連携を行うには、Webサイトの設定画面で表示される6桁の認証コードをこのトークに送信してください。"
      );
    }
    
    // アンフォローイベント（ブロック）
    else if (event.type === "unfollow") {
      const lineUserId = event.source.userId;
      if (!lineUserId) return;

      // 連携を削除
      const connection = await getLineConnectionByLineUserId(lineUserId);
      if (connection) {
        await deleteLineConnection(connection.userId);
        console.log(`[LINE Webhook] User ${connection.userId} disconnected (unfollowed)`);
      }
    }
  } catch (error) {
    console.error("[LINE Webhook] Event handling error:", error);
  }
}

/**
 * 認証コードを処理
 */
async function handleVerificationCode(lineUserId: string, code: string) {
  try {
    // コードを検証
    const verification = await verifyCode(code);
    
    if (!verification.valid || !verification.userId) {
      await sendLineTextMessage(
        lineUserId,
        "❌ 認証コードが無効です。\n\n" +
        "コードの有効期限が切れているか、既に使用済みの可能性があります。\n" +
        "新しいコードを発行してください。"
      );
      return;
    }

    // 既存の連携を削除（同じLINE User IDの連携があれば）
    const existingConnection = await getLineConnectionByLineUserId(lineUserId);
    if (existingConnection) {
      await deleteLineConnection(existingConnection.userId);
    }

    // プロフィール情報を取得
    let displayName: string | undefined;
    try {
      const profile = await getLineProfile(lineUserId);
      displayName = profile.displayName;
    } catch (error) {
      console.error("[LINE Webhook] Failed to get profile:", error);
    }

    // 新しい連携を作成
    await insertLineConnection({
      userId: verification.userId,
      lineUserId,
      lineDisplayName: displayName,
    });

    await sendLineTextMessage(
      lineUserId,
      "✅ アカウント連携が完了しました！\n\n" +
      "通知設定を行うと、条件に一致する新着入札情報をLINEで受け取ることができます。"
    );

    console.log(`[LINE Webhook] User ${verification.userId} connected successfully`);
  } catch (error) {
    console.error("[LINE Webhook] Verification error:", error);
    await sendLineTextMessage(
      lineUserId,
      "❌ 認証処理中にエラーが発生しました。\n\nしばらくしてから再度お試しください。"
    );
  }
}
